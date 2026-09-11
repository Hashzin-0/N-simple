import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { stealthFetch } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';
import { scrapeCrossref } from './crossref';

const BDTD_URL = 'https://bdtd.ibict.br/vufind/Search/Results';
// OAI-PMH endpoint for BDTD
const BDTD_OAI = 'http://bdtd.ibict.br/oai/request';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(text: string): number {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

function detectSourceType(title: string, abstract: string): ScientificSource['sourceType'] {
  const text = `${title} ${abstract}`.toLowerCase();
  if (text.includes('tese de doutorado') || text.includes('phd thesis'))
    return 'tese_dissertacao';
  if (text.includes('dissertação') || text.includes('mestrado'))
    return 'tese_dissertacao';
  return 'tese_dissertacao';
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

function parseBdtdHtml(html: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  $('.result-item, .media, .record, .list-group-item').each((i, el) => {
    if (i >= maxResults) return false;

    const titleEl = $(el).find('a').first();
    const title = cleanText(titleEl.text());

    if (!title || title.length < 5) return;

    const href = titleEl.attr('href') || '';
    const directUrl = href.startsWith('http')
      ? href
      : `https://bdtd.ibict.br${href}`;

    const authors = cleanText(
      $(el).find('.authors, .author-list, .media-body .text-muted').first().text()
    ) || 'Autor não identificado';

    const year = extractYear(
      cleanText($(el).find('.date, .year, .text-muted').text())
    );

    const institution = cleanText(
      $(el).find('.institution, .publisher, .media-body .text-muted').last().text()
    ) || 'BDTD / IBICT';

    const abstract = cleanText(
      $(el).find('.description, .abstract, .summary').text()
    );

    results.push({
      id: `bdtd-${i}-${Date.now()}`,
      title,
      authors,
      year,
      publication: institution,
      sourceName: 'BDTD',
      sourceType: detectSourceType(title, abstract),
      abstract: abstract || 'Dissertação/tese disponível no BDTD. Acesse o repositório para o texto completo.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl: `https://bdtd.ibict.br/vufind/Search/Results?lookfor=${encodeURIComponent(title)}&type=AllFields`,
      abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'BDTD'}. ${title}. ${year}. Dissertação/Tese - ${institution}.`,
    });
  });

  return results;
}

async function searchBdtdOai(query: string, maxResults: number): Promise<ScientificSource[]> {
  try {
    // Try OAI-PMH ListRecords with OAI_DC metadata
    const params = new URLSearchParams({
      verb: 'ListRecords',
      metadataPrefix: 'oai_dc',
    });

    // OAI-PMH doesn't support keyword search, so we fetch a batch and filter
    const response = await fetch(`${BDTD_OAI}?${params.toString()}`, {
      headers: {
        Accept: 'application/xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const queryLower = query.toLowerCase();

    // Parse OAI-DC records from XML
    const records = xml.split('<record>').slice(1); // split by records
    const results: ScientificSource[] = [];

    for (const record of records) {
      if (results.length >= maxResults) break;

      // Extract fields from OAI-DC
      const titleMatch = record.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      const creatorMatch = record.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      const dateMatch = record.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
      const descMatch = record.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
      const identifierMatch = record.match(/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/i);
      const subjectMatch = record.match(/<dc:subject[^>]*>([\s\S]*?)<\/dc:subject>/i);

      const title = (titleMatch?.[1] || '').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 5) continue;

      // Check relevance
      const textToSearch = `${title} ${descMatch?.[1] || ''}`.toLowerCase();
      const words = queryLower.split(/\s+/);
      const hasMatch = words.some(w => textToSearch.includes(w));
      if (!hasMatch) continue;

      const authors = (creatorMatch?.[1] || '').replace(/\s+/g, ' ').trim() || 'Autor não identificado';
      const yearStr = (dateMatch?.[1] || '').slice(0, 4);
      const year = parseInt(yearStr, 10) || new Date().getFullYear();
      const abstract = (descMatch?.[1] || '').replace(/\s+/g, ' ').trim();
      const identifier = (identifierMatch?.[1] || '').replace(/\s+/g, ' ').trim();

      let directUrl = identifier;
      if (!identifier.startsWith('http')) {
        directUrl = `https://bdtd.ibict.br/vufind/Search/Results?lookfor=${encodeURIComponent(title)}&type=AllFields`;
      }

      const keywords = subjectMatch
        ? (subjectMatch[1] || '').replace(/\s+/g, ' ').trim().split(';').map(s => s.trim()).filter(s => s.length > 2)
        : extractKeywords(title, abstract);

      results.push({
        id: `bdtd-oai-${Date.now()}-${results.length}`,
        title,
        authors,
        year,
        publication: 'BDTD / IBICT',
        sourceName: 'BDTD',
        sourceType: detectSourceType(title, abstract),
        abstract: abstract || 'Dissertação/tese disponível no BDTD. Acesse o repositório para o texto completo.',
        keywords,
        directUrl,
        searchUrl: `https://bdtd.ibict.br/vufind/Search/Results?lookfor=${encodeURIComponent(title)}&type=AllFields`,
        abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'BDTD'}. ${title}. ${year}. Dissertação/Tese.`,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function scrapeBDTD(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('bdtd', query);
  if (cached) return cached;

  // Strategy 1: Direct search via BDTD web interface
  const params = new URLSearchParams({
    lookfor: query,
    type: 'AllFields',
  });
  const url = `${BDTD_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      const results = parseBdtdHtml(html, maxResults);
      if (results.length > 0) {
        setCache('bdtd', query, results);
        return results;
      }
    }
  } catch {
    // fall through
  }

  // Strategy 2: Stealth browser
  try {
    const result = await stealthFetch(url, { timeoutMs: 20000 });
    if (result.ok) {
      const results = parseBdtdHtml(result.html, maxResults);
      if (results.length > 0) {
        setCache('bdtd', query, results);
        return results;
      }
    }
  } catch {
    // fall through
  }

  // Strategy 3: OAI-PMH endpoint
  try {
    const results = await searchBdtdOai(query, maxResults);
    if (results.length > 0) {
      setCache('bdtd', query, results);
      return results;
    }
  } catch {
    // fall through
  }

  // Strategy 4: Crossref fallback
  try {
    const results = await scrapeCrossref(query, maxResults);
    if (results.length > 0) {
      setCache('bdtd', query, results);
      return results;
    }
  } catch {
    // ignore
  }

  return [];
}
