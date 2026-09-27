import { searchAllSourcesWithProgress, SearchOptions, ScrapedResult } from '@/lib/scrapers';
import { decideReuse, ReuseDecision } from '@/lib/reuseDecision';
import { indexSources, logSearchQuery } from '@/lib/evidenceIndex';
import { extractTopics, TopicExtractorConfig } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { filterAndRankRelevant, UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { runLightPhase, roundRobinQueueItems } from '@/lib/semantic/portalQueues';
import { enqueueFullSemantic } from '@/lib/semantic/enqueue';
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
  /**
   * Decisão de reuso já calculada pelo caller — evita chamar decideReuse
   * (embed + pgvector) de novo no mesmo request (ex.: tutor research).
   */
  priorDecision?: ReuseDecision | null;
  /**
   * Embedding da query já gerado pelo caller — compartilhado com
   * understandSources em vez de gerar outro.
   */
  priorQueryEmbedding?: number[];
  /**
   * Caminho leve: só scrapers + formatação de contexto de prompt.
   * Pula understandSources (full-text, cross-encoder, categorias) e
   * indexSources — suficiente para montar questões do Tutor sem estourar
   * o orçamento de tempo da função.
   */
  light?: boolean;
  /** Limita quantos tópicos entram no fan-out de scrapers (reduz N×M). */
  maxTopicsForSearch?: number;
}

export interface SourceSearchProgress {
  onScrapersStart?: (scrapers: Array<{ name: string; maxAllowed: number; description: string }>) => void;
  onScraperStart?: (name: string, maxResults: number) => void;
  onScraperComplete?: (name: string, results: ScientificSource[]) => void;
  onScraperError?: (name: string, error: string) => void;
  onMemoryDecision?: (decision: ReuseDecision | null) => void;
  onProcessingStart?: (totalSources: number, message: string) => void;
  onProcessingComplete?: (processedCount: number, relevantCount: number) => void;
  /**
   * Filas por portal prontas (fase 1): cada portal tem seu semântico
   * dedicado com fontes ordenadas 1→2→3.
   */
  onPortalQueuesReady?: (portals: Array<{ portal: string; total: number }>) => void;
  /**
   * Progresso incremental da análise semântica + persistência.
   * Emitido a cada fonte processada (e salva ou tentada) para o cliente
   * mostrar badge azul e contador de verificadas. Carrega o detalhe da
   * fila por portal (portal/queueIndex/queueTotal) além do global.
   */
  onSourceVerified?: (update: {
    sourceId?: string;
    title?: string;
    verifiedCount: number;
    totalSources: number;
    persistedCount: number;
    percentage: number;
    status: 'analyzed' | 'persisted' | 'error';
    portal?: string;
    queueIndex?: number;
    queueTotal?: number;
  }) => void;
  /** Fase 2 (full em 2º plano) enfileirada com N fontes. */
  onPhase2Enqueued?: (count: number) => void;
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
    errors: number;
  } | null;
  errors: string[];
}

/**
 * Envolve um ScientificSource cru como UnderstoodSource mínimo (caminho
 * light do Tutor) — campos semânticos vazios; suficiente para
 * formatSourcesByTopic em prompts de extração de questões.
 */
function toLightUnderstood(src: ScientificSource): UnderstoodSource {
  return {
    ...src,
    semanticScore: 0,
    semanticCategories: [],
    bestExcerpt: '',
    discarded: false,
    docEmbedding: [],
    chunks: [],
    usedFullText: false,
    domainScore: 0,
    inAgroDomain: false,
    shouldPersist: false,
  };
}

/**
 * Indexa no Supabase + registra a query. Usado em todos os caminhos full
 * (reuse, complementary, new_search) para que fontes pesquisadas sempre
 * sejam formatadas/classificadas e salvas quando shouldPersist.
 */
async function persistSearchOutcome(
  query: string,
  topics: string[],
  sourcesToIndex: UnderstoodSource[],
  decision: ReuseDecision | null,
  sourcesFound: number,
): Promise<SourceSearchResult['indexingStats']> {
  if (!isSupabaseConfigured()) {
    console.warn(
      '[ResearchService] Supabase não configurado — fontes NÃO serão salvas. ' +
        'Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.'
    );
    return null;
  }
  if (sourcesToIndex.length === 0) {
    console.warn('[ResearchService] persistSearchOutcome: lista de fontes vazia — nada a indexar.');
    return null;
  }

  let stats: SourceSearchResult['indexingStats'] = null;
  try {
    stats = await indexSources(sourcesToIndex, topics);
    console.info(
      `[ResearchService] Indexação: indexed=${stats?.indexed} archived=${stats?.archivedOffTopic} ` +
        `discarded=${stats?.discardedOutOfDomain} errors=${stats?.errors}`
    );
  } catch (err) {
    console.warn('[ResearchService] Falha ao indexar:', err);
  }

  try {
    await logSearchQuery(
      query,
      topics,
      sourcesFound,
      decision?.action ?? 'new_search',
      decision?.coverageScore ?? 0,
    );
  } catch (err) {
    console.warn('[ResearchService] Falha ao registrar search_queries:', err);
  }

  return stats;
}

