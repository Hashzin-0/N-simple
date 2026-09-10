import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';

const CNPEM_SEARCH_URL = 'https://cnpem.br/pt-br/pesquisa';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractYear(text: string): number {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
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

function parseCnpemHtml(html: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  $('.item, .result, .publication, article').each((i, el) => {
    if (i >= maxResults) return false;

    const titleEl = $(el).find('h2, h3, h4, .title, .item-title').first();
    const title = cleanText(titleEl.text());

    if (!title || title.length < 5) return;

    const href = titleEl.find('a').attr('href') || $(el).find('a').first().attr('href') || '';
    const directUrl = href.startsWith('http') ? href : `https://cnpem.br${href}`;

    const authors = cleanText($(el).find('.authors, .author, .meta-authors').text()) || 'CNPEM';

    const year = extractYear(cleanText($(el).find('.date, .year, .meta-date').text()));

    const abstract = cleanText($(el).find('.abstract, .description, .resume').text());

    results.push({
      id: `cnpem-${i}-${Date.now()}`,
      title,
      authors,
      year,
      publication: 'CNPEM - Centro Nacional de Pesquisa em Energia e Materiais',
      sourceName: 'CNPEM' as const,
      sourceType: 'boletim_tecnico' as const,
      abstract: abstract || 'Pesquisa disponível no CNPEM. Acesse o portal para mais detalhes.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl: `https://cnpem.br/pt-br/pesquisa?q=${encodeURIComponent(title)}`,
      abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'CNPEM'}. ${title}. CNPEM, ${year}. Disponível em: ${directUrl}.`,
    });
  });

  return results;
}

export async function scrapeCNPEM(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('cnpem', query);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: query,
    limit: String(maxResults),
  });
  const url = `${CNPEM_SEARCH_URL}?${params.toString()}`;

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
      const results = parseCnpemHtml(html, maxResults);
      if (results.length > 0) {
        setCache('cnpem', query, results);
        return results;
      }
    }
  } catch (err) {
    console.warn('[CNPEM] Fetch failed:', err);
  }

  return [];
}
