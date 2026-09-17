import { searchAllSources, SearchOptions } from '@/lib/scrapers';
import { decideReuse, ReuseDecision } from '@/lib/reuseDecision';
import { indexSources } from '@/lib/evidenceIndex';
import { extractTopics, TopicExtractorConfig } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { understandSources, filterAndRankRelevant, UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { DomainKey, DOMAIN_DESCRIPTORS, AGRO_DOMAIN_RELEVANCE_THRESHOLD } from '@/lib/semantic/config';

export interface SourceSearchRequest {
  query: string;
  customTopics?: string[];
  searchOptions?: SearchOptions;
  domain?: DomainKey;
  topicExtractorConfig?: TopicExtractorConfig;
}

export interface SourceSearchResult {
  sources: UnderstoodSource[];
  reusedSources: UnderstoodSource[];
  newSources: UnderstoodSource[];
  memoryDecision: ReuseDecision | null;
  topics: string[];
  indexingStats: {
    indexed: number;
    archivedOffTopic: number;
    discardedOutOfDomain: number;
  } | null;
  errors: string[];
}

/**
 * Orquestrador unificado de pesquisa de fontes.
 *
 * Encapsula o pipeline completo:
 *   extractTopics → decideReuse → searchAllSources → understandSources
 *   → filterAndRankRelevant → indexSources
 *
 * Consome os mesmos serviços usados pelo pesquisador-fontes e pesquisador-artigo,
 * eliminando duplicação de lógica entre as duas rotas.
 */
export async function searchSources(
  req: SourceSearchRequest
): Promise<SourceSearchResult> {
  const {
    query,
    customTopics,
    searchOptions = {},
    domain = 'agro',
    topicExtractorConfig,
  } = req;

  const topics = customTopics && customTopics.length > 0
    ? customTopics
    : extractTopics(query, topicExtractorConfig);

  // ── CAMADA 1: Verificar memória de evidências ──
  const decision = isSupabaseConfigured()
    ? await decideReuse(query, topics.length > 0 ? topics : undefined)
    : null;

  // ── ≥75% de cobertura: reutiliza sem pesquisar fontes novas ──
  if (decision && decision.action === 'reuse' && decision.sourcesToReuse.length > 0) {
    const understood = await understandSources(query, decision.sourcesToReuse);
    const relevant = filterAndRankRelevant(understood);

    return {
      sources: relevant,
      reusedSources: relevant,
      newSources: [],
      memoryDecision: decision,
      topics,
      indexingStats: null,
      errors: [],
    };
  }

  // ── 45%-75% (complementary) ou <45% (new_search): pesquisa fontes novas ──
  const isComplementary = decision?.action === 'complementary';
  const topicsToSearch = decision?.action === 'complementary' || decision?.action === 'new_search'
    ? decision.topicsNeedingSearch
    : undefined;

  // Fontes reutilizadas (já reentendidas com a query atual) para contraponto.
  const reusedUnderstood = isComplementary && decision
    ? filterAndRankRelevant(await understandSources(query, decision.sourcesToReuse))
    : [];

  const result = await searchAllSources(query, topicsToSearch, searchOptions);

  const understood = await understandSources(query, result.sources);
  const relevantNew = filterAndRankRelevant(understood);

  // Indexa tudo (relevantes + fora-de-tópico-mas-dominio; resto descartado dentro).
  let indexingStats = null;
  if (isSupabaseConfigured() && understood.length > 0) {
    const stats = await indexSources(understood, topics).catch(err => {
      console.warn('[ResearchService] Falha ao indexar:', err);
      return null;
    });
    indexingStats = stats;
  }

  // Combina contraponto (reutilizadas) + novas, sem duplicar por título.
  const seenTitles = new Set(reusedUnderstood.map(s => s.title));
  const combined = [
    ...reusedUnderstood,
    ...relevantNew.filter(s => !seenTitles.has(s.title)),
  ].sort((a, b) => b.semanticScore - a.semanticScore);

  return {
    sources: combined,
    reusedSources: reusedUnderstood,
    newSources: relevantNew,
    memoryDecision: decision,
    topics,
    indexingStats,
    errors: result.errors,
  };
}
