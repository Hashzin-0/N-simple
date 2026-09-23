import { NextRequest, NextResponse } from 'next/server';
import type { LibrasVideoResult, LibrasSignGroup, LibrasSenseOption } from '@/lib/libras-types';
import { normalizeText, includesWholeWord } from '@/lib/libras-search-utils';
import {
  detectSenseForQuery,
  type LibrasWordSense,
} from '@/lib/libras-senses';

export const dynamic = 'force-dynamic';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

const DEFAULT_CHANNEL_HANDLES = '@angelagirardi,@academiadelibras,@netolibras';
const MAX_SIGNS = 8;

/** Sinais de que o vídeo é sobre Libras/sinais (não só o termo no título). */
const SIGN_CONTEXT_KEYWORDS = [
  'libras',
  'sinal',
  'sinais',
  'significar',
  'gestual',
  'lingua brasileira',
  'comunicacao visual',
  'assinar',
  'assinando',
];

/** Bloqueio de conteúdo impróprio (pt-BR) — filtro extra além do safeSearch. */
const PROFANE_SUBSTRINGS = [
  'tomar no cu',
  'caralho',
  'puta que pariu',
  'filha da puta',
  'vai se foder',
  'foda-se',
  'fodase',
  'buceta',
  'boceta',
  'punheta',
  'xoxota',
  'piroca',
  'arrombad',
  'otaria',
  'otario',
  'merda',
  'bosta',
  'cacete',
  'cuzao',
  'vagabunda',
];

const PROFANE_WHOLE_WORDS = new Set(['cu', 'puta', 'puto', 'vadia']);

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

function isProfane(text: string): boolean {
  const n = normalizeText(text);
  if (PROFANE_SUBSTRINGS.some((p) => n.includes(normalizeText(p)))) return true;
  for (const word of PROFANE_WHOLE_WORDS) {
    if (includesWholeWord(n, word)) return true;
  }
  return false;
}

