import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';

const OPENALEX_API = 'https://api.openalex.org/works';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(work: any): number {
  if (work?.publication_year) return work.publication_year;
  if (work?.created_date) return parseInt(work.created_date.slice(0, 4), 10);
  return new Date().getFullYear();
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
  const title = cleanText(work.title || work.display_name || '');
  const authors = (work.authorships || [])
    .map((a: any) => a.author?.display_name || '')
    .filter(Boolean)
    .join('; ') || 'Autores não identificados';

  const year = extractYear(work);
  const journal = work.primary_location?.source?.display_name || 'OpenAlex';
  const abstract = cleanText(reconstructAbstract(work.abstract_inverted_index));
  const doi = work.doi?.replace('https://doi.org/', '');
  const url = work.primary_location?.landing_page_url || work.open_access?.oa_url;

  // OpenAlex thumbnail: use source logo or best OA location
  const imageUrl = work.primary_location?.source?.logo_url
    || work.primary_location?.source?.host_organization_lineage_urls?.[0]
    || undefined;

  return {
    id: `openalex-${work.id?.replace('https://openalex.org/', '') || Date.now()}`,
    title,
    authors,
    year,
    publication: journal,
    sourceName: 'OpenAlex',
    sourceType: detectSourceType(title, abstract),
    abstract: abstract || 'Resumo disponível via OpenAlex. Acesse o artigo completo para mais detalhes.',
    keywords: extractKeywords(title, abstract),
    directUrl: url,
    searchUrl: `https://openalex.org/works?search=${encodeURIComponent(title)}`,
    doi,
    imageUrl,
    abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'OPENALEX'}. ${title}. ${journal}, ${year}.`,
  };
}

export async function scrapeOpenAlex(
  query: string,
  maxResults: number = 25
): Promise<ScientificSource[]> {
  const cached = getCached('openalex', query);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      search: query,
      per_page: String(maxResults),
      sort: 'relevance_score:desc',
      select: 'id,title,display_name,authorships,publication_year,primary_location,abstract_inverted_index,doi,open_access',
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
    const results = items.map(parseOpenAlexItem).filter((r: ScientificSource) => r.title.length > 5);

    setCache('openalex', query, results);
    return results;
  } catch {
    return [];
  }
}
