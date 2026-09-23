'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { useSearchedSources } from '@/hooks/useSearchedSources';

interface EvidenceMemoryResult {
  decision: 'reuse' | 'complementary' | 'new_search';
  coverage: number;
  reuseScore: number;
  explorationNeed: number;
  diversity: number;
  sources: ScientificSource[];
  topicsNeedingSearch: string[];
  allTopics: string[];
  stats: {
    totalSourcesFound: number;
    topicsWithEvidence: number;
    topicsWithoutEvidence: number;
    avgEvidenceStrength: number;
  };
}

interface EvidenceIndexResult {
  indexed: number;
  errors: number;
  total: number;
}

interface UseEvidenceMemoryReturn {
  searchMemory: (query: string, topics?: string[]) => Promise<EvidenceMemoryResult>;
  indexEvidence: (sources: ScientificSource[], topics: string[], query?: string, decision?: string, coverageScore?: number) => Promise<EvidenceIndexResult>;
  isAvailable: boolean;
  cachedSources: ReturnType<typeof useSearchedSources>['cachedSources'];
  saveSources: ReturnType<typeof useSearchedSources>['saveSources'];
}

const FALLBACK_RESULT: EvidenceMemoryResult = {
  decision: 'new_search',
  coverage: 0,
  reuseScore: 0,
  explorationNeed: 1,
  diversity: 0,
  sources: [],
  topicsNeedingSearch: [],
  allTopics: [],
  stats: {
    totalSourcesFound: 0,
    topicsWithEvidence: 0,
    topicsWithoutEvidence: 0,
    avgEvidenceStrength: 0,
  },
};

export function useEvidenceMemory(): UseEvidenceMemoryReturn {
  const [isAvailable, setIsAvailable] = useState(true);
  const fallback = useSearchedSources();

  useEffect(() => {
    fetch('/api/evidence/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'healthcheck' }),
    })
      .then(res => {
        setIsAvailable(res.ok);
      })
      .catch(() => {
        setIsAvailable(false);
      });
  }, []);

  const searchMemory = useCallback(async (
    query: string,
    topics?: string[]
  ): Promise<EvidenceMemoryResult> => {
    if (!isAvailable) {
      if (fallback.cachedSources?.sources) {
        return {
          ...FALLBACK_RESULT,
          decision: 'reuse',
          sources: fallback.cachedSources.sources,
          coverage: 0.5,
          reuseScore: 0.5,
          explorationNeed: 0.5,
        };
      }
      return FALLBACK_RESULT;
    }

    try {
      const response = await fetch('/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topics }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        decision: data.decision,
        coverage: data.coverage,
        reuseScore: data.reuseScore,
        explorationNeed: data.explorationNeed,
        diversity: data.diversity,
        sources: data.sources || [],
        topicsNeedingSearch: data.topicsNeedingSearch || [],
        allTopics: data.allTopics || [],
        stats: data.stats || FALLBACK_RESULT.stats,
      };
    } catch (error) {
      console.warn('[useEvidenceMemory] Fallback para localStorage:', error);
      if (fallback.cachedSources?.sources) {
        return {
          ...FALLBACK_RESULT,
          decision: 'reuse',
          sources: fallback.cachedSources.sources,
          coverage: 0.5,
          reuseScore: 0.5,
          explorationNeed: 0.5,
        };
      }
      return FALLBACK_RESULT;
    }
  }, [isAvailable, fallback.cachedSources]);

  const indexEvidence = useCallback(async (
    sources: ScientificSource[],
    topics: string[],
    query?: string,
    decision?: string,
    coverageScore?: number
  ): Promise<EvidenceIndexResult> => {
    if (isAvailable) {
      try {
        const response = await fetch('/api/evidence/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources, topics, query, decision, coverageScore }),
        });

        if (response.ok) {
          const data = await response.json();
          return data;
        }
        console.warn('[useEvidenceMemory] Indexação HTTP:', response.status);
      } catch (error) {
        console.warn('[useEvidenceMemory] Indexação Supabase falhou:', error);
      }
    }

    if (query) {
      fallback.saveSources(query, sources);
    }

    // API indisponível: fontes vão só para o localStorage; reporta erro real.
    return { indexed: 0, errors: sources.length, total: sources.length };
  }, [isAvailable, fallback]);

  return {
    searchMemory,
    indexEvidence,
    isAvailable,
    cachedSources: fallback.cachedSources,
    saveSources: fallback.saveSources,
  };
}