/**
 * Persiste um lote parcial de fontes já analisadas (incremental).
 * Não registra search_queries (só no final). Retorna stats agregadas
 * + os ids gravados (alimento da fila da fase 2).
 *
 * A gravação em si já dispara a fase 2 (`indexSources` chama
 * `enqueueFullSemantic` quando o lote deixa fontes 'light' no banco) —
 * `lightIds` é só o relatório para a UI.
 */
async function persistPartialBatch(
  topics: string[],
  batch: UnderstoodSource[],
): Promise<{ indexed: number; errors: number; ids: string[]; lightIds: string[] } | null> {
  if (!isSupabaseConfigured() || batch.length === 0) return null;
  try {
    const stats = await indexSources(batch, topics);
    return {
      indexed: stats.indexed + stats.archivedOffTopic,
      errors: stats.errors,
      ids: stats.indexedIds,
      lightIds: stats.lightIds,
    };
  } catch (err) {
    console.warn('[ResearchService] Falha ao indexar lote parcial:', err);
    return { indexed: 0, errors: batch.length, ids: [], lightIds: [] };
  }
}

interface ProcessLightResult {
  understood: UnderstoodSource[];
  queues: Map<string, UnderstoodSource[]>;
  persistedCount: number;
  indexedIds: string[];
}

/**
 * FASE 1 — semântico dedicado por portal.
 *
 * 1. `runLightPhase` analisa TODAS as fontes em lote (1 embed por fonte,
 *    sem full-text) e monta as filas por portal ordenadas 1→2→3;
 * 2. percorre as filas em round-robin justo (portal 1, portal 2, ...
 *    depois posição 2 de cada) emitindo progresso global + por portal;
 * 3. persiste incrementalmente em lotes de 25 (`semantic_status='light'`) —
 *    cada lote já dispara a FASE 2 (Inngest) logo após gravar;
 * 4. a FASE 2 (Inngest) faz o understandOne completo em 2º plano e as
 *    fontes sobem para 'full' (reutilizáveis).
 */
async function processLightPhase(opts: {
  query: string;
  sources: ScientificSource[];
  topics: string[];
  domain: DomainKey;
  queryEmbedding?: number[];
  onProgress?: SourceSearchProgress;
}): Promise<ProcessLightResult> {
  const { query, sources, topics, domain, queryEmbedding, onProgress } = opts;
  const result = await runLightPhase(query, sources, queryEmbedding, domain);

  const portalList = [...result.queues.entries()].map(([portal, list]) => ({
    portal,
    total: list.length,
  }));
  onProgress?.onPortalQueuesReady?.(portalList);

  const items = roundRobinQueueItems(result.queues);
  const total = items.length;
  let verifiedCount = 0;
  let persistedCount = 0;
  const indexedIds: string[] = [];
  let lightCount = 0;

  const PERSIST_BATCH = 25;
  let pending: typeof items = [];
  let toPersist: UnderstoodSource[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const emitting = pending;
    const batch = toPersist;
    pending = [];
    toPersist = [];

    let stats: { indexed: number; errors: number; ids: string[]; lightIds: string[] } | null = null;
    if (batch.length > 0) {
      stats = await persistPartialBatch(topics, batch);
      if (stats) {
        persistedCount += stats.indexed;
        indexedIds.push(...stats.ids);
        lightCount += stats.lightIds.length;
      }
    }

    for (const item of emitting) {
      verifiedCount += 1;
      const pct = Math.min(100, Math.round((verifiedCount / Math.max(1, total)) * 100));
      let status: 'analyzed' | 'persisted' | 'error' = 'analyzed';
      if (item.source.shouldPersist) {
        status = stats
          ? stats.errors > 0
            ? 'error'
            : 'persisted'
          : 'analyzed';
      }
      onProgress?.onSourceVerified?.({
        sourceId: item.source.id,
        title: item.source.title,
        verifiedCount,
        totalSources: total,
        persistedCount,
        percentage: pct,
        status,
        portal: item.portal,
        queueIndex: item.index + 1,
        queueTotal: item.total,
      });
    }
  };

  for (const item of items) {
    if (item.source.shouldPersist) toPersist.push(item.source);
    pending.push(item);
    if (pending.length >= PERSIST_BATCH) await flush();
  }
  await flush();

  // Fase 2: cada lote gravado já disparou a cadeia (via indexSources);
  // aqui só reportamos para a UI quantas fontes entraram na fila light.
  const uniqueIds = [...new Set(indexedIds)];
  if (lightCount > 0) {
    onProgress?.onPhase2Enqueued?.(lightCount);
  }

  return {
    understood: result.understood,
    queues: result.queues,
    persistedCount,
    indexedIds: uniqueIds,
  };
}

