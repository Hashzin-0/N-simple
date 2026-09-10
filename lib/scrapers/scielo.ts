import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { stealthFetch } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';

const SCIELO_SEARCH_URL = 'https://search.scielo.org/';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(text: string): number {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
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

  $('.item, .record, .results .item').each((i, el) => {
    if (i >= maxResults) return false;

    const titleEl = $(el).find('.title, .item-title, h4 a, h3 a').first();
    const title = cleanText(titleEl.text());

    if (!title || title.length < 5) return;

    const href = titleEl.attr('href') || '';
    const directUrl = href.startsWith('http') ? href : `https://www.scielo.br${href}`;

    const authorsEl = $(el).find('.authors, .item-authors, .meta-authors');
    const authors = cleanText(authorsEl.text()) || 'Autores não identificados';

    const year = extractYear(
      cleanText($(el).find('.date, .item-date, .meta-date, .year').text())
    );

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

  return results;
}

export async function scrapeSciELO(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('scielo', query);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: query,
    lang: 'pt',
    count: String(maxResults * 2),
    from: '0',
    output: 'site',
    sort: '',
    format: 'summary',
    page: '1',
  });
  const url = `${SCIELO_SEARCH_URL}?${params.toString()}`;

  // Try direct fetch first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const results = parseScieloHtml(html, maxResults);
      if (results.length > 0) {
        setCache('scielo', query, results);
        return results;
      }
    }
  } catch {
    // fall through to stealth
  }

  // Fallback: puppeteer stealth
  try {
    const result = await stealthFetch(url, { timeoutMs: 20000 });
    if (result.ok) {
      const results = parseScieloHtml(result.html, maxResults);
      setCache('scielo', query, results);
      return results;
    }
  } catch (err) {
    console.warn('[SciELO] Stealth fetch failed:', err);
  }

  return [];
}
