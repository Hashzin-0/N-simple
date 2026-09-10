import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';

const BDTD_URL = 'https://bdtd.ibict.br/vufind/Search/Results';

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

export async function scrapeBDTD(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  try {
    const params = new URLSearchParams({
      lookfor: query,
      type: 'AllFields',
    });

    const response = await fetch(`${BDTD_URL}?${params.toString()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      console.warn(`[BDTD] HTTP ${response.status} for query: ${query}`);
      return [];
    }

    const html = await response.text();
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
        searchUrl: `https://bdtd.ibict.br/vufind/Search/Results?lookfor=${encodeURIComponent(query)}&type=AllFields`,
        abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'BDTD'}. ${title}. ${year}. Dissertação/Tese - ${institution}.`,
      });
    });

    return results;
  } catch (error) {
    console.error('[BDTD] Error scraping BDTD:', error);
    return [];
  }
}
