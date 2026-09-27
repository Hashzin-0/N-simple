import { searchAllSourcesWithProgress, SearchOptions, ScrapedResult } from '@/lib/scrapers';
import { decideReuse, ReuseDecision } from '@/lib/reuseDecision';
import { indexSources, logSearchQuery, enqueueSourcesForPersistence } from '@/lib/evidenceIndex';
import { extractTopics, TopicExtractorConfig } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  understandSources,
  understandSourcesLightFallback,
  filterAndRankRelevant,
  classifyOutOfTopKForPersistence,
  UnderstoodSource,
} from '@/lib/semantic/relevanceEngine';
import { understandSourcesByPortalQueue } from '@/lib/semantic/portalSemanticEngine';
import { embedText, embedTexts } from '@/lib/semantic/embeddings';
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
   * Progresso incremental da análise semântica + persistência.
   * Emitido a cada fonte processada (e salva ou tentada) para o cliente
   * mostrar badge azul e contador de verificadas.
   */
  onSourceVerified?: (update: {
    sourceId?: string;
    title?: string;
    verifiedCount: number;
    totalSources: number;
    sourceName?: string;
    persistedCount: number;
    percentage: number;
    status: 'analyzed' | 'persisted' | 'error';
  }) => void;
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
  topicEmbeddings?: Map<string, number[]>,
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
    stats = await indexSources(sourcesToIndex, topics, topicEmbeddings);
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
 * Não registra search_queries (só no final). Retorna stats agregadas.
 */
