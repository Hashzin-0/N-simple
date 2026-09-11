import * as cheerio from 'cheerio';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { stealthFetch } from '@/lib/stealthBrowser';
import { getCached, setCache } from '@/lib/scraperCache';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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

function parseEmbrapaHtml(html: string, searchUrl: string, maxResults: number): ScientificSource[] {
  const $ = cheerio.load(html);
  const results: ScientificSource[] = [];

  // Embrapa has .conteudo elements - first 10 are usually images, rest are news/articles
  // We skip images (tipo-conteudo = "Imagem") and focus on actual content
  $('.conteudo').each((i, el) => {
    if (results.length >= maxResults) return false;

    const tipo = $(el).find('.tipo-conteudo').text().trim();
    // Skip image results
    if (tipo === 'Imagem') return;

    // For items with h3.titulo, extract from there
    const titleEl = $(el).find('h3.titulo a, .titulo a').first();
    let title = cleanText(titleEl.text());

    // Fallback: try h3 directly
    if (!title || title.length < 5) {
      title = cleanText($(el).find('h3').first().text());
    }

    if (!title || title.length < 5) return;

    const link = titleEl.attr('href') || $(el).find('h3 a').attr('href') || '';
    const directUrl = link.startsWith('http')
      ? link
      : `https://www.embrapa.br${link}`;

    // Extract author from .autoria
    const rawAuthor = cleanText($(el).find('.autoria').text())
      .replace(/^Por:\s*/, '')
      .split('\n')[0]
      .trim();
    const authors = rawAuthor || 'Embrapa';

    // Extract date from .situacao or .autoria
    const dateText = cleanText($(el).find('.situacao').text()) ||
      cleanText($(el).find('.autoria span[style*=hidden]').text());
    const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

    // Extract abstract from .detalhes
    const abstract = cleanText($(el).find('.detalhes p:not(.autoria):not(:has(.label))').first().text())
      .replace(/\.\.\.\s*$/, '')
      .trim();

    const sourceType = detectSourceType(title, abstract);

    results.push({
      id: `embrapa-${results.length}-${Date.now()}`,
      title,
      authors,
      year,
      publication: tipo || 'Embrapa',
      sourceName: 'Embrapa',
      sourceType,
      abstract: abstract || 'Publicação disponível no portal Embrapa. Acesse o link para mais detalhes.',
      keywords: extractKeywords(title, abstract),
      directUrl,
      searchUrl,
      abntCitation: `EMBRAPA. ${title}. Embrapa, ${year}. Disponível em: ${directUrl}.`,
    });
  });

  return results;
}

export async function scrapeEmbrapa(
  query: string,
  maxResults: number = 10
): Promise<ScientificSource[]> {
  const cached = getCached('embrapa', query);
  if (cached) return cached;

  // Strategy 1: Stealth browser search (most reliable for Embrapa)
  // Use the buscaPortal parameter for actual search results
  const searchUrl = `https://www.embrapa.br/busca-geral/-/busca?q=${encodeURIComponent(query)}&buscaPortal=${encodeURIComponent(query)}`;
  try {
    const result = await stealthFetch(searchUrl, {
      waitSelector: '.conteudo',
      timeoutMs: 25000,
    });
    if (result.ok && result.html.length > 10000) {
      const results = parseEmbrapaHtml(result.html, searchUrl, maxResults);
      if (results.length > 0) {
        setCache('embrapa', query, results);
        return results;
      }
    }
  } catch (err) {
    console.warn('[Embrapa] Stealth search failed:', err);
  }

  // Strategy 2: Direct fetch as fallback
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const html = await response.text();
      if (html.length > 10000) {
        const results = parseEmbrapaHtml(html, searchUrl, maxResults);
        if (results.length > 0) {
          setCache('embrapa', query, results);
          return results;
        }
      }
    }
  } catch {
    // ignore
  }

  return [];
}
