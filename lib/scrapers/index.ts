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
    } else if (src.abstract.length > existing.abstract.length) {
      seen.set(key, src);
    }
  }

  return Array.from(seen.values());
}

export async function searchAllSources(query: string): Promise<ScrapedResult> {
  const errors: string[] = [];
  const allResults: ScientificSource[] = [];

  const searchPromises = SCRAPERS.map(async (scraper) => {
    try {
      const results = await scraper.fn(query, scraper.max);
      return { name: scraper.name, results, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scrapers] ${scraper.name} failed:`, msg);
      return { name: scraper.name, results: [], error: msg };
    }
  });

  const settled = await Promise.allSettled(searchPromises);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      const { name, results, error } = result.value;
      allResults.push(...results);
      if (error) {
        errors.push(`${name}: ${error}`);
      }
    } else {
      errors.push(`Promise rejected: ${result.reason}`);
    }
  }

  const deduplicated = deduplicateSources(allResults);

  return {
    sources: deduplicated,
    query,
    totalFound: deduplicated.length,
    errors,
  };
}
