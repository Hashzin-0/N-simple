import { searchAllSourcesWithProgress, SearchOptions, ScrapedResult } from '@/lib/scrapers';
import { decideReuse, ReuseDecision } from '@/lib/reuseDecision';
import { indexSources } from '@/lib/evidenceIndex';
import { extractTopics, TopicExtractorConfig } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { understandSources, filterAndRankRelevant, UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { embedText } from '@/lib/semantic/embeddings';
import { DomainKey } from '@/lib/semantic/config';
import { ScientificSource } from '@/components/PesquisadorAgro/types';

export interface SourceSearchRequest {
  query: string;
  customTopics?: string[];
  searchOptions?: SearchOptions;
  domain?: DomainKey;
  topicExtractorConfig?: TopicExtractorConfig;
  /**
   * Fontes que o cliente já tem (localStorage) — entram no pool de
   * re-entendimento sem depender só do Supabase. Ainda passam pelo
   * re-entendimento completo com a query atual; servem para cobrir
   * tópicos e reduzir o fan-out de scrapers.
   */
  existingSources?: ScientificSource[];
  /** Callbacks de progresso (ex.: eventos SSE do stream de pesquisador-fontes). */
  onProgress?: SourceSearchProgress;
}

export interface SourceSearchProgress {
  onScrapersStart?: (scrapers: Array<{ name: string; maxAllowed: number; description: string }>) => void;
  onScraperStart?: (name: string, maxResults: number) => void;
  onScraperComplete?: (name: string, results: ScientificSource[]) => void;
  onScraperError?: (name: string, error: string) => void;
  onMemoryDecision?: (decision: ReuseDecision | null) => void;
  onProcessingStart?: (totalSources: number, message: string) => void;
  onProcessingComplete?: (processedCount: number, relevantCount: number) => void;
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
 *
 * O embedding da query é gerado UMA vez e compartilhado entre o
 * re-entendimento das fontes reutilizadas e o das novas (e pelo cache LRU
 * de embeddings, repete 0 chamadas HTTP repetidas entre calls do mesmo request).
 */
export async function searchSources(
  req: SourceSearchRequest
): Promise<SourceSearchResult> {
  const {
    query,
    customTopics,
    searchOptions = {},
    domain: _domain,
    topicExtractorConfig,
    existingSources,
    onProgress,
  } = req;

  const topics = customTopics && customTopics.length > 0
    ? customTopics
    : extractTopics(query, topicExtractorConfig);

  // 1 única embed da query, reutilizada em todos os understandSources deste request.
  const sharedQueryEmbedding = await embedText(query, 'RETRIEVAL_QUERY').catch(() => undefined);

  // ── CAMADA 1: Verificar memória de evidências ──
  const decision = isSupabaseConfigured()
    ? await decideReuse(query, topics.length > 0 ? topics : undefined)
    : null;
  onProgress?.onMemoryDecision?.(decision);

  // Pool de candidatas já conhecidas (memória Supabase + existingSources
  // do cliente). Deduplica por título.
  const priorPool: UnderstoodSource[] = [];
  const priorSeen = new Set<string>();
  const pushPrior = (src: ScientificSource | UnderstoodSource) => {
    const title = (src.title || '').trim();
    if (!title || priorSeen.has(title)) return;
    priorSeen.add(title);
    priorPool.push(src as UnderstoodSource);
  };
  if (decision) {
    for (const src of decision.sourcesToReuse) pushPrior(src);
  }
  if (existingSources) {
    for (const src of existingSources) pushPrior(src);
  }

  // ── ≥75% de cobertura: reutiliza sem pesquisar fontes novas ──
  if (
    decision &&
    decision.action === 'reuse' &&
    priorPool.length > 0
  ) {
    const understood = await understandSources(
      query,
      priorPool,
      sharedQueryEmbedding,
    );
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
  const topicsToSearch =
    decision?.action === 'complementary' || decision?.action === 'new_search'
      ? decision.topicsNeedingSearch
      : undefined;

  // Re-entendimento completo das candidatas prévias (decisão do produto:
  // nunca reaproveitar vetor salvo sem passar pelo motor com a query atual).
  if (priorPool.length > 0) {
    onProgress?.onProcessingStart?.(
      priorPool.length,
      `Reutilizando ${priorPool.length} fontes da memória...`,
    );
  }
  const reusedUnderstood =
    priorPool.length > 0
      ? filterAndRankRelevant(
          await understandSources(query, priorPool, sharedQueryEmbedding)
        )
      : [];

  // Scrapers sempre rodam neste ponto (o early-return de `reuse` com pool
  // cheio já saiu acima) — complementary garante contraponto, new_search
  // busca do zero.
  const result: ScrapedResult = await searchAllSourcesWithProgress(
    query,
    topicsToSearch,
    searchOptions,
    onProgress,
  );

  onProgress?.onProcessingStart?.(
    result.sources.length,
    'Processando relevância semântica...',
  );

  const understood = await understandSources(
    query,
    result.sources,
    sharedQueryEmbedding,
  );
  const relevantNew = filterAndRankRelevant(understood);
  onProgress?.onProcessingComplete?.(understood.length, relevantNew.length);

  // Indexa as fontes novas entendidas nesta busca (as reutilizadas já
  // indexadas em buscas anteriores).
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
