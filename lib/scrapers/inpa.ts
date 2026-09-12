import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { isBrowserAvailable } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';

const INPA_API = 'https://ri.inpa.gov.br/server/api';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(text: string): number {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

function detectSourceType(title: string, abstract: string): ScientificSource['sourceType'] {
  const text = `${title} ${abstract}`.toLowerCase();
  if (text.includes('tese') || text.includes('dissertação') || text.includes('phd'))
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

function getMetaValue(metadata: Record<string, any[]>, key: string): string {
  const entries = metadata[key];
  if (!entries || !Array.isArray(entries) || entries.length === 0) return '';
  return String(entries[0]?.value || '');
}

function getMetaValues(metadata: Record<string, any[]>, key: string): string[] {
  const entries = metadata[key];
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map((e) => String(e?.value || '')).filter(Boolean);
}

function parseDspaceObject(obj: any): ScientificSource | null {
  const idx = obj._embedded?.indexableObject;
  if (!idx) return null;

  const metadata: Record<string, any[]> = idx.metadata || {};

  const title = cleanText(getMetaValue(metadata, 'dc.title'));
  if (!title || title.length < 5) return null;

  const creators = getMetaValues(metadata, 'dc.creator');
  const authors = creators.length > 0 ? creators.join('; ') : 'INPA';

  const date = getMetaValue(metadata, 'dc.date.accessioned') || getMetaValue(metadata, 'dc.date');
  const year = extractYear(date || title);

  const abstract = cleanText(getMetaValue(metadata, 'dc.description.abstract'));
  const uri = getMetaValue(metadata, 'dc.identifier.uri');
  const doi = getMetaValue(metadata, 'dc.identifier.doi');

  const handle = idx.handle || '';
  const directUrl = uri || (handle ? `https://ri.inpa.gov.br/handle/${handle}` : '');
  const searchUrl = `https://ri.inpa.gov.br/discover?query=${encodeURIComponent(title)}`;

  const subjects = getMetaValues(metadata, 'dc.subject');

  return {
    id: `inpa-${idx.uuid || Date.now()}`,
    title,
    authors,
    year,
    publication: 'INPA - Instituto Nacional de Pesquisas da Amazônia',
    sourceName: 'INPA',
    sourceType: detectSourceType(title, abstract),
    abstract: abstract || 'Pesquisa disponível no repositório do INPA.',
    keywords: subjects.length > 0 ? subjects.slice(0, 6) : extractKeywords(title, abstract),
    directUrl,
    searchUrl,
    doi: doi || undefined,
    abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'INPA'}. ${title}. INPA, ${year}. Disponível em: ${directUrl}.`,
  };
}

async function searchDspaceApi(query: string, maxResults: number): Promise<ScientificSource[]> {
  try {
    const params = new URLSearchParams({
      query,
      dsoType: 'ITEM',
      page: '0',
      size: String(Math.min(maxResults, 50)),
    });

    const response = await fetch(`${INPA_API}/discover/search/objects?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'N-Pro/1.0' },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const objects = data._embedded?.searchResult?._embedded?.objects || [];
    const results: ScientificSource[] = [];

    for (const obj of objects) {
      if (results.length >= maxResults) break;
      const parsed = parseDspaceObject(obj);
      if (parsed) results.push(parsed);
    }

    return results;
  } catch {
    return [];
  }
}

export async function scrapeINPA(
  query: string,
  maxResults: number = 15
): Promise<ScientificSource[]> {
  const cached = getCached('inpa', query);
  if (cached) return cached;

  // Strategy 1: DSpace REST API
  try {
    const results = await searchDspaceApi(query, maxResults);
    if (results.length > 0) {
      setCache('inpa', query, results);
      return results;
    }
  } catch {
    // fall through
  }

  // Strategy 2: Stealth browser fallback
  if (isBrowserAvailable()) {
    const searchUrl = `https://ri.inpa.gov.br/discover?query=${encodeURIComponent(query)}`;
    try {
      const { stealthFetch } = await import('@/lib/stealthBrowser');
      const result = await stealthFetch(searchUrl, {
        waitSelector: '.item-list, .artifact-title, h3.title',
        timeoutMs: 25000,
      });
      if (result.ok && result.html.length > 5000) {
        const cheerio = await import('cheerio');
        const $ = cheerio.load(result.html);
        const results: ScientificSource[] = [];

        $('h3.title a, .artifact-title a, .item-list .title a').each((_i: number, el: any) => {
          if (results.length >= maxResults) return false;
          const title = cleanText($(el).text());
          if (!title || title.length < 5) return;

          const href = $(el).attr('href') || '';
          const directUrl = href.startsWith('http') ? href : `https://ri.inpa.gov.br${href}`;

          results.push({
            id: `inpa-stealth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title,
            authors: 'INPA',
            year: new Date().getFullYear(),
            publication: 'INPA - Instituto Nacional de Pesquisas da Amazônia',
            sourceName: 'INPA',
            sourceType: 'artigo_periodico',
            abstract: 'Pesquisa disponível no repositório do INPA.',
            keywords: extractKeywords(title, ''),
            directUrl,
            searchUrl,
            abntCitation: `INPA. ${title}. INPA, ${new Date().getFullYear()}.`,
          });
        });

        if (results.length > 0) {
          setCache('inpa', query, results);
          return results;
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
}