function hasSignContext(text: string): boolean {
  const n = normalizeText(text);
  return SIGN_CONTEXT_KEYWORDS.some((k) => n.includes(k));
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
    safeSearch: 'strict',
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

interface FilterContext {
  matchTerms: string[];
  preferredChannelIds: Set<string>;
  requireSignContext: boolean;
  sense?: LibrasWordSense | null;
}

/**
 * Filtro de relevância:
 * - rejeita conteúdo impróprio
 * - exige o termo pedido como palavra inteira no título OU descrição
 *   ("plantadeira" não casa em "plantadeiração"; termo fora de contexto é descartado)
 * - exige contexto de Libras (libras/sinal/…) salvo em canais preferidos
 * - com sentido ativo: boosting de contextKeywords e penalidade de avoidKeywords
 */
function filterByRelevance(
  items: YouTubeSearchItem[],
  ctx: FilterContext
): YouTubeSearchItem[] {
  return items.filter((item) => {
    const title = normalizeText(item.snippet.title);
    const desc = normalizeText(item.snippet.description || '');

    if (isProfane(title) || isProfane(desc)) return false;

    const termMatch = ctx.matchTerms.some(
      (t) => includesWholeWord(title, t) || includesWholeWord(desc, t)
    );
    if (!termMatch) return false;

    const preferred = ctx.preferredChannelIds.has(item.snippet.channelId);
    if (ctx.requireSignContext && !preferred) {
      if (!hasSignContext(title) && !hasSignContext(desc)) return false;
    }

    if (ctx.sense) {
      const avoidHit = ctx.sense.avoidKeywords.some(
        (k) => includesWholeWord(title, k) || includesWholeWord(desc, k)
      );
      if (avoidHit) return false;
    }

    return true;
  });
}

function scoreVideo(item: YouTubeSearchItem, matchTerms: string[], sense?: LibrasWordSense | null): number {
  const title = normalizeText(item.snippet.title);
  const desc = normalizeText(item.snippet.description || '');
  let score = 0;

  for (const term of matchTerms) {
    if (includesWholeWord(title, term)) score += 10;
    if (includesWholeWord(desc, term)) score += 4;
  }

  if (title.includes('libras')) score += 6;
  if (desc.includes('libras')) score += 3;
  if (title.includes('sinal')) score += 6;
  if (desc.includes('sinal')) score += 3;

  // Termo perto de "sinal/libras" no título → vídeo didático de sinal
  for (const term of matchTerms) {
    const nearSign = new RegExp(
      `(sinal|libras).{0,40}${term}|${term}.{0,40}(sinal|libras)`,
      'i'
    );
    if (nearSign.test(title)) score += 8;
  }

  if (sense) {
    for (const kw of sense.contextKeywords) {
      if (includesWholeWord(title, kw)) score += 5;
      if (includesWholeWord(desc, kw)) score += 2;
    }
    for (const kw of sense.avoidKeywords) {
      if (includesWholeWord(title, kw)) score -= 8;
      if (includesWholeWord(desc, kw)) return score - 20;
    }
  }

  return score;
}

function rankVideos(
  items: YouTubeSearchItem[],
  matchTerms: string[],
  sense?: LibrasWordSense | null
): YouTubeSearchItem[] {
  return [...items].sort(
    (a, b) => scoreVideo(b, matchTerms, sense) - scoreVideo(a, matchTerms, sense)
  );
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

function buildQueries(term: string, sense?: LibrasWordSense | null): string[] {
  if (sense) return sense.searchQueries;
  return [
    `${term} em libras`,
    `sinal ${term} libras`,
    `${term} língua brasileira de sinais`,
    `${term} LIBRAS`,
  ];
}

function collectMatchTerms(term: string, sense?: LibrasWordSense | null): string[] {
  const base = [term];
  if (sense) {
    base.push(sense.word);
    base.push(...sense.contextKeywords.slice(0, 4));
  }
  return Array.from(new Set(base.filter(Boolean)));
}

/**
 * Search one term: preferred Libras channels first (channelId-scoped);
 * if none found there, fall back to the usual multi-query global search.
 * Results are filtered for term-in-title/description + Libras context.
 */
async function searchTerm(
  term: string,
  apiKey: string,
  limit: number,
  preferredChannelIds: string[],
  sense?: LibrasWordSense | null
): Promise<LibrasVideoResult[]> {
  const preferredSet = new Set(preferredChannelIds);
  const matchTerms = collectMatchTerms(term, sense);
  const queries = buildQueries(term, sense);

  const searchAll = async (scoped: boolean): Promise<YouTubeSearchItem[]> => {
    if (scoped && preferredChannelIds.length > 0) {
      const perChannel = await Promise.all(
        preferredChannelIds.map((channelId) =>
          Promise.all(
            queries.slice(0, 2).map((q) => searchYouTube(q, apiKey, 8, channelId))
          )
        )
      );
      return perChannel.flat(2);
    }
    const allResults = await Promise.all(
      queries.map((q) => searchYouTube(q, apiKey, 10))
    );
    return allResults.flat();
  };

  const applyPipeline = (
    items: YouTubeSearchItem[],
    requireSignContext: boolean
  ): LibrasVideoResult[] => {
    const filtered = filterByRelevance(deduplicateVideos(items), {
      matchTerms,
      preferredChannelIds: preferredSet,
      requireSignContext,
      sense,
    });
    const ranked = rankVideos(filtered, matchTerms, sense);
    return mapResults(ranked.slice(0, limit), preferredSet);
  };

  // Pass 1: preferred channels (sign context not required for trusted channels)
  if (preferredChannelIds.length > 0) {
    const preferredItems = await searchAll(true);
    const strict = applyPipeline(preferredItems, false);
    if (strict.length > 0) return strict;
  }

  // Pass 2: global — strict (term + Libras context)
  const globalItems = await searchAll(false);
  const strict = applyPipeline(globalItems, true);
  if (strict.length > 0) return strict;

  // Pass 3: fallback — term match only (sem exigir contexto Libras no título)
  return applyPipeline(globalItems, false);
}

// Simple in-memory cache (1 min TTL)
const cache = new Map<
  string,
  {
    phrase: LibrasVideoResult[];
    signGroups: LibrasSignGroup[];
    senseOptions: LibrasSenseOption[];
    selectedSenseId: string | null;
    ambiguousSense: boolean;
    timestamp: number;
  }
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

function toSenseOptions(options: LibrasWordSense[]): LibrasSenseOption[] {
  return options.map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    word: s.word,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 10);
  const signs = parseSigns(searchParams.get('signs'));
  const explicitSenseId = searchParams.get('sense');

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

  const cacheKey = `${query}:${limit}:${signs.join('|')}:${explicitSenseId || ''}`;
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
      senseOptions: cached.senseOptions,
      selectedSenseId: cached.selectedSenseId,
      ambiguousSense: cached.ambiguousSense,
    });
  }

  try {
    const preferredChannelIds = await resolvePreferredChannelIds(apiKey);
    const detection = detectSenseForQuery(query.trim(), explicitSenseId);
    const sense = detection.auto;
    const senseOptions = toSenseOptions(detection.options);
    // Ambíguo quando há opções e nenhuma foi escolhida/deduzida
    const ambiguousSense = !explicitSenseId && !sense && detection.options.length > 1;

    // Ambíguo sem sentido explícito → busca genérica + devolve opções
    // (UI mostra chips; usuário pode refinar com ?sense=id)
    const phraseResults = await searchTerm(
      query.trim(),
      apiKey,
      limit,
      preferredChannelIds,
      sense
    );

    const signGroups: LibrasSignGroup[] = await Promise.all(
      signs.map(async (sign) => ({
        sign,
        results: await searchTerm(sign, apiKey, limit, preferredChannelIds, sense),
      }))
    );

    cache.set(cacheKey, {
      phrase: phraseResults,
      signGroups,
      senseOptions,
      selectedSenseId: sense?.id ?? null,
      ambiguousSense,
      timestamp: Date.now(),
    });

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
      senseOptions,
      selectedSenseId: sense?.id ?? null,
      ambiguousSense,
    });
  } catch (error) {
    console.error('[LibrasSearch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search for Libras videos' },
      { status: 500 }
    );
  }
}
