import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { scrapeGoogleScholar } from './scholar';
import { scrapeEmbrapa } from './embrapa';
import { scrapeSciELO } from './scielo';
import { scrapeCAPES } from './capes';
import { scrapeBDTD } from './bdtd';
import { scrapeYouTube } from './youtube';
import { scrapeCNPEM } from './cnpem';
import { scrapeINPA } from './inpa';
import { scrapeIPEA } from './ipea';
import { scrapeCrossref } from './crossref';
import { scrapeOpenAlex } from './openalex';
import { scrapeSemanticScholar } from './semantic-scholar';

export interface ScrapedResult {
  sources: ScientificSource[];
  query: string;
  totalFound: number;
  errors: string[];
  sourcesUsed: string[];
}

export interface ScraperConfig {
  name: string;
  fn: (query: string, max: number, language?: 'pt-br' | 'pt-br-en') => Promise<ScientificSource[]>;
  max: number;
  maxAllowed: number;
  description: string;
}

export interface ScraperMetadata {
  name: string;
  max: number;
  maxAllowed: number;
  description: string;
}

export const SCRAPERS_INTERNAL: ScraperConfig[] = [
  { name: 'Google Acadêmico', fn: scrapeGoogleScholar, max: 25, maxAllowed: 100, description: 'Artigos científicos indexados' },
  { name: 'Crossref', fn: scrapeCrossref, max: 50, maxAllowed: 100, description: 'Base acadêmica global com DOI' },
  { name: 'OpenAlex', fn: scrapeOpenAlex, max: 50, maxAllowed: 200, description: '250M+ obras acadêmicas abertas' },
  { name: 'Semantic Scholar', fn: scrapeSemanticScholar, max: 50, maxAllowed: 100, description: 'Citacional rico via API S2' },
  { name: 'Embrapa', fn: scrapeEmbrapa, max: 20, maxAllowed: 50, description: 'Boletins técnicos da Embrapa' },
  { name: 'SciELO', fn: scrapeSciELO, max: 20, maxAllowed: 50, description: 'Periódicos científicos latino-americanos' },
  { name: 'CAPES', fn: scrapeCAPES, max: 25, maxAllowed: 50, description: 'Periódicos via Portal CAPES' },
  { name: 'BDTD', fn: scrapeBDTD, max: 20, maxAllowed: 50, description: 'Teses e dissertações brasileiras' },
  { name: 'YouTube', fn: scrapeYouTube, max: 50, maxAllowed: 50, description: 'Vídeos técnicos e palestras' },
  { name: 'CNPEM', fn: scrapeCNPEM, max: 15, maxAllowed: 30, description: 'Centro Nacional de Pesquisa em Energia e Materiais' },
  { name: 'INPA', fn: scrapeINPA, max: 15, maxAllowed: 30, description: 'Instituto Nacional de Pesquisas da Amazônia' },
  { name: 'IPEA', fn: scrapeIPEA, max: 25, maxAllowed: 50, description: 'Instituto de Pesquisa Econômica Aplicada' },
];

export const SCRAPERS: ScraperMetadata[] = SCRAPERS_INTERNAL.map(({ name, max, maxAllowed, description }) => ({
  name, max, maxAllowed, description,
}));

function deduplicateSources(sources: ScientificSource[]): ScientificSource[] {
  const seen = new Map<string, ScientificSource>();

  for (const src of sources) {
    const key = src.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 80);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, src);
    } else {
      if (src.abstract.length > existing.abstract.length) {
        seen.set(key, src);
      }
      const merged = seen.get(key)!;
      if (src.matchedTopics && src.matchedTopics.length > 0) {
        const existingTopics = new Set(merged.matchedTopics || []);
        for (const t of src.matchedTopics) {
          existingTopics.add(t);
        }
        merged.matchedTopics = Array.from(existingTopics);
      }
    }
  }

  return Array.from(seen.values());
}

export interface SearchOptions {
  maxPerSource?: Record<string, number>;
  language?: 'pt-br' | 'pt-br-en';
}

async function runScrapersForQuery(
  query: string,
  options?: SearchOptions
): Promise<{ sources: ScientificSource[]; errors: string[]; sourcesUsed: string[] }> {
  const errors: string[] = [];
  const results: ScientificSource[] = [];
  const sourcesUsed: string[] = [];

  const searchPromises = SCRAPERS_INTERNAL.map(async (scraper) => {
    try {
      const maxResults = options?.maxPerSource?.[scraper.name] ?? scraper.max;
      const scraperResults = await scraper.fn(query, maxResults, options?.language);
      return { name: scraper.name, results: scraperResults, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scrapers] ${scraper.name} failed:`, msg);
      return { name: scraper.name, results: [], error: msg };
    }
  });

  const settled = await Promise.allSettled(searchPromises);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      const { name, results: scraperResults, error } = result.value;
      results.push(...scraperResults);
      if (scraperResults.length > 0) {
        sourcesUsed.push(name);
      }
      if (error) {
        errors.push(`${name}: ${error}`);
      }
    } else {
      errors.push(`Promise rejected: ${result.reason}`);
    }
  }

  return { sources: results, errors, sourcesUsed };
}

export async function searchAllSources(
  query: string,
  topics?: string[],
  options?: SearchOptions
): Promise<ScrapedResult> {
  const allErrors: string[] = [];
  const allResults: ScientificSource[] = [];
  const allSourcesUsed: string[] = [];

  if (!topics || topics.length === 0) {
    const { sources, errors, sourcesUsed } = await runScrapersForQuery(query, options);
    allErrors.push(...errors);
    allSourcesUsed.push(...sourcesUsed);

    const deduplicated = deduplicateSources(sources);

    return {
      sources: deduplicated,
      query,
      totalFound: deduplicated.length,
      errors: allErrors,
      sourcesUsed: allSourcesUsed,
    };
  }

  const topicSearchPromises = topics.map(async (topic) => {
    const combinedQuery = `${query} ${topic}`;
    const { sources, errors, sourcesUsed } = await runScrapersForQuery(combinedQuery, options);

    const tagged = sources.map((src) => ({
      ...src,
      matchedTopics: [topic],
    }));

    return { topic, sources: tagged, errors, sourcesUsed };
  });

  const topicResults = await Promise.allSettled(topicSearchPromises);

  for (const result of topicResults) {
    if (result.status === 'fulfilled') {
      const { sources, errors, sourcesUsed } = result.value;
      allResults.push(...sources);
      allErrors.push(...errors);
      allSourcesUsed.push(...sourcesUsed);
    } else {
      allErrors.push(`Topic search rejected: ${result.reason}`);
    }
  }

  const deduplicated = deduplicateSources(allResults);

  return {
    sources: deduplicated,
    query,
    totalFound: deduplicated.length,
    errors: allErrors,
    sourcesUsed: [...new Set(allSourcesUsed)],
  };
}
