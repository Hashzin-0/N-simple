import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { stealthFetch } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';
import { scrapeCrossref } from './crossref';

const IPEA_SEARCH_URL = 'https://www.ipea.gov.br/pesquisa';
// Ipeadata OData API — RESTful endpoint for all IPEA data
const IPEADATA_ODATA = 'https://ipeadata.gov.br/api/odata4';

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

function parseIpeaHtml(html: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  $('h2, h3').each((i, el) => {
    if (results.length >= maxResults) return false;

    const title = cleanText($(el).text());
    if (!title || title.length < 10) return;

    const link = $(el).find('a').attr('href') || $(el).closest('a').attr('href') || '';
    const directUrl = link.startsWith('http') ? link : `https://www.ipea.gov.br${link}`;

    const container = $(el).closest('.item, .result, .publication, article, .card, section, div');
    const authors = cleanText(container.find('.authors, .author, .researcher').text()) || 'IPEA';
    const year = extractYear(cleanText(container.find('.date, .year, .period').text()));
    const abstract = cleanText(container.find('.abstract, .description, .summary, .resumo').text());

    results.push({
      id: `ipea-${results.length}-${Date.now()}`,
      title,
      authors,
      year,
      publication: 'IPEA - Instituto de Pesquisa Econômica Aplicada',
      sourceName: 'IPEA',
      sourceType: 'boletim_tecnico',
      abstract: abstract || 'Pesquisa disponível no IPEA. Acesse o portal para mais detalhes.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl: `${IPEA_SEARCH_URL}?q=${encodeURIComponent(title)}`,
      abntCitation: `${authors.split(';')[0]?.trim()?.toUpperCase() || 'IPEA'}. ${title}. IPEA, ${year}. Disponível em: ${directUrl}.`,
    });
  });

  return results;
}

async function searchIpeadataApi(query: string, maxResults: number): Promise<ScientificSource[]> {
  try {
    // Ipeadata OData: search across themes
    const searchTerms = query.split(/\s+/).filter(Boolean);
    const filterParts = searchTerms.map(
      (term) => `substringof('${encodeURIComponent(term)}',NOME_INDICADOR) or substringof('${encodeURIComponent(term)}',FONTE_INDICADOR)`
    );
    const filter = filterParts.join(' and ');

    const params = new URLSearchParams({
      $filter: filter,
      $top: String(Math.min(maxResults, 50)),
      $orderby: 'NOME_INDICADOR asc',
    });

    const response = await fetch(`${IPEADATA_ODATA}/Indicadores?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items = data?.value || [];
    const results: ScientificSource[] = [];

    for (const item of items) {
      if (results.length >= maxResults) break;

      const title = cleanText(item.NOME_INDICADOR || '');
      if (!title || title.length < 5) continue;

      const source = cleanText(item.FONTE_INDICADOR || item.FONTE_DADOS || '');
      const theme = cleanText(item.NOME_TEMA || '');
      const abstract = source ? `Indicador: ${title}. Fonte: ${source}.${theme ? ` Tema: ${theme}.` : ''}` : '';

      // Ipeadata URL pattern
      const directUrl = `https://ipeadata.gov.br/Exibirindicador.aspx?cod=${item.COD_INDICADOR || ''}`;

      results.push({
        id: `ipeadata-${item.COD_INDICADOR || Date.now()}-${results.length}`,
        title,
        authors: source || 'IPEA - Instituto de Pesquisa Econômica Aplicada',
        year: item.ANO_INICIO ? parseInt(String(item.ANO_INICIO), 10) : new Date().getFullYear(),
        publication: theme ? `IPEA - ${theme}` : 'IPEA - Instituto de Pesquisa Econômica Aplicada',
        sourceName: 'IPEA',
        sourceType: 'boletim_tecnico',
        abstract,
        keywords: extractKeywords(title, abstract),
        directUrl,
        searchUrl: `https://ipeadata.gov.br/Exibirindicador.aspx?cod=${item.COD_INDICADOR || ''}`,
        abntCitation: `IPEA. ${title}. Instituto de Pesquisa Econômica Aplicada, ${item.ANO_INICIO || 's.d.'}. Disponível em: ${directUrl}.`,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function scrapeIPEA(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('ipea', query);
  if (cached) return cached;

  // Strategy 1: Ipeadata OData API (official, fast, structured)
  try {
    const results = await searchIpeadataApi(query, maxResults);
    if (results.length > 0) {
      setCache('ipea', query, results);
      return results;
    }
  } catch {
    // fall through
  }

  // Strategy 2: Stealth browser search
  const params = new URLSearchParams({
    q: query,
    limit: String(maxResults),
  });
  const url = `${IPEA_SEARCH_URL}?${params.toString()}`;

  try {
    const result = await stealthFetch(url, {
      waitSelector: 'h2, h3',
      timeoutMs: 30000,
    });
    if (result.ok) {
      const results = parseIpeaHtml(result.html, maxResults);
      if (results.length > 0) {
        setCache('ipea', query, results);
        return results;
      }
    }
  } catch {
    // fall through
  }

  // Strategy 3: Direct fetch
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      const results = parseIpeaHtml(html, maxResults);
      if (results.length > 0) {
        setCache('ipea', query, results);
        return results;
      }
    }
  } catch {
    // fall through
  }

  // Strategy 4: Crossref fallback
  try {
    const results = await scrapeCrossref(query, maxResults);
    if (results.length > 0) {
      setCache('ipea', query, results);
      return results;
    }
  } catch {
    // ignore
  }

  return [];
}
