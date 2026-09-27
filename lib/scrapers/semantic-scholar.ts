import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';
import { searchSemanticScholarPapers } from '@/lib/scrapers/semanticScholarClient';

const S2_FIELDS =
  'title,authors,year,venue,journal,abstract,externalIds,url,citationCount,openAccessPdf';

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

/**
 * Busca no Semantic Scholar.
 *
 * Erros de rate limit/HTTP NÃO são mais engolidos: o cliente lança
 * `SemanticScholarError`, que sobe até `searchAllSourcesWithProgress` e vira
 * chip vermelho na UI (`scraper_error`) em vez de um verde "(0)" mentiroso.
 * `[]` só acontece quando a API respondeu 200 sem resultados.
 */
export async function scrapeSemanticScholar(
  query: string,
  maxResults: number = 20
): Promise<ScientificSource[]> {
  const cached = getCached('semantic_scholar', query);
  if (cached) return cached;

  const papers = await searchSemanticScholarPapers(query, {
    maxResults,
    fields: S2_FIELDS,
  });

  const results = papers.map(parseS2Item).filter((r: ScientificSource) => r.title.length > 5);

  setCache('semantic_scholar', query, results);
  return results;
}
