import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { scrapeGoogleScholar } from './scholar';
import { scrapeEmbrapa } from './embrapa';
import { scrapeSciELO } from './scielo';
import { scrapeCAPES } from './capes';
import { scrapeBDTD } from './bdtd';
import { scrapeYouTube } from './youtube';

export interface ScrapedResult {
  sources: ScientificSource[];
  query: string;
  totalFound: number;
  errors: string[];
}

const SCRAPERS = [
  { name: 'Google Acadêmico', fn: scrapeGoogleScholar, max: 12 },
  { name: 'Embrapa', fn: scrapeEmbrapa, max: 8 },
  { name: 'SciELO', fn: scrapeSciELO, max: 8 },
  { name: 'CAPES', fn: scrapeCAPES, max: 6 },
  { name: 'BDTD', fn: scrapeBDTD, max: 6 },
  { name: 'YouTube', fn: scrapeYouTube, max: 5 },
];

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

async function runScrapersForQuery(
  query: string
): Promise<{ sources: ScientificSource[]; errors: string[] }> {
  const errors: string[] = [];
  const results: ScientificSource[] = [];

  const searchPromises = SCRAPERS.map(async (scraper) => {
    try {
      const scraperResults = await scraper.fn(query, scraper.max);
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
      if (error) {
        errors.push(`${name}: ${error}`);
      }
    } else {
      errors.push(`Promise rejected: ${result.reason}`);
    }
  }

  return { sources: results, errors };
}

export async function searchAllSources(
  query: string,
  topics?: string[]
): Promise<ScrapedResult> {
  const allErrors: string[] = [];
  const allResults: ScientificSource[] = [];

  if (!topics || topics.length === 0) {
    const { sources, errors } = await runScrapersForQuery(query);
    allErrors.push(...errors);

    const deduplicated = deduplicateSources(sources);

    return {
      sources: deduplicated,
      query,
      totalFound: deduplicated.length,
      errors: allErrors,
    };
  }

  const topicSearchPromises = topics.map(async (topic) => {
    const combinedQuery = `${query} ${topic}`;
    const { sources, errors } = await runScrapersForQuery(combinedQuery);

    const tagged = sources.map((src) => ({
      ...src,
      matchedTopics: [topic],
    }));

    return { topic, sources: tagged, errors };
  });

  const topicResults = await Promise.allSettled(topicSearchPromises);

  for (const result of topicResults) {
    if (result.status === 'fulfilled') {
      const { sources, errors } = result.value;
      allResults.push(...sources);
      allErrors.push(...errors);
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
  };
}
