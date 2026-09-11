import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { stealthFetch } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';
import { scrapeCrossref } from './crossref';

const CAPES_SEARCH_URL = 'https://www.periodicos.capes.gov.br';

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

function parseCapesHtml(html: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  $('.resultado-item, .item-resultado, .list-group-item, .search-result').each((i, el) => {
    if (i >= maxResults) return false;

    const titleEl = $(el).find('a').first();
    const title = cleanText(titleEl.text());

    if (!title || title.length < 5) return;

    const href = titleEl.attr('href') || '';
    const directUrl = href.startsWith('http') ? href : `${CAPES_SEARCH_URL}${href}`;

    const authors = cleanText(
      $(el).find('.autores, .authors, .meta-authors').text()
    ) || 'Autores não identificados';

    const year = extractYear(
      cleanText($(el).find('.ano, .year, .date, .meta-date').text())
    );

    const publication = cleanText(
      $(el).find('.fonte, .source, .journal, .periódico').text()
    ) || 'Portal de Periódicos CAPES';

    const abstract = cleanText(
      $(el).find('.resumo, .abstract, .description').text()
    );

    const sourceType = detectSourceType(title, abstract);

    results.push({
      id: `capes-${i}-${Date.now()}`,
      title,
      authors,
      year,
      publication,
      sourceName: 'CAPES',
      sourceType,
      abstract: abstract || 'Resumo disponível via Portal CAPES. Acesse o artigo completo.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl: `https://www.periodicos.capes.gov.br/?option=com_psearch&task=search&q=${encodeURIComponent(cleanText(title))}`,
      abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'CAPES'}. ${title}. ${publication}, ${year}.`,
    });
  });

  return results;
}

export async function scrapeCAPES(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('capes', query);
  if (cached) return cached;

  const params = new URLSearchParams({
    option: 'com_pbusca',
    task: 'buscaAvancada',
    termo: query,
  });
  const url = `${CAPES_SEARCH_URL}/index.php?${params.toString()}`;

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
      const results = parseCapesHtml(html, maxResults);
      if (results.length > 0) {
        setCache('capes', query, results);
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
      const results = parseCapesHtml(result.html, maxResults);
      setCache('capes', query, results);
      return results;
    }
  } catch {
    // fall through to Crossref
  }

  // Final fallback: Crossref API (broad academic coverage)
  try {
    const results = await scrapeCrossref(query, maxResults);
    if (results.length > 0) {
      setCache('capes', query, results);
      return results;
    }
  } catch {
    // ignore
  }

  return [];
}