async function persistPartialBatch(
  topics: string[],
  batch: UnderstoodSource[],
  topicEmbeddings?: Map<string, number[]>,
): Promise<{ indexed: number; errors: number } | null> {
  if (!isSupabaseConfigured() || batch.length === 0) return null;
  try {
    const stats = await indexSources(batch, topics, topicEmbeddings);
    return { indexed: stats.indexed + stats.archivedOffTopic, errors: stats.errors };
  } catch (err) {
    console.warn('[ResearchService] Falha ao indexar lote parcial:', err);
    return { indexed: 0, errors: batch.length };
  }
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

  let sharedTopicEmbeddings: Map<string, number[]> | undefined;
  let sharedTopicEmbeddingsPromise: Promise<Map<string, number[]> | undefined> | null = null;
  const getSharedTopicEmbeddings = async () => {
    if (sharedTopicEmbeddings) return sharedTopicEmbeddings;
    if (sharedTopicEmbeddingsPromise) return sharedTopicEmbeddingsPromise;

    sharedTopicEmbeddingsPromise = (async () => {
      const unique = [...new Set(topics.map((t) => t.replace(/_/g, ' ')))];
      if (unique.length === 0) return undefined;
      try {
        const vectors = await embedTexts(unique, 'RETRIEVAL_DOCUMENT');
        sharedTopicEmbeddings = new Map(unique.map((topic, i) => [topic, vectors[i]]));
      } catch (err) {
        console.warn('[ResearchService] Falha ao preparar embeddings de tópicos:', err);
      }
      return sharedTopicEmbeddings;
    })();

    return sharedTopicEmbeddingsPromise;
  };

  // 1 única embed da query, reutilizada em todos os understandSources deste request.
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
    const understood = await understandSources(
      query,
      priorPool,
      sharedQueryEmbedding,
      domain,
      {
        onSourceComplete: (src, meta) => {
          onProgress?.onSourceVerified?.({
            sourceId: src.id,
            title: src.title,
            verifiedCount: meta.index + 1,
            totalSources: meta.total,
            sourceName: src.sourceName,
            persistedCount: 0,
            percentage: Math.round(((meta.index + 1) / Math.max(1, meta.total)) * 100),
            status: src.shouldPersist ? 'persisted' : 'analyzed',
          });
        },
      },
    );
    const relevant = filterAndRankRelevant(understood);

    const indexingStats = null;

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

  // Re-entendimento completo das candidatas prévias (decisão do produto:
  // nunca reaproveitar vetor salvo sem passar pelo motor com a query atual).
  // Caminho light: retorna o pool cru sem understandSources.
  let reusedUnderstood: UnderstoodSource[] = [];
  if (priorPool.length > 0) {
    if (light) {
      reusedUnderstood = priorPool.filter((s) => !s.discarded);
    } else {
      onProgress?.onProcessingStart?.(
        priorPool.length,
        `Reutilizando ${priorPool.length} fontes da memória...`,
      );
      reusedUnderstood = filterAndRankRelevant(
        await understandSources(query, priorPool, sharedQueryEmbedding, domain)
      );
    }
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
    const lightToPersist = lightNew.map((s) => ({ ...s, shouldPersist: true }));
    const lightStats = await persistPartialBatch(topics, lightToPersist, await getSharedTopicEmbeddings());

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

  const totalToAnalyze = result.sources.length;
  onProgress?.onProcessingStart?.(
    totalToAnalyze,
    'Processamento semântico iniciado — analisando relevância...',
  );

  // A persistência bruta é durável e independente da análise. Não esperamos
  // a RPC da fila aqui: ela não deve bloquear o início do processamento semântico.
  void enqueueSourcesForPersistence(result.sources).catch((err) => {
    console.warn('[ResearchService] Não foi possível enfileirar persistência:', err);
  });

  // Persistência INCREMENTAL: cada fonte entendida pelo motor é gravada
  // assim que pronta (via onSourceComplete). Se o processo morrer no
  // meio (SIGKILL/OOM), o que já passou já está no banco.
  //
  // Contador global: o understandSources só emite para o top-K do rerank
  // (RERANK_TOP_K), mas o usuário espera ver o progresso sobre o total
  // de fontes dos scrapers (ex.: 430). O classifyOutOfTopK continua o
  // restante — ambos incrementam `verifiedCount`.
  let verifiedCount = 0;
  let persistedCount = 0;
  const emitVerified = (
    src: UnderstoodSource,
    status: 'analyzed' | 'persisted' | 'error',
  ) => {
    verifiedCount += 1;
    const pct = Math.min(
      100,
      Math.round((verifiedCount / Math.max(1, totalToAnalyze)) * 100)
    );
    onProgress?.onSourceVerified?.({
      sourceId: src.id,
      title: src.title,
      verifiedCount,
      totalSources: totalToAnalyze,
      sourceName: src.sourceName,
      persistedCount,
      percentage: pct,
      status,
    });
  };

  let understood: UnderstoodSource[] = [];
  try {
    const semanticResult = await understandSourcesByPortalQueue(
      query,
      result.sources,
      domain,
      {
        onSourceComplete: (src) => {
          emitVerified(src, src.shouldPersist ? 'persisted' : 'analyzed');
          if (src.shouldPersist) {
            void persistPartialBatch(topics, [src]).then((partial) => {
              if (partial) persistedCount += partial.indexed;
            }).catch((err) => {
              console.warn('[ResearchService] Persistência semântica assíncrona falhou:', err);
            });
          }
        },
        onPortalProgress: (progress) => {
          console.info(
            `[SemanticQueue] ${progress.portal} ${progress.index}/${progress.total} — ${progress.model}`
          );
        },
      },
    );
    understood = semanticResult.sources;
  } catch (err) {
    // Se o motor morrer no meio (quota, erro de embed, OOM parcial),
    // tenta um segundo passe "leve" para não perder a corrida dos scrapers.
    console.warn('[ResearchService] understandSources falhou, retry light:', err);
    onProgress?.onProcessingStart?.(
      result.sources.length,
      'Análise semântica interrompida — retomando com modo leve...',
    );
    try {
      understood = await understandSourcesLightFallback(
        query,
        result.sources,
        domain,
        {
          onSourceComplete: (src) => {
            emitVerified(src, src.shouldPersist ? 'persisted' : 'analyzed');
          },
        },
      );
    } catch (retryErr) {
      console.warn('[ResearchService] retry light também falhou:', retryErr);
      // Fallback final: envolve as fontes cruas como light e persiste.
      understood = result.sources.map(toLightUnderstood).map((s) => ({
        ...s,
        shouldPersist: true,
      }));
      // Raw sources are already durable in source_persistence.
      for (const src of understood) {
        emitVerified(src, 'persisted');
      }
    }
  }

  const relevantNew = filterAndRankRelevant(understood);
  onProgress?.onProcessingComplete?.(understood.length, relevantNew.length);

  // Fontes fora do top-K usam os embeddings documentais que o retrieval
  // já calculou. Isso evita uma segunda rodada de dezenas de chamadas ao Gemini.
  // A classificação residual continua sem bloquear o início da análise.
  let outOfTopK: UnderstoodSource[] = [];
  try {
    outOfTopK = await classifyOutOfTopKForPersistence(
      query,
      result.sources,
      understood,
      domain,
    );
    for (const src of outOfTopK) {
      emitVerified(src, src.shouldPersist ? 'persisted' : 'analyzed');
    }
  } catch (err) {
    console.warn('[ResearchService] Falha ao classificar fontes fora do top-K:', err);
  }

  void logSearchQuery(
    query,
    topics,
    result.sources.length + priorPool.length,
    decision?.action ?? 'new_search',
    decision?.coverageScore ?? 0,
  ).catch((err) => {
    console.warn('[ResearchService] Falha ao registrar search_queries:', err);
  });

  const indexingStats = null;

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
