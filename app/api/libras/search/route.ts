import { NextRequest, NextResponse } from 'next/server';
import type { LibrasVideoResult, LibrasSignGroup } from '@/lib/libras-types';

export const dynamic = 'force-dynamic';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

const DEFAULT_CHANNEL_HANDLES = '@angelagirardi,@academiadelibras,@netolibras';
const MAX_SIGNS = 8;

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
  };
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function getPreferredHandles(): string[] {
  const raw = process.env.LIBRAS_CHANNEL_HANDLES?.trim() || DEFAULT_CHANNEL_HANDLES;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function searchYouTube(
  query: string,
  apiKey: string,
  maxResults: number = 10,
  channelId?: string
): Promise<YouTubeSearchItem[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    key: apiKey,
    order: 'relevance',
    relevanceLanguage: 'pt',
    regionCode: 'BR',
  });
  if (channelId) params.set('channelId', channelId);

  const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error(`[LibrasSearch] YouTube search error ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.items || [];
}

// Resolve @handle (or accepts UC… channel id) → channel id. Cached 24h.
const channelCache = new Map<string, { channelId: string | null; timestamp: number }>();
const CHANNEL_CACHE_TTL = 24 * 60 * 60 * 1000;

async function resolveChannelId(handleOrId: string, apiKey: string): Promise<string | null> {
  if (/^UC[\w-]{22}$/.test(handleOrId)) return handleOrId;

  const cacheKey = handleOrId.toLowerCase();
  const cached = channelCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CHANNEL_CACHE_TTL) {
    return cached.channelId;
  }

  try {
    const handle = handleOrId.startsWith('@') ? handleOrId : `@${handleOrId}`;
    const params = new URLSearchParams({ part: 'id', forHandle: handle, key: apiKey });
    const res = await fetch(`${YOUTUBE_CHANNELS_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      channelCache.set(cacheKey, { channelId: null, timestamp: Date.now() });
      return null;
    }
    const data = await res.json();
    const id =
      typeof data.items?.[0]?.id === 'string'
        ? (data.items[0].id as string)
        : null;
    channelCache.set(cacheKey, { channelId: id, timestamp: Date.now() });
    return id;
  } catch {
    channelCache.set(cacheKey, { channelId: null, timestamp: Date.now() });
    return null;
  }
}

async function resolvePreferredChannelIds(apiKey: string): Promise<string[]> {
  const handles = getPreferredHandles();
  const resolved = await Promise.all(handles.map((h) => resolveChannelId(h, apiKey)));
  return resolved.filter((id): id is string => Boolean(id));
}

function deduplicateVideos(items: YouTubeSearchItem[]): YouTubeSearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = item.id.videoId;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function rankVideos(items: YouTubeSearchItem[]): YouTubeSearchItem[] {
  return items.sort((a, b) => {
    const aTitle = a.snippet.title.toLowerCase();
    const bTitle = b.snippet.title.toLowerCase();

    const aHasLibras = aTitle.includes('libras');
    const bHasLibras = bTitle.includes('libras');
    if (aHasLibras && !bHasLibras) return -1;
    if (!aHasLibras && bHasLibras) return 1;

    const aHasSinal = aTitle.includes('sinal');
    const bHasSinal = bTitle.includes('sinal');
    if (aHasSinal && !bHasSinal) return -1;
    if (!aHasSinal && bHasSinal) return 1;

    return 0;
  });
}

function mapResults(
  items: YouTubeSearchItem[],
  preferredChannelIds: Set<string>
): LibrasVideoResult[] {
  return items.map((item) => ({
    videoId: item.id.videoId,
    title: cleanText(item.snippet.title),
    channel: item.snippet.channelTitle || 'Canal desconhecido',
    thumbnail: `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    preferred: preferredChannelIds.has(item.snippet.channelId),
  }));
}

/**
 * Search one term: preferred Libras channels first (channelId-scoped);
 * if none found there, fall back to the usual multi-query global search.
 */
async function searchTerm(
  term: string,
  apiKey: string,
  limit: number,
  preferredChannelIds: string[]
): Promise<LibrasVideoResult[]> {
  const preferredSet = new Set(preferredChannelIds);

  if (preferredChannelIds.length > 0) {
    const perChannel = await Promise.all(
      preferredChannelIds.map((channelId) =>
        searchYouTube(`${term} em libras`, apiKey, 8, channelId)
      )
    );
    const preferredItems = rankVideos(deduplicateVideos(perChannel.flat()));
    if (preferredItems.length > 0) {
      return mapResults(preferredItems.slice(0, limit), preferredSet);
    }
  }

  // Global fallback — same multi-query strategy as before
  const queries = [
    `${term} em libras`,
    `sinal ${term} libras`,
    `${term} língua brasileira de sinais`,
    `${term} LIBRAS`,
  ];
  const allResults = await Promise.all(
    queries.map((q) => searchYouTube(q, apiKey, 10))
  );
  const ranked = rankVideos(deduplicateVideos(allResults.flat()));
  return mapResults(ranked.slice(0, limit), preferredSet);
}

// Simple in-memory cache (1 min TTL)
const cache = new Map<
  string,
  { phrase: LibrasVideoResult[]; signGroups: LibrasSignGroup[]; timestamp: number }
>();
const CACHE_TTL = 60_000;

function parseSigns(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_SIGNS);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 10);
  const signs = parseSigns(searchParams.get('signs'));

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key not configured' },
      { status: 503 }
    );
  }

  const cacheKey = `${query}:${limit}:${signs.join('|')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      results: cached.phrase,
      phraseResults: cached.phrase,
      signGroups: cached.signGroups,
      totalFound:
        cached.phrase.length +
        cached.signGroups.reduce((n, g) => n + g.results.length, 0),
      query,
    });
  }

  try {
    const preferredChannelIds = await resolvePreferredChannelIds(apiKey);

    const phraseResults = await searchTerm(
      query.trim(),
      apiKey,
      limit,
      preferredChannelIds
    );

    // One search per sign (parallel across signs; preferred channels first)
    const signGroups: LibrasSignGroup[] = await Promise.all(
      signs.map(async (sign) => ({
        sign,
        results: await searchTerm(sign, apiKey, limit, preferredChannelIds),
      }))
    );

    cache.set(cacheKey, { phrase: phraseResults, signGroups, timestamp: Date.now() });

    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }

    return NextResponse.json({
      results: phraseResults,
      phraseResults,
      signGroups,
      totalFound:
        phraseResults.length + signGroups.reduce((n, g) => n + g.results.length, 0),
      query,
    });
  } catch (error) {
    console.error('[LibrasSearch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search for Libras videos' },
      { status: 500 }
    );
  }
}
