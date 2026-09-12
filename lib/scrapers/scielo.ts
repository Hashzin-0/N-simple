import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { isBrowserAvailable } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';
import { scrapeCrossref } from './crossref';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function detectSourceType(title: string, abstract: string): ScientificSource['sourceType'] {
  const text = `${title} ${abstract}`.toLowerCase();
  if (text.includes('tese') || text.includes('dissertação'))
    return 'tese_dissertacao';
  if (text.includes('livro') || text.includes('manual'))
    return 'livro_manual';
  if (text.includes('boletim') || text.includes('revisão'))
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

function parseScieloHtml(html: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  // Try multiple selectors for SciELO search results
  const selectors = [
    '.item',
    '.record',
    '.results .item',
    '.results-list .item',
    'div[class*="item"]',
    'div[class*="result"]',
  ];

  for (const selector of selectors) {
    if (results.length > 0) break;

    $(selector).each((i, el) => {
      if (results.length >= maxResults) return false;

      const titleEl = $(el).find('.title, .item-title, h4 a, h3 a, a.title').first();
      const title = cleanText(titleEl.text());

      if (!title || title.length < 5) return;

      const href = titleEl.attr('href') || '';
      const directUrl = href.startsWith('http') ? href : `https://www.scielo.br${href}`;

      const authorsEl = $(el).find('.authors, .item-authors, .meta-authors, .author-list');
      const authors = cleanText(authorsEl.text()) || 'Autores não identificados';

      const yearMatch = cleanText($(el).find('.date, .item-date, .meta-date, .year').text()).match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

      const journal = cleanText(
        $(el).find('.journal, .item-source, .source, .meta-source').text()
      ) || 'SciELO Brasil';

      const abstract = cleanText(
        $(el).find('.abstract, .item-abstract, .description').text()
      );

      const sourceType = detectSourceType(title, abstract);

      results.push({
        id: `scielo-${i}-${Date.now()}`,
        title,
        authors,
        year,
        publication: journal,
        sourceName: 'SciELO',
        sourceType,
        abstract: abstract || 'Resumo disponível no SciELO. Acesse o artigo completo para mais detalhes.',
        keywords: extractKeywords(title, abstract),
        directUrl,
        searchUrl: `https://search.scielo.org/?q=${encodeURIComponent(title)}&lang=pt`,
        abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'SCIELO'}. ${title}. ${journal}, ${year}.`,
      });
    });
  }

  return results;
}

export async function scrapeSciELO(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('scielo', query);
  if (cached) return cached;

  const searchUrl = `https://search.scielo.org/?q=${encodeURIComponent(query)}&lang=pt&count=${maxResults * 2}`;

  // Strategy 1: Direct fetch with realistic headers
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      if (html.length > 1000) {
        const results = parseScieloHtml(html, maxResults);
        if (results.length > 0) {
          setCache('scielo', query, results);
          return results;
        }
      }
    }
  } catch {
    // fall through to stealth
  }

  // Strategy 2: Stealth browser (requires chromium)
  if (isBrowserAvailable()) {
    try {
      const { stealthFetch } = await import('@/lib/stealthBrowser');
      const result = await stealthFetch(searchUrl, {
        waitSelector: '.item, .record, .results .item, .results-list .item',
        timeoutMs: 25000,
      });
      if (result.ok && result.html.length > 1000) {
        const results = parseScieloHtml(result.html, maxResults);
        if (results.length > 0) {
          setCache('scielo', query, results);
          return results;
        }
      }
    } catch (err) {
      console.warn('[SciELO] Stealth fetch failed:', err);
    }
  }

  // Strategy 3: Crossref fallback (broad academic coverage)
  try {
    const results = await scrapeCrossref(query, maxResults);
    if (results.length > 0) {
      setCache('scielo', query, results);
      return results;
    }
  } catch {
    // ignore
  }

  return [];
}
