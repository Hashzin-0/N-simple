import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { stealthFetch } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';

const ALICE_URL = 'https://www.alice.cnptia.embrapa.br/alice/handle/doc/1/discover';
const INFOTECA_URL = 'https://www.infoteca.cnptia.embrapa.br/infoteca/handle/doc/1/discover';

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
  if (text.includes('boletim') || text.includes('circular') || text.includes('comunicado'))
    return 'boletim_tecnico';
  if (text.includes('ensaio') || text.includes('revisão'))
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

function parseEmbrapaHtml(html: string, baseUrl: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];
  const params = new URLSearchParams({ query: '' });

  $('.item-summary, .ds-artifact-item, .media, .result-item, .artifact-title').each((i, el) => {
    if (i >= maxResults) return false;

    const titleEl = $(el).find('a').first();
    const title = cleanText(titleEl.text());

    if (!title || title.length < 5) return;

    const href = titleEl.attr('href') || '';
    const directUrl = href.startsWith('http')
      ? href
      : baseUrl.split('/handle')[0] + href;

    const metaText = cleanText($(el).find('.authors, .metadata, .artifact-info, .text-muted').text());
    const authors = metaText.split('-')[0]?.trim() || 'Embrapa';
    const year = extractYear(metaText);
    const publication = cleanText($(el).find('.journal, .source, .publisher').text()) || 'Embrapa';

    const abstract = cleanText($(el).find('.abstract, .description, .artifact-abstract').text()) || '';

    const isAlice = baseUrl.includes('alice');
    const sourceType = detectSourceType(title, abstract);

    results.push({
      id: `embrapa-${isAlice ? 'alice' : 'infoteca'}-${i}-${Date.now()}`,
      title,
      authors: authors || 'Embrapa',
      year,
      publication: publication || (isAlice ? 'Embrapa Alice' : 'Embrapa Infoteca-e'),
      sourceName: 'Embrapa',
      sourceType,
      abstract: abstract || 'Resumo não disponível. Consulte o repositório Embrapa para mais detalhes.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl: `${baseUrl}?${params.toString()}`,
      abntCitation: `EMBRAPA. ${title}. ${publication ? `${publication}, ` : ''}${year}.`,
    });
  });

  return results;
}

async function scrapeEmbrapaRepository(
  baseUrl: string,
  query: string,
  maxResults: number
): Promise<ScientificSource[]> {
  const params = new URLSearchParams({ query });
  const url = `${baseUrl}?${params.toString()}`;

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
      const results = parseEmbrapaHtml(html, baseUrl, maxResults);
      if (results.length > 0) return results;
    }
  } catch {
    // fall through to stealth
  }

  // Fallback: puppeteer stealth
  try {
    const result = await stealthFetch(url, { timeoutMs: 20000 });
    if (result.ok) {
      return parseEmbrapaHtml(result.html, baseUrl, maxResults);
    }
  } catch (err) {
    console.warn(`[Embrapa] Stealth fetch failed for ${baseUrl}:`, err);
  }

  return [];
}

export async function scrapeEmbrapa(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('embrapa', query);
  if (cached) return cached;

  const aliceResults = await scrapeEmbrapaRepository(ALICE_URL, query, Math.ceil(maxResults / 2));
  await new Promise((r) => setTimeout(r, 500));
  const infotecaResults = await scrapeEmbrapaRepository(INFOTECA_URL, query, Math.ceil(maxResults / 2));

  const combined = [...aliceResults, ...infotecaResults].slice(0, maxResults);
  setCache('embrapa', query, combined);
  return combined;
}
