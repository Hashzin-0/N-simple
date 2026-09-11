import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';

const CROSSREF_API = 'https://api.crossref.org/works';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(dateObj: Record<string, any> | undefined): number {
  if (dateObj?.['date-parts']?.[0]?.[0]) {
    const val = dateObj['date-parts'][0][0];
    return typeof val === 'number' ? val : parseInt(String(val), 10);
  }
  if (dateObj?.['date-time']) {
    return parseInt(dateObj['date-time'].slice(0, 4), 10);
  }
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

function extractImageUrl(work: any): string | undefined {
  // Crossref doesn't usually have images, but check for available links
  const link = work?.link?.find((l: any) =>
    l['content-type']?.includes('image') || l['content-type']?.includes('unspecified')
  );
  return link?.URL;
}

function parseCrossrefItem(item: any): ScientificSource {
  const title = cleanText(
    Array.isArray(item.title) ? item.title[0] : item.title || ''
  );
  const authors = (item.author || [])
    .map((a: any) => {
      const given = a.given || '';
      const family = a.family || '';
      return `${given} ${family}`.trim();
    })
    .filter(Boolean)
    .join('; ') || 'Autores não identificados';

  const year = extractYear(item['published-print'] || item['published-online'] || item.created);
  const journal = cleanText(
    Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'] || ''
  ) || 'Crossref';

  const abstract = cleanText(item.abstract || '').replace(/<[^>]*>/g, '');
  const doi = item.DOI;
  const url = item.URL;

  return {
    id: `crossref-${item['DOI'] || Date.now()}`,
    title,
    authors,
    year,
    publication: journal,
    sourceName: 'Crossref',
    sourceType: detectSourceType(title, abstract),
    abstract: abstract || 'Resumo disponível via Crossref. Acesse o artigo completo para mais detalhes.',
    keywords: extractKeywords(title, abstract),
    directUrl: url,
    searchUrl: `https://search.crossref.org/?q=${encodeURIComponent(title)}`,
    doi,
    imageUrl: extractImageUrl(item),
    abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'CROSSREF'}. ${title}. ${journal}, ${year}. DOI: ${doi}.`,
  };
}

export async function scrapeCrossref(
  query: string,
  maxResults: number = 25
): Promise<ScientificSource[]> {
  const cached = getCached('crossref', query);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      query,
      rows: String(maxResults),
      sort: 'relevance',
      order: 'desc',
      select: 'DOI,title,author,container-title,abstract,published-print,published-online,URL,link,created',
    });

    const response = await fetch(`${CROSSREF_API}?${params.toString()}`, {
      headers: {
        'User-Agent': 'N-Pro/1.0 (mailto:contato@agriconomica.com.br)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.message?.items || [];
    const results = items.map(parseCrossrefItem).filter((r: ScientificSource) => r.title.length > 5);

    setCache('crossref', query, results);
    return results;
  } catch {
    return [];
  }
}
