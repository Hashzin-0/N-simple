import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';
import { isBrowserAvailable } from '@/lib/stealthBrowser';

const BASE_URL = 'https://scholar.google.com.br';
const SEARCH_URL = 'https://scholar.google.com.br/scholar';

function parseYear(text: string): number {
  const match = text.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractAuthors(text: string): string {
  return text
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .join('; ');
}

function parseScholarHtml(html: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  // Check for CAPTCHA
  if ($('#gs_captcha_ccl').length > 0 || html.includes('gs_captcha')) {
    return [];
  }

  $('.gs_ri').each((i, el) => {
    if (i >= maxResults) return false;

    const titleEl = $(el).find('.gs_rt a');
    const title = cleanText(titleEl.text());
    const directUrl = titleEl.attr('href') || '';

    if (!title) return;

    const authorsRaw = cleanText($(el).find('.gs_a').text());
    const authors = extractAuthors(authorsRaw);

    const snippetEl = $(el).find('.gs_rs');
    const abstract = cleanText(snippetEl.text());

    const metaText = cleanText($(el).find('.gs_a').text());
    const year = parseYear(metaText);

    const publication = cleanText(
      metaText.split('-').slice(1).join('-').trim()
    );

    const citationMatch = $(el).find('.gs_fl a').first().text();
    const citationCount = citationMatch.match(/(\d+)/);
    const citations = citationMatch
      ? `${citationCount ? citationCount[1] : '0'} citações`
      : '';

    const resultsLink = $(el).find('a:contains("Resultados de")').attr('href') || '';
    const searchUrl = resultsLink
      ? `${BASE_URL}${resultsLink}`
      : `${SEARCH_URL}?${new URLSearchParams({ q: title }).toString()}`;

    const sourceType = detectSourceType(title, abstract);

    results.push({
      id: `scholar-${i}-${Date.now()}`,
      title,
      authors: authors || 'Autor não identificado',
      year,
      publication: publication || 'Google Acadêmico',
      sourceName: 'Google Acadêmico',
      sourceType,
      abstract: abstract || 'Resumo não disponível no resultado da busca.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl,
      abntCitation: formatABNTCitation(authors, title, year, publication),
    });
  });

  return results;
}

async function fetchScholarWithStealth(
  url: string,
  maxResults: number
): Promise<ScientificSource[]> {
  // Dynamically import to avoid circular deps
  const { getScholarBrowser } = await import('@/lib/stealthBrowser');

  const browser = await getScholarBrowser();
  if (!browser) return [];
  const page = await browser.newPage();

  try {
    // Set realistic viewport and locale
    await page.setViewport({ width: 1280, height: 900 });

    // Mask navigator.webdriver — the most commonly-checked automation signal
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for results or CAPTCHA
    try {
      await page.waitForSelector('.gs_ri, #gs_captcha_ccl', { timeout: 20000 });
    } catch {
      // timeout — continue with whatever we have
    }

    const html = await page.content();

    // Check for CAPTCHA
    if (html.includes('gs_captcha') || html.includes('show you are not a robot')) {
      return [];
    }

    return parseScholarHtml(html, maxResults);
  } finally {
    await page.close();
  }
}

export async function scrapeGoogleScholar(
  query: string,
  maxResults: number = 25
): Promise<ScientificSource[]> {
  const cached = getCached('scholar', query);
  if (cached) return cached;

  const params = new URLSearchParams({
    hl: 'pt-BR',
    as_sdt: '0,5',
    q: query,
  });
  const url = `${SEARCH_URL}?${params.toString()}`;

  // Strategy 1: Direct fetch with realistic headers
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (response.ok) {
      const html = await response.text();
      if (html.includes('gs_ri') && !html.includes('gs_captcha')) {
        const results = parseScholarHtml(html, maxResults);
        if (results.length > 0) {
          setCache('scholar', query, results);
          return results;
        }
      }
    }
  } catch {
    // fall through to stealth
  }

  // Strategy 2: Stealth browser with anti-bot patches
  // Note: Google Scholar blocks most cloud server IPs even with stealth.
  // Residential proxy or ScraperAPI key required for reliable access.
  if (isBrowserAvailable()) {
    try {
      const results = await fetchScholarWithStealth(url, maxResults);
      if (results.length > 0) {
        setCache('scholar', query, results);
        return results;
      }
    } catch (err) {
      // Expected: Google Scholar blocks automated queries from cloud IPs
    }
  }

  return [];
}

function detectSourceType(
  title: string,
  abstract: string
): ScientificSource['sourceType'] {
  const text = `${title} ${abstract}`.toLowerCase();
  if (text.includes('tese') || text.includes('dissertação') || text.includes('phd') || text.includes('mestrado'))
    return 'tese_dissertacao';
  if (text.includes('livro') || text.includes('manual') || text.includes('handbook'))
    return 'livro_manual';
  if (text.includes('boletim') || text.includes('circular técnica'))
    return 'boletim_tecnico';
  return 'artigo_periodico';
}

function extractKeywords(title: string, abstract: string): string[] {
  const text = `${title} ${abstract}`.toLowerCase();
  const words = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4);

  const frequency: Record<string, number> = {};
  for (const w of words) {
    frequency[w] = (frequency[w] || 0) + 1;
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

function formatABNTCitation(
  authors: string,
  title: string,
  year: number,
  publication: string
): string {
  const authorList = authors
    .split(';')
    .map((a) => a.trim().toUpperCase())
    .join('; ');
  return `${authorList}. ${title}. ${publication ? `${publication}, ` : ''}${year}.`;
}
