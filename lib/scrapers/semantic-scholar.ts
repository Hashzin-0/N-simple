import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';

const S2_API = 'https://api.semanticscholar.org/graph/v1/paper/search';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function detectSourceType(title: string, abstract: string): ScientificSource['sourceType'] {
  const text = `${title} ${abstract}`.toLowerCase();
  if (text.includes('tese') || text.includes('dissertation') || text.includes('dissertação'))
    return 'tese_dissertacao';
  if (text.includes('book') || text.includes('manual') || text.includes('handbook'))
    return 'livro_manual';
  if (text.includes('bulletin') || text.includes('boletim') || text.includes('circular'))
    return 'boletim_tecnico';
  if (text.includes('review') || text.includes('revisão'))
    return 'ensaio_cientifico';
  return 'artigo_periodico';
}

function extractKeywords(title: string, abstract: string): string[] {
  const text = `${title} ${abstract}`.toLowerCase();
  const stopwords = new Set([
    'para', 'como', 'mais', 'sobre', 'entre', 'este', 'esta', 'pela', 'pelo',
    'desde', 'foram', 'sendo', 'também', 'pode', 'podem', 'tem', 'sem', 'com',
    'uma', 'dos', 'das', 'nos', 'nas', 'que', 'por', 'sao', 'estudo', 'estudos',
    'the', 'and', 'with', 'for', 'from', 'that', 'this', 'are', 'was', 'were',
    'been', 'have', 'has', 'not', 'but', 'its', 'can', 'will', 'all', 'one',
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

function parseS2Item(paper: any): ScientificSource {
  const title = cleanText(paper.title || '');
  const authors = (paper.authors || [])
    .map((a: any) => a.name || '')
    .filter(Boolean)
    .join('; ') || 'Autores não identificados';

  const year = paper.year || new Date().getFullYear();
  const journal = paper.venue || paper.journal?.name || 'Semantic Scholar';
  const abstract = cleanText(paper.abstract || '');
  const doi = paper.externalIds?.DOI;
  const url = paper.url || paper.openAccessPdf?.url;
  const citationCount = paper.citationCount || 0;

  // Semantic Scholar doesn't provide thumbnail images in search results,
  // but we can construct a link to the paper page
  const paperUrl = paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`;

  return {
    id: `s2-${paper.paperId || Date.now()}`,
    title,
    authors,
    year,
    publication: journal,
    sourceName: 'Semantic Scholar',
    sourceType: detectSourceType(title, abstract),
    abstract: abstract || 'Resumo disponível via Semantic Scholar. Acesse o artigo completo para mais detalhes.',
    keywords: extractKeywords(title, abstract),
    directUrl: url || paperUrl,
    searchUrl: paperUrl,
    doi,
    imageUrl: undefined, // S2 doesn't provide images in search results
    abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'S2'}. ${title}. ${journal}, ${year}.`,
  };
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429 && attempt < retries) {
      // Rate limited - wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }

    return response;
  }

  // Should not reach here, but just in case
  return fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
}

export async function scrapeSemanticScholar(
  query: string,
  maxResults: number = 20
): Promise<ScientificSource[]> {
  const cached = getCached('semantic_scholar', query);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      query,
      limit: String(Math.min(maxResults, 100)),
      fields: 'title,authors,year,venue,journal,abstract,externalIds,url,citationCount,openAccessPdf',
    });

    const response = await fetchWithRetry(`${S2_API}?${params.toString()}`);

    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.data || [];
    const results = items.map(parseS2Item).filter((r: ScientificSource) => r.title.length > 5);

    setCache('semantic_scholar', query, results);
    return results;
  } catch {
    return [];
  }
}
