import * as cheerio from 'cheerio';
import PDFParser from 'pdf2json';
import { isBrowserAvailable, stealthFetch } from '@/lib/stealthBrowser';
import { FULL_TEXT_FETCH_TIMEOUT_MS, MAX_FULL_TEXT_CHARS } from './config';

/**
 * Lê de verdade o conteúdo de cada fonte — não apenas título/resumo
 * trazidos pelo scraper de listagem. Isso é o que permite ao motor
 * "entender o assunto" em vez de confiar só em metadados curtos.
 */

interface FullTextResult {
  text: string;
  ok: boolean;
  fromCache: boolean;
}

// Cache em memória por processo (evita re-baixar a mesma URL na mesma execução).
const inMemoryCache = new Map<string, string>();

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

function normalizeWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function extractMainText($: cheerio.CheerioAPI): string {
  $('script, style, nav, footer, header, aside, noscript, iframe, .sidebar, .menu, .ad, .advertisement, .cookie, .popup, .navbar, .breadcrumb').remove();

  const candidates = [
    'article',
    'main',
    '[role="main"]',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.content',
    '.fulltext',
    '.full-text',
    '#texto-artigo',
    '.abstract',
  ];

  let best = '';
  for (const selector of candidates) {
    const text = $(selector).text();
    if (text && text.trim().length > best.length) {
      best = text;
    }
  }

  if (best.trim().length > 200) return normalizeWhitespace(best);

  // fallback: parágrafos do body inteiro
  const paragraphs = $('p')
    .map((_, el) => $(el).text())
    .get()
    .filter((p) => p.trim().length > 40);

  if (paragraphs.length > 0) {
    return normalizeWhitespace(paragraphs.join('\n\n'));
  }

  return normalizeWhitespace($('body').text() || '');
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(FULL_TEXT_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = await response.text();
    if (html.length < 500) return null;
    return html;
  } catch {
    return null;
  }
}

async function fetchHtmlViaStealth(url: string): Promise<string | null> {
  if (!isBrowserAvailable()) return null;
  try {
    const result = await stealthFetch(url, { timeoutMs: FULL_TEXT_FETCH_TIMEOUT_MS });
    if (!result.ok || result.html.length < 500) return null;
    return result.html;
  } catch {
    return null;
  }
}

async function fetchPdfText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/pdf,*/*' },
      signal: AbortSignal.timeout(FULL_TEXT_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parser = new PDFParser(undefined, true);
    const text = await new Promise<string>((resolve, reject) => {
      parser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
        reject(errData instanceof Error ? errData : errData.parserError);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.on('pdfParser_dataReady', () => {
        resolve((parser as any).getRawTextContent() as string);
      });
      parser.parseBuffer(buffer);
    });

    if (!text || text.trim().length < 100) return null;
    return text;
  } catch {
    return null;
  }
}

function looksLikePdf(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

/**
 * Busca o texto integral de uma fonte pela URL direta. Retorna `ok: false`
 * quando não foi possível ler nada além do que já tínhamos (abstract) —
 * o chamador deve então recair no abstract/keywords como aproximação.
 */
export async function fetchFullText(url: string | undefined): Promise<FullTextResult> {
  if (!url) return { text: '', ok: false, fromCache: false };

  const cached = inMemoryCache.get(url);
  if (cached !== undefined) {
    return { text: cached, ok: cached.length > 0, fromCache: true };
  }

  let raw: string | null = null;

  if (looksLikePdf(url)) {
    raw = await fetchPdfText(url);
  } else {
    const html = (await fetchHtml(url)) || (await fetchHtmlViaStealth(url));
    if (html) {
      const $ = cheerio.load(html);
      raw = extractMainText($);
    }
  }

  const text = raw ? normalizeWhitespace(raw).slice(0, MAX_FULL_TEXT_CHARS) : '';
  inMemoryCache.set(url, text);

  return { text, ok: text.length > 200, fromCache: false };
}
