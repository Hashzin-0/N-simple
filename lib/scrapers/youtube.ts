import { ScientificSource } from '@/components/PesquisadorAgro/types';

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(dateStr: string): number {
  if (!dateStr) return new Date().getFullYear();
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : new Date().getFullYear();
}

function parseISO8601Duration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  if (hours > 0) {
    return seconds > 0 ? `${hours}h ${minutes}min ${seconds}s` : `${hours}h ${minutes}min`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}min ${seconds}s` : `${minutes}min`;
  }
  return `${seconds}s`;
}

async function fetchVideoDurations(
  videoIds: string[],
  apiKey: string
): Promise<Record<string, string>> {
  const durations: Record<string, string> = {};
  const VIDEOS_API_URL = 'https://www.googleapis.com/youtube/v3/videos';

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const params = new URLSearchParams({
        part: 'contentDetails',
        id: batch.join(','),
        key: apiKey,
      });
      const res = await fetch(`${VIDEOS_API_URL}?${params.toString()}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.items || !Array.isArray(data.items)) continue;
      for (const item of data.items) {
        const duration = item.contentDetails?.duration;
        if (duration) {
          durations[item.id] = parseISO8601Duration(duration);
        }
      }
    } catch {
      // ignore batch errors
    }
  }
  return durations;
}

function extractKeywords(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const stopwords = new Set([
    'para', 'como', 'mais', 'sobre', 'entre', 'este', 'esta', 'pela', 'pelo',
    'desde', 'foram', 'sendo', 'também', 'pode', 'podem', 'tem', 'sem', 'com',
    'uma', 'dos', 'das', 'nos', 'nas', 'que', 'por', 'sao', 'estudo', 'estudos',
    'video', 'vídeo', 'canal', 'inscreva', 'curta',
  ]);
  const words = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopwords.has(w));

  const frequency: Record<string, number> = {};
  for (const w of words) {
    frequency[w] = (frequency[w] || 0) + 1;
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

export async function scrapeYouTube(
  query: string,
  maxResults: number = 20,
  language: 'pt-br' | 'pt-br-en' = 'pt-br'
): Promise<ScientificSource[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn('[YouTube] YOUTUBE_API_KEY not configured, skipping YouTube search');
    return [];
  }

  try {
    const searchQuery = query;
    const params: Record<string, string> = {
      part: 'snippet',
      q: searchQuery,
      type: 'video',
      maxResults: String(maxResults),
      key: apiKey,
      order: 'relevance',
    };

    if (language === 'pt-br') {
      params.relevanceLanguage = 'pt';
      params.regionCode = 'BR';
    }

    const searchParams = new URLSearchParams(params);
    const response = await fetch(`${YOUTUBE_API_URL}?${searchParams.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[YouTube] API error ${response.status}:`, errorBody);
      return [];
    }

    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    const videoIds = data.items.map((item: { id: { videoId: string } }) => item.id.videoId);
    const durations = await fetchVideoDurations(videoIds, apiKey);

    const results: ScientificSource[] = data.items.map(
      (item: {
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          channelTitle: string;
          publishedAt: string;
        };
      }, index: number) => {
        const { videoId } = item.id;
        const { title, description, channelTitle, publishedAt } = item.snippet;

        const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const year = extractYear(publishedAt);

        // YouTube thumbnail URLs (standard pattern)
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        return {
          id: `youtube-${videoId}-${Date.now()}`,
          title: cleanText(title),
          authors: channelTitle || 'Canal técnico',
          year,
          publication: `${channelTitle} - YouTube`,
          sourceName: 'YouTube' as const,
          sourceType: 'video_tecnico' as const,
          abstract: cleanText(description).slice(0, 500) || 'Vídeo técnico disponível no YouTube.',
          keywords: extractKeywords(title, description),
          directUrl,
          searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          imageUrl: thumbnailUrl,
          abntCitation: `${(channelTitle || 'YOUTUBE').toUpperCase()}. ${title}. YouTube, ${year}. Disponível em: ${directUrl}.`,
          videoDuration: durations[videoId] || undefined,
        };
      }
    );

    return results;
  } catch (error) {
    console.error('[YouTube] Error calling YouTube API:', error);
    return [];
  }
}
