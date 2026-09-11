import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';

const OPENALEX_API = 'https://api.openalex.org/works';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(work: any): number {
  if (work?.publication_year) return work.publication_year;
  return new Date().getFullYear();
}

function detectSourceType(title: string, abstract: string): ScientificSource['sourceType'] {
  const text = `${title} ${abstract}`.toLowerCase();
  if (text.includes('tese') || text.includes('dissertação'))
    return 'tese_dissertacao';
  if (text.includes('livro') || text.includes('manual'))
    return 'livro_manual';
  if (text.includes('boletim') || text.includes('circular'))
    return 'boletim_tecnico';
  return 'artigo_periodico';
}

function extractKeywords(title: string, abstract: string): string[] {
  const text = `${title} ${abstract}`.toLowerCase();
  const stopwords = new Set([
    'para', 'como', 'mais', 'sobre', 'entre', 'este', 'esta', 'pela', 'pelo',
    'desde', 'foram', 'sendo', 'também', 'pode', 'podem', 'tem', 'sem', 'com',
    'uma', 'dos', 'das', 'nos', 'nas', 'que', 'por', 'sao', 'estudo', 'estudos',
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

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return '';
  const wordPositions: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push([word, pos]);
    }
  }
  wordPositions.sort((a, b) => a[1] - b[1]);
  return wordPositions.map(([word]) => word).join(' ');
}

function parseOpenAlexItem(work: any): ScientificSource {
  const title = cleanText(work.title || '');
  const authors = (work.authorships || [])
    .map((a: any) => a.author?.display_name || '')
    .filter(Boolean)
    .join('; ') || 'CNPEM';

  const year = extractYear(work);
  const journal = work.primary_location?.source?.display_name || 'OpenAlex';
  const abstract = cleanText(reconstructAbstract(work.abstract_inverted_index));
  const doi = work.doi?.replace('https://doi.org/', '');
  const url = work.primary_location?.landing_page_url || work.open_access?.oa_url;

  const imageUrl = work.primary_location?.source?.logo_url || undefined;

  return {
    id: `cnpem-openalex-${work.id?.replace('https://openalex.org/', '') || Date.now()}`,
    title,
    authors,
    year,
    publication: `${journal} (via CNPEM)`,
    sourceName: 'CNPEM',
    sourceType: detectSourceType(title, abstract),
    abstract: abstract || 'Pesquisa disponível via CNPEM/OpenAlex.',
    keywords: extractKeywords(title, abstract),
    directUrl: url,
    searchUrl: `https://openalex.org/works?search=${encodeURIComponent(title)}`,
    doi,
    imageUrl,
    abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'CNPEM'}. ${title}. ${journal}, ${year}.`,
  };
}

// CNPEM OpenAlex institution ID: I4210152696
const CNPEM_OPENALEX_ID = 'I4210152696';

async function searchByAffiliation(
  query: string,
  maxResults: number
): Promise<ScientificSource[]> {
  try {
    const params = new URLSearchParams({
      filter: `authorships.institutions.id:${CNPEM_OPENALEX_ID}`,
      search: query,
      per_page: String(Math.min(maxResults, 50)),
      sort: 'relevance_score:desc',
      select: 'id,title,authorships,publication_year,primary_location,abstract_inverted_index,doi,open_access',
    });

    const response = await fetch(`${OPENALEX_API}?${params.toString()}`, {
      headers: {
        'User-Agent': 'N-Pro/1.0 (mailto:contato@agriconomica.com.br)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.results || [];
    return items.map(parseOpenAlexItem).filter((r: ScientificSource) => r.title.length > 5);
  } catch {
    return [];
  }
}

async function searchSemanticScholar(
  query: string,
  maxResults: number
): Promise<ScientificSource[]> {
  try {
    const searchQuery = `${query} CNPEM`;
    const params = new URLSearchParams({
      query: searchQuery,
      limit: String(Math.min(maxResults, 50)),
      fields: 'title,authors,year,venue,journal,abstract,externalIds,url,citationCount',
    });

    const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.data || [];
    const results: ScientificSource[] = [];

    for (const paper of items) {
      if (results.length >= maxResults) break;

      const title = cleanText(paper.title || '');
      if (title.length < 5) continue;

      const authors = (paper.authors || []).map((a: any) => a.name || '').filter(Boolean).join('; ') || 'CNPEM';
      const abstract = cleanText(paper.abstract || '');
      const doi = paper.externalIds?.DOI;
      const url = paper.url;

      results.push({
        id: `cnpem-s2-${paper.paperId || Date.now()}-${results.length}`,
        title,
        authors,
        year: paper.year || new Date().getFullYear(),
        publication: paper.venue || paper.journal?.name || 'Semantic Scholar',
        sourceName: 'CNPEM',
        sourceType: detectSourceType(title, abstract),
        abstract: abstract || 'Pesquisa disponível via CNPEM/Semantic Scholar.',
        keywords: extractKeywords(title, abstract),
        directUrl: url,
        searchUrl: url || `https://www.semanticscholar.org/search?q=${encodeURIComponent(title)}`,
        doi,
        abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'CNPEM'}. ${title}. ${paper.venue || 'S2'}, ${paper.year || 's.d.'}.`,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function scrapeCNPEM(
  query: string,
  maxResults: number = 15
): Promise<ScientificSource[]> {
  const cached = getCached('cnpem', query);
  if (cached) return cached;

  // Strategy 1: OpenAlex filtered by CNPEM affiliation (best coverage)
  try {
    const results = await searchByAffiliation(query, maxResults);
    if (results.length > 0) {
      setCache('cnpem', query, results);
      return results;
    }
  } catch {
    // fall through
  }

  // Strategy 2: Semantic Scholar filtered by CNPEM
  try {
    const results = await searchSemanticScholar(query, maxResults);
    if (results.length > 0) {
      setCache('cnpem', query, results);
      return results;
    }
  } catch {
    // ignore
  }

  return [];
}
