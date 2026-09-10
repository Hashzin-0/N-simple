import { ScientificSource } from '@/components/PesquisadorAgro/types';

interface CacheEntry {
  sources: ScientificSource[];
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 100;

const cache = new Map<string, CacheEntry>();

function makeKey(scraperName: string, query: string): string {
  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${scraperName}::${normalized}`;
}

export function getCached(
  scraperName: string,
  query: string
): ScientificSource[] | null {
  const key = makeKey(scraperName, query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.sources;
}

export function setCache(
  scraperName: string,
  query: string,
  sources: ScientificSource[]
): void {
  if (sources.length === 0) return;
  const key = makeKey(scraperName, query);

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  cache.set(key, { sources, timestamp: Date.now() });
}
