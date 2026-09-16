import { NextRequest, NextResponse } from 'next/server';
import type { LibrasVideoResult } from '@/lib/libras-types';

export const dynamic = 'force-dynamic';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
  };
}

interface YouTubeVideoItem {
  id: string;
  contentDetails: { duration: string };
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

async function searchYouTube(
  query: string,
  apiKey: string,
  maxResults: number = 10
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

  const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    console.error(`[LibrasSearch] YouTube search error ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.items || [];
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

    // Prioritize titles containing "libras"
    const aHasLibras = aTitle.includes('libras');
    const bHasLibras = bTitle.includes('libras');
    if (aHasLibras && !bHasLibras) return -1;
    if (!aHasLibras && bHasLibras) return 1;

    // Prioritize titles containing "sinal"
    const aHasSinal = aTitle.includes('sinal');
    const bHasSinal = bTitle.includes('sinal');
    if (aHasSinal && !bHasSinal) return -1;
    if (!aHasSinal && bHasSinal) return 1;

    return 0;
  });
}

// Simple in-memory cache (1 min TTL)
const cache = new Map<string, { data: LibrasVideoResult[]; timestamp: number }>();
const CACHE_TTL = 60_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 10);

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

  const cacheKey = `${query}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      results: cached.data,
      totalFound: cached.data.length,
      query,
    });
  }

  try {
    // Multi-query strategy: search multiple variations
    const queries = [
      `${query} em libras`,
      `sinal ${query} libras`,
      `${query} língua brasileira de sinais`,
      `${query} LIBRAS`,
    ];

    const allResults = await Promise.all(
      queries.map((q) => searchYouTube(q, apiKey, 10))
    );

    // Flatten, deduplicate, and rank
    const flat = allResults.flat();
    const deduped = deduplicateVideos(flat);
    const ranked = rankVideos(deduped);

    // Take top results
    const topResults = ranked.slice(0, limit);

    // Map to simplified response
    const results: LibrasVideoResult[] = topResults.map((item) => ({
      videoId: item.id.videoId,
      title: cleanText(item.snippet.title),
      channel: item.snippet.channelTitle || 'Canal desconhecido',
      thumbnail: `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    // Cache results
    cache.set(cacheKey, { data: results, timestamp: Date.now() });

    // Evict old cache entries
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }

    return NextResponse.json({
      results,
      totalFound: results.length,
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
