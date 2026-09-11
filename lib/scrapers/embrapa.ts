import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { getCached, setCache } from '@/lib/scraperCache';

const INFOTECA_OAI = 'http://www.infoteca.cnptia.embrapa.br/infoteca-oai/request';

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

function extractOaiField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return (match?.[1] || '').replace(/\s+/g, ' ').trim();
}

function extractOaiFieldList(xml: string, tag: string): string[] {
  const matches: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const val = (m[1] || '').replace(/\s+/g, ' ').trim();
    if (val) matches.push(val);
  }
  return matches;
}

function parseOaiRecord(recordXml: string): ScientificSource | null {
  const title = extractOaiField(recordXml, 'dc:title');
  if (!title || title.length < 5) return null;

  const creators = extractOaiFieldList(recordXml, 'dc:creator');
  const authors = creators.length > 0 ? creators.join('; ') : 'Embrapa';

  const date = extractOaiField(recordXml, 'dc:date');
  const year = extractYear(date || title);

  const description = extractOaiField(recordXml, 'dc:description');
  const abstract = description.slice(0, 1000);

  const identifier = extractOaiField(recordXml, 'dc:identifier');
  const type = extractOaiField(recordXml, 'dc:type');

  let directUrl = identifier;
  if (!identifier.startsWith('http')) {
    // Try to find a URL in dc:relation or dc:link
    const relation = extractOaiField(recordXml, 'dc:relation');
    if (relation.startsWith('http')) {
      directUrl = relation;
    } else {
      directUrl = `https://www.embrapa.br/busca-geral/-/busca?q=${encodeURIComponent(title)}`;
    }
  }

  const sourceType = detectSourceType(title, abstract);

  const subjects = extractOaiFieldList(recordXml, 'dc:subject');
  const keywords = subjects.length > 0
    ? subjects.slice(0, 6)
    : extractKeywords(title, abstract);

  return {
    id: `embrapa-oai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    authors,
    year,
    publication: 'Embrapa - Infoteca-e',
    sourceName: 'Embrapa',
    sourceType,
    abstract: abstract || 'Publicação disponível no portal Embrapa. Acesse o link para mais detalhes.',
    keywords,
    directUrl,
    searchUrl: `https://www.embrapa.br/busca-geral/-/busca?q=${encodeURIComponent(title)}`,
    abntCitation: `EMBRAPA. ${title}. Embrapa, ${year}. Disponível em: ${directUrl}.`,
  };
}

async function searchOaiPmh(
  query: string,
  maxResults: number
): Promise<ScientificSource[]> {
  try {
    // OAI-PMH ListRecords — fetch a batch and filter client-side
    const params = new URLSearchParams({
      verb: 'ListRecords',
      metadataPrefix: 'oai_dc',
    });

    const response = await fetch(`${INFOTECA_OAI}?${params.toString()}`, {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(Boolean);

    // Split by <record> tags
    const recordBlocks = xml.split(/<record>/).slice(1);
    const results: ScientificSource[] = [];

    for (const block of recordBlocks) {
      if (results.length >= maxResults) break;

      const recordXml = block.split(/<\/record>/)[0] || '';
      const title = extractOaiField(recordXml, 'dc:title');
      const abstract = extractOaiField(recordXml, 'dc:description');

      // Check relevance
      const searchText = `${title} ${abstract}`.toLowerCase();
      const hasMatch = words.some(w => searchText.includes(w));
      if (!hasMatch) continue;

      const parsed = parseOaiRecord(recordXml);
      if (parsed) results.push(parsed);
    }

    return results;
  } catch {
    return [];
  }
}

export async function scrapeEmbrapa(
  query: string,
  maxResults: number = 20
): Promise<ScientificSource[]> {
  const cached = getCached('embrapa', query);
  if (cached) return cached;

  // Strategy 1: OAI-PMH from Infoteca-e (fast, structured)
  try {
    const results = await searchOaiPmh(query, maxResults);
    if (results.length > 0) {
      setCache('embrapa', query, results);
      return results;
    }
  } catch {
    // fall through
  }

  // Strategy 2: Stealth browser search
  const searchUrl = `https://www.embrapa.br/busca-geral/-/busca?q=${encodeURIComponent(query)}`;
  try {
    const { stealthFetch } = await import('@/lib/stealthBrowser');
    const result = await stealthFetch(searchUrl, {
      waitSelector: '.conteudo',
      timeoutMs: 25000,
    });
    if (result.ok && result.html.length > 10000) {
      const cheerio = await import('cheerio');
      const $ = cheerio.load(result.html);
      const results: ScientificSource[] = [];

      $('.conteudo').each((_i: number, el: any) => {
        if (results.length >= maxResults) return false;
        const tipo = $(el).find('.tipo-conteudo').text().trim();
        if (tipo === 'Imagem') return;

        const titleEl = $(el).find('h3.titulo a, .titulo a').first();
        let title = cleanText(titleEl.text());
        if (!title || title.length < 5) {
          title = cleanText($(el).find('h3').first().text());
        }
        if (!title || title.length < 5) return;

        const link = titleEl.attr('href') || $(el).find('h3 a').attr('href') || '';
        const directUrl = link.startsWith('http') ? link : `https://www.embrapa.br${link}`;
        const rawAuthor = cleanText($(el).find('.autoria').text()).replace(/^Por:\s*/, '').split('\n')[0].trim();
        const authors = rawAuthor || 'Embrapa';
        const dateText = cleanText($(el).find('.situacao').text());
        const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
        const abstract = cleanText($(el).find('.detalhes p:not(.autoria):not(:has(.label))').first().text()).replace(/\.\.\.\s*$/, '');

        results.push({
          id: `embrapa-${results.length}-${Date.now()}`,
          title,
          authors,
          year,
          publication: tipo || 'Embrapa',
          sourceName: 'Embrapa',
          sourceType: detectSourceType(title, abstract),
          abstract: abstract || 'Publicação disponível no portal Embrapa.',
          keywords: extractKeywords(title, abstract),
          directUrl,
          searchUrl,
          abntCitation: `EMBRAPA. ${title}. Embrapa, ${year}. Disponível em: ${directUrl}.`,
        });
      });

      if (results.length > 0) {
        setCache('embrapa', query, results);
        return results;
      }
    }
  } catch {
    // ignore
  }

  return [];
}
