import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { deduplicateSources } from './dedup';
export { deduplicateSources } from './dedup';
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

const SCRAPER_CONCURRENCY = Math.max(1, Number(process.env.SCRAPER_CONCURRENCY ?? 3));

export interface SearchOptions {
  maxPerSource?: Record<string, number>;
  language?: 'pt-br' | 'pt-br-en';
}

interface ScraperTaskResult {
  name: string;
  results: ScientificSource[];
  error: string | null;
}

async function runScrapersForQuery(
  query: string,
  options?: SearchOptions
): Promise<{ sources: ScientificSource[]; errors: string[]; sourcesUsed: string[] }> {
  const errors: string[] = [];
  const results: ScientificSource[] = [];
  const sourcesUsed: string[] = [];

  const settled: ScraperTaskResult[] = new Array(SCRAPERS_INTERNAL.length);
  let cursor = 0;

  async function worker() {
    while (cursor < SCRAPERS_INTERNAL.length) {
      const i = cursor++;
      const scraper = SCRAPERS_INTERNAL[i];
      try {
        const maxResults = options?.maxPerSource?.[scraper.name] ?? scraper.max;
        const scraperResults = await scraper.fn(query, maxResults, options?.language);
        settled[i] = { name: scraper.name, results: scraperResults, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Scrapers] ${scraper.name} failed:`, msg);
        settled[i] = { name: scraper.name, results: [], error: msg };
      }
    }
  }

  const workerCount = Math.min(SCRAPER_CONCURRENCY, SCRAPERS_INTERNAL.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (const result of settled) {
    if (!result) continue;
    results.push(...result.results);
    if (result.results.length > 0) {
      sourcesUsed.push(result.name);
    }
    if (result.error) {
      errors.push(`${result.name}: ${result.error}`);
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

  interface TopicTaskResult {
    sources: ScientificSource[];
    errors: string[];
    sourcesUsed: string[];
  }

  const searchTopics = topics!;
  const topicResults: (TopicTaskResult | undefined)[] = new Array(searchTopics.length);
  let topicCursor = 0;

  async function topicWorker() {
    while (topicCursor < searchTopics.length) {
      const i = topicCursor++;
      const topic = searchTopics[i];
      const combinedQuery = `${query} ${topic}`;
      const { sources, errors, sourcesUsed } = await runScrapersForQuery(combinedQuery, options);
      topicResults[i] = {
        sources: sources.map((src) => ({ ...src, matchedTopics: [topic] })),
        errors,
        sourcesUsed,
      };
    }
  }

  const topicWorkerCount = Math.min(SCRAPER_CONCURRENCY, searchTopics.length);
  await Promise.all(Array.from({ length: topicWorkerCount }, () => topicWorker()));

  for (const result of topicResults) {
    if (!result) continue;
    allResults.push(...result.sources);
    allErrors.push(...result.errors);
    allSourcesUsed.push(...result.sourcesUsed);
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