/** Dedup por título preservando a prioridade do pool de reuso. */
function dedupeByTitle(sources: ScientificSource[]): ScientificSource[] {
  const seen = new Set<string>();
  const out: ScientificSource[] = [];
  for (const src of sources) {
    const title = (src.title || '').trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push(src);
  }
  return out;
}

/**
 * Orquestrador unificado de pesquisa de fontes.
 *
 * Pipeline em duas fases:
 *   extractTopics → decideReuse → searchAllSources (scrapers) →
 *   FASE 1 `processLightPhase` (embed lote + filas por portal + persist
 *   'light') → FASE 2 enqueue Inngest (understandOne completo em 2º plano)
 *   → filterAndRankRelevant → persistSearchOutcome.
 *
 * `decideReuse` devolve também `pendingFullSemanticIds` (matches 'light'
 * que ainda não são reutilizáveis) — são enfileirados na fase 2 logo aqui.
 *
 * Callers avançados (tutor research) podem passar `priorDecision`,
 * `priorQueryEmbedding` e `light` para reaproveitar trabalho já feito e
 * cortar o custo do pipeline.
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
    existingSources,
    onProgress,
    priorDecision,
    priorQueryEmbedding,
    light = false,
    maxTopicsForSearch,
  } = req;

  const topics = customTopics && customTopics.length > 0
    ? customTopics
    : extractTopics(query, topicExtractorConfig);

  // 1 única embed da query, reutilizada na fase 1 (runLightPhase) deste request.
  const sharedQueryEmbedding =
    priorQueryEmbedding ??
    (light
      ? undefined
      : await embedText(query, 'RETRIEVAL_QUERY').catch(() => undefined));

  // ── CAMADA 1: Verificar memória de evidências ──
  const decision =
    priorDecision !== undefined
      ? priorDecision
      : isSupabaseConfigured()
        ? await decideReuse(query, topics.length > 0 ? topics : undefined)
        : null;
  onProgress?.onMemoryDecision?.(decision);

  // Matches 'light' da memória (decideReuse não os conta como reuso):
  // NADA é gravado aqui, então nenhum writer dispara sozinho — enfileira
  // na fase 2 AGORA. O evento drena a fila light inteira (inclusive estas
  // linhas), então não precisa mandar os ids; quando voltarem 'full',
  // já entram no coverage da próxima busca.
  if (decision && decision.pendingFullSemanticIds.length > 0) {
    await enqueueFullSemantic({ query });
  }

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
    if (light) {
      const relevant = priorPool.filter((s) => !s.discarded);
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
    // Re-entendimento leve por portal (fila 1→2→3) + persistência
    // incremental + enfileiramento da fase 2.
    const processed = await processLightPhase({
      query,
      sources: priorPool,
      topics,
      domain,
      queryEmbedding: sharedQueryEmbedding,
      onProgress,
    });
    const understood = processed.understood;
    const relevant = filterAndRankRelevant(understood);

    // Fontes vindas só do localStorage (existingSources) podem não estar no
    // banco — indexa as que passam no filtro de domínio/relevância.
    const indexingStats = await persistSearchOutcome(
      query,
      topics,
      understood,
      decision,
      priorPool.length,
    );

    return {
      sources: relevant,
      reusedSources: relevant,
      newSources: [],
      memoryDecision: decision,
      topics,
      indexingStats,
      errors: [],
    };
  }

  // ── 45%-75% (complementary) ou <45% (new_search): pesquisa fontes novas ──
  let topicsToSearch =
    decision?.action === 'complementary' || decision?.action === 'new_search'
      ? decision.topicsNeedingSearch
      : undefined;
  if (maxTopicsForSearch !== undefined && topicsToSearch) {
    topicsToSearch = topicsToSearch.slice(0, Math.max(1, maxTopicsForSearch));
  }

  // Candidatas prévias (memória + localStorage) entram na FASE 1 junto
  // com as novas dos scrapers — todas as fontes passam pelo semântico,
  // particionadas por portal (nunca reaproveitar vetor salvo sem repassar
  // pela fase 1 com a query atual). Caminho light do Tutor: pool cru.
  let reusedUnderstood: UnderstoodSource[] = [];
  if (light && priorPool.length > 0) {
    reusedUnderstood = priorPool.filter((s) => !s.discarded);
  }

  // Scrapers sempre rodam neste ponto (o early-return de `reuse` com pool
  // cheio já saiu acima) — complementary garante contraponto, new_search
  // busca do zero.
  const result: ScrapedResult = await searchAllSourcesWithProgress(
    query,
    topicsToSearch,
    searchOptions,
    onProgress,
  );

  if (light) {
    // Contexto de prompt semântico: top-K por score de título/reuso, sem
    // full-text nem cross-encoder. Mantém compat com formatSourcesByTopic.
    const seenTitles = new Set(reusedUnderstood.map((s) => s.title));
    const lightNew = result.sources
      .filter((s) => !seenTitles.has(s.title))
      .slice(0, 30)
      .map(toLightUnderstood);

    // Caminho light do Tutor: ainda persiste o que os scrapers acharam
    // (formatado/documentado), para não perder o progresso da pesquisa.
    // shouldPersist=true força gravação mesmo sem score semântico cheio.
    // Nasce 'light' — a gravação dispara a fase 2, que completa o understandOne.
    const lightToPersist = lightNew.map((s) => ({
      ...s,
      shouldPersist: true,
      semanticStatus: 'light' as const,
      semanticQuery: query,
    }));
    const lightStats = await persistPartialBatch(topics, lightToPersist);

    return {
      sources: [...reusedUnderstood, ...lightNew],
      reusedSources: reusedUnderstood,
      newSources: lightNew,
      memoryDecision: decision,
      topics,
      indexingStats: lightStats
        ? {
            indexed: lightStats.indexed,
            archivedOffTopic: 0,
            discardedOutOfDomain: 0,
            errors: lightStats.errors,
          }
        : null,
      errors: result.errors,
    };
  }

  // ── FASE 1: semântico dedicado por portal (filas 1→2→3) ──
  // Memória (priorPool) + novas dos scrapers entram juntas: TODAS as
  // fontes de TODOS os portais passam pelo semântico (nada fica de fora —
  // tudo é candidato a reuso futuro), só que em modo light agora.
  const combinedSources = dedupeByTitle([...priorPool, ...result.sources]);
  onProgress?.onProcessingStart?.(
    combinedSources.length,
    'Analisando filas por portal (fase leve)...',
  );

  let processed: ProcessLightResult;
  try {
    processed = await processLightPhase({
      query,
      sources: combinedSources,
      topics,
      domain,
      queryEmbedding: sharedQueryEmbedding,
      onProgress,
    });
  } catch (err) {
    // Fallback: se a fase 1 morrer no meio (quota/OOM), envolve tudo como
    // light e persiste — nada do scraper se perde; fase 2 completa depois.
    console.warn('[ResearchService] fase 1 falhou, fallback light puro:', err);
    const fallbackSources = combinedSources.map((s) => ({
      ...toLightUnderstood(s),
      shouldPersist: true,
      semanticStatus: 'light' as const,
      semanticQuery: query,
    }));
    const partial = await persistPartialBatch(topics, fallbackSources);
    fallbackSources.forEach((src, i) => {
      onProgress?.onSourceVerified?.({
        sourceId: src.id,
        title: src.title,
        verifiedCount: i + 1,
        totalSources: fallbackSources.length,
        persistedCount: partial?.indexed ?? 0,
        percentage: Math.round(
          ((i + 1) / Math.max(1, fallbackSources.length)) * 100
        ),
        status: 'persisted',
      });
    });
    // A gravação do lote já disparou a cadeia (via indexSources) — só
    // reportamos o tamanho da fila para a UI.
    if (partial && partial.lightIds.length > 0) {
      onProgress?.onPhase2Enqueued?.(partial.lightIds.length);
    }
    processed = {
      understood: fallbackSources,
      queues: new Map(),
      persistedCount: partial?.indexed ?? 0,
      indexedIds: partial?.ids ?? [],
    };
  }

  // Separa reutilizadas (vinham do pool de memória/localStorage) das novas.
  const priorTitles = new Set(priorPool.map((s) => (s.title || '').trim()));
  reusedUnderstood = filterAndRankRelevant(
    processed.understood.filter((s) => priorTitles.has((s.title || '').trim())),
  );
  const relevantNew = filterAndRankRelevant(
    processed.understood.filter((s) => !priorTitles.has((s.title || '').trim())),
  );

  const combined = filterAndRankRelevant(processed.understood);
  onProgress?.onProcessingComplete?.(processed.understood.length, combined.length);

  // Upsert final idempotente — fontes já salvas incrementalmente são
  // atualizadas (sem rebaixar status 'full' — regra em evidenceIndex).
  const indexingStats = await persistSearchOutcome(
    query,
    topics,
    processed.understood,
    decision,
    result.sources.length + priorPool.length,
  );

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
