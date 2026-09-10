'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScientificSource } from '@/components/PesquisadorAgro/types';

const STORAGE_KEY = 'pesq_searched_sources';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedSources {
  theme: string;
  sources: ScientificSource[];
  timestamp: number;
  options?: {
    maxPerSource?: Record<string, number>;
    language?: 'pt-br' | 'pt-br-en';
  };
}

function loadFromStorage(): CachedSources | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as CachedSources;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(data: CachedSources): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function useSearchedSources() {
  const [cachedSources, setCachedSources] = useState<CachedSources | null>(() => loadFromStorage());

  const saveSources = useCallback((
    theme: string,
    sources: ScientificSource[],
    options?: CachedSources['options']
  ) => {
    const data: CachedSources = {
      theme,
      sources,
      timestamp: Date.now(),
      options,
    };
    setCachedSources(data);
    saveToStorage(data);
  }, []);

  const clearSources = useCallback(() => {
    setCachedSources(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    cachedSources,
    saveSources,
    clearSources,
  };
}
