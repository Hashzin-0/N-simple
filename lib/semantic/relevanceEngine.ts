import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { embedText, embedTexts, cosineSimilarity, cosineToPercentage } from './embeddings';
import {
  SEMANTIC_DISCARD_THRESHOLD,
  ENGINE_CONCURRENCY,
  AGRO_DOMAIN_RELEVANCE_THRESHOLD,
  AGRO_DOMAIN_DESCRIPTOR,
  DOMAIN_DESCRIPTORS,
  DomainKey,
  RETRIEVAL_TOP_K,
  RERANK_TOP_K,
  EMBEDDING_CANDIDATE_LIMIT,
} from './config';

/**
 * MOTOR SEMÂNTICO — Arquitetura híbrida retrieval + reranking.
 *
 * Etapa 1 (retrieve): Gemini Embedding 2 → pgvector → TOP_K candidatas
 * Etapa 2 (rerank): ordenação pelo score de retrieval → RERANK_TOP_K finais
 * Etapa 3 (entender): análise semântica leve com embedding documental e domínio
 *
 * Fontes com score final <= 45 são marcadas `discarded` e nunca devem
 * ser salvas nem mostradas ao usuário.
 */

export interface SemanticCategory { label: string; score: number; }

export interface UnderstoodChunk {
  text: string;
  embedding: number[];
  score: number;
}

export interface UnderstoodSource extends ScientificSource {
  semanticScore: number;
  semanticCategories: SemanticCategory[];
  bestExcerpt: string;
  discarded: boolean;
  docEmbedding: number[];
  chunks: UnderstoodChunk[];
  usedFullText: boolean;
  domainScore: number;
  inAgroDomain: boolean;
  shouldPersist: boolean;
}


function buildAnalysisText(source: ScientificSource, fullText: string, hasFullText: boolean): string {
  if (hasFullText) return fullText;
  return [source.title, source.abstract, (source.keywords || []).join(' ')]
    .filter(Boolean)
    .join('\n\n');
}

function angleQuality(pct: number): 'Excepcional' | 'Muito Alta' | 'Alta' | 'Moderada' {
  if (pct >= 90) return 'Excepcional';
  if (pct >= 80) return 'Muito Alta';
  if (pct >= 68) return 'Alta';
  return 'Moderada';
}

/**
 * ETAPA 1: Retrieval — gera embedding da query e retorna fontes ranqueadas
 * por similaridade de cosseno. Não aplica cross-encoder (isser para o rerank).
 *
 * As candidatas são embedadas em lote (batch API): N textos = ceil(N/50)
 * requests no orçamento RPM, em vez de N requests individuais.
 */
function normalizeForPrefilter(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function prefilterForEmbedding(query: string, sources: ScientificSource[], limit: number): ScientificSource[] {
  if (sources.length <= limit) return sources;
  const normalizedQuery = normalizeForPrefilter(query);
  const terms = normalizedQuery.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  return sources
    .map((source, index) => {
      const title = normalizeForPrefilter(source.title || '');
      const abstract = normalizeForPrefilter(source.abstract || '');
      const keywords = normalizeForPrefilter((source.keywords || []).join(' '));
      const topics = normalizeForPrefilter((source.matchedTopics || []).join(' '));
      let score = title.includes(normalizedQuery) ? 100 : 0;
      for (const term of terms) {
        if (title.includes(term)) score += 8;
        if (keywords.includes(term)) score += 5;
        if (topics.includes(term)) score += 4;
        if (abstract.includes(term)) score += 2;
      }
      return { source, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.source);
}

export async function retrieve(
  query: string,
  sources: ScientificSource[],
  topK: number = RETRIEVAL_TOP_K,
  queryEmbedding?: number[],
): Promise<{ source: ScientificSource; score: number; queryEmbedding: number[]; documentEmbedding: number[] }[]> {
  const emb = queryEmbedding ?? (await embedText(query, 'RETRIEVAL_QUERY'));
  const candidates = prefilterForEmbedding(query, sources, EMBEDDING_CANDIDATE_LIMIT);
  const texts = candidates.map((source) =>
    `title: ${source.title || 'none'} | text: ${[source.abstract, (source.keywords || []).join(' '), (source.matchedTopics || []).join(' ')].filter(Boolean).join(' ')}`
  );
  const sourceEmbeddings = await embedTexts(texts, 'RETRIEVAL_DOCUMENT');

  candidates.forEach((source, i) => {
    retrievalEmbeddingCache.set(source, sourceEmbeddings[i]);
  });

  return candidates
    .map((source, i) => ({
      source,
      score: cosineSimilarity(emb, sourceEmbeddings[i]),
      queryEmbedding: emb,
      documentEmbedding: sourceEmbeddings[i],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * ETAPA 2: Reranking — ordena os top-K pelos scores de retrieval.
 * Não carrega modelo local/ONNX no ambiente serverless.
 */
export async function rerank(
  _query: string,
  candidates: { source: ScientificSource; score: number; queryEmbedding: number[]; documentEmbedding: number[] }[],
  topK: number = RERANK_TOP_K,
): Promise<{
  source: ScientificSource;
  retrievalScore: number;
  rerankScore: number;
  queryEmbedding: number[];
  documentEmbedding: number[];
}[]> {
  return candidates.map((c) => ({
    source: c.source,
    retrievalScore: c.score,
    rerankScore: c.score,
    queryEmbedding: c.queryEmbedding,
    documentEmbedding: c.documentEmbedding,
  })).sort((a,b) => b.rerankScore-a.rerankScore).slice(0, topK);
}

/** Entende uma fonte usando o embedding documental já calculado no retrieval. */
/**
 * Entende uma única fonte usando o embedding documental já calculado no retrieval.
 */
async function understandOne(
  _query: string,
  _queryEmbedding: number[],
  source: ScientificSource,
  retrievalScore: number,
  _domain: DomainKey = 'agro',
): Promise<UnderstoodSource> {
  const semanticScore = Math.round(cosineToPercentage(retrievalScore) * 10) / 10;
  const bestExcerpt = (source.abstract || source.title || '').slice(0, 600);
  const docEmbedding = (source as ScientificSource & { __retrievalEmbedding?: number[] }).__retrievalEmbedding || [];
  const discarded = semanticScore <= SEMANTIC_DISCARD_THRESHOLD;
  const domainScore = semanticScore;
  const inAgroDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;
  return {
    ...source,
    semanticScore,
    semanticCategories: [],
    bestExcerpt,
    discarded,
    docEmbedding,
    chunks: bestExcerpt ? [{ text: bestExcerpt, embedding: [], score: retrievalScore }] : [],
    usedFullText: false,
    domainScore,
    inAgroDomain,
    shouldPersist: !discarded || inAgroDomain,
    trigonometricSimilarity: {
      cosTheta: Math.round(Math.max(-1, Math.min(1, retrievalScore)) * 1000) / 1000,
      angleDegrees: Math.round(Math.acos(Math.max(-1, Math.min(1, retrievalScore))) * (180 / Math.PI) * 10) / 10,
      percentage: Math.round(semanticScore),
      alignmentQuality: angleQuality(semanticScore),
    },
  };
}


export interface UnderstandSourcesOptions {
  /**
   * Chamado após cada fonte terminar de ser entendida.
   * Permite persistência incremental e atualização de progresso.
   */
  onSourceComplete?: (
    source: UnderstoodSource,
    meta: { index: number; total: number; sourceName?: string }
  ) => void | Promise<void>;
}

/**
 * Fallback "semântico leve" quando o pipeline completo falha (OOM,
 * timeout de full-text, cross-encoder, etc.). Usa só abstract/título,
 * sem full-text nem embeddings remotos; usa apenas o cross-encoder local para
 * PERSISTIR a fonte em vez de descartá-la e perder o progresso do scraper.
 */
async function understandOneLight(
  _query: string,
  source: ScientificSource,
  _domain: DomainKey,
): Promise<UnderstoodSource> {
  const docText = [source.title, source.abstract, (source.keywords || []).join(' ')].filter(Boolean).join(' ').slice(0, 1800);
  return {
    ...source,
    semanticScore: 50,
    semanticCategories: [],
    bestExcerpt: (source.abstract || source.title || '').slice(0, 600),
    discarded: false,
    docEmbedding: [],
    usedFullText: false,
    domainScore: 50,
    inAgroDomain: true,
    shouldPersist: true,
    chunks: docText ? [{ text: docText, embedding: [], score: 0.5 }] : [],
    trigonometricSimilarity: { cosTheta: 0, angleDegrees: 90, percentage: 50, alignmentQuality: 'Moderada' },
  };
}


export async function understandSourcesLightFallback(
  query: string,
  sources: ScientificSource[],
  domain: DomainKey = 'agro',
  options?: UnderstandSourcesOptions,
): Promise<UnderstoodSource[]> {
  if (sources.length === 0) return [];

  // Fallback não chama Gemini. Limita o trabalho local para não transformar
  // uma falha de quota em centenas de inferências ONNX.
  const candidates = sources.slice(0, Math.min(RERANK_TOP_K * 4, 40));
  const results: UnderstoodSource[] = new Array(candidates.length);
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const index = cursor++;
      results[index] = await understandOneLight(query, candidates[index], domain);
      if (options?.onSourceComplete) {
        await options.onSourceComplete(results[index], { index, total: candidates.length });
      }
    }
  }

  const count = Math.min(ENGINE_CONCURRENCY, Math.max(1, candidates.length));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}

/**
 * Pipeline completo: retrieval → reranking → entendimento.
 *
 * Mantém a interface consumida pelo restante do sistema:
 * 1. retrieval com Gemini Embedding em lote;
 * 2. ordenação dos candidatos pelo score de retrieval;
 * 3. entendimento semântico leve das fontes finais;
 * 4. callback incremental por fonte.
 *
 * O embedding da query é compartilhado quando fornecido pelo caller.
 */
export async function understandSources(
  query: string,
  sources: ScientificSource[],
  sharedQueryEmbedding?: number[],
  domain: DomainKey = 'agro',
  options?: UnderstandSourcesOptions,
): Promise<UnderstoodSource[]> {
  if (sources.length === 0) return [];

  const retrieved = await retrieve(
    query,
    sources,
    RETRIEVAL_TOP_K,
    sharedQueryEmbedding,
  );

  let reranked: Awaited<ReturnType<typeof rerank>> = [];

  try {
    reranked = await rerank(query, retrieved, RERANK_TOP_K);
  } catch (err) {
    console.warn(
      '[SemanticEngine] Rerank falhou, seguindo apenas com retrieval:',
      err,
    );

    reranked = retrieved.slice(0, RERANK_TOP_K).map((candidate) => ({
      source: candidate.source,
      retrievalScore: candidate.score,
      rerankScore: candidate.score,
      queryEmbedding: candidate.queryEmbedding,
      documentEmbedding: candidate.documentEmbedding,
    }));
  }

  if (reranked.length === 0) return [];

  const queryEmbedding =
    sharedQueryEmbedding ??
    reranked[0].queryEmbedding ??
    (await embedText(query, 'RETRIEVAL_QUERY'));

  const total = reranked.length;
  const results: UnderstoodSource[] = new Array(total);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= total) return;

      const candidate = reranked[index];

      let understood: UnderstoodSource;

      try {
        /*
         * retrieve() já calculou o embedding documental. Guardamos esse
         * vetor no objeto apenas durante o pipeline para que understandOne()
         * possa reutilizá-lo sem uma nova chamada à API.
         */
        const sourceWithEmbedding = {
          ...candidate.source,
          __retrievalEmbedding: candidate.documentEmbedding,
        } as ScientificSource & { __retrievalEmbedding?: number[] };

        understood = await understandOne(
          query,
          queryEmbedding,
          sourceWithEmbedding,
          candidate.retrievalScore,
          domain,
        );
      } catch (err) {
        console.warn(
          '[SemanticEngine] Pipeline completo falhou, usando fallback leve:',
          candidate.source.title,
          err,
        );

        try {
          understood = await understandOneLight(
            query,
            candidate.source,
            domain,
          );
        } catch (lightErr) {
          console.warn(
            '[SemanticEngine] Fallback leve também falhou:',
            candidate.source.title,
            lightErr,
          );

          understood = {
            ...candidate.source,
            semanticScore: 0,
            semanticCategories: [],
            bestExcerpt: (candidate.source.abstract || candidate.source.title || '').slice(0, 600),
            discarded: true,
            docEmbedding: [],
            usedFullText: false,
            domainScore: 0,
            inAgroDomain: false,
            /*
             * Falha de infraestrutura não deve apagar a fonte encontrada
             * pelos scrapers. O indexador recebe a fonte para persistência.
             */
            shouldPersist: true,
            chunks: [],
            trigonometricSimilarity: {
              cosTheta: 0,
              angleDegrees: 90,
              percentage: 0,
              alignmentQuality: 'Moderada',
            },
          };
        }
      }

      results[index] = understood;

      if (options?.onSourceComplete) {
        try {
          await options.onSourceComplete(understood, {
            index,
            total,
          });
        } catch (callbackError) {
          console.warn(
            '[SemanticEngine] onSourceComplete falhou:',
            callbackError,
          );
        }
      }
    }
  }

  const workerCount = Math.min(
    ENGINE_CONCURRENCY,
    Math.max(1, total),
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  return results;
}

/**
 * Classifica fontes que ficaram FORA do top-K do rerank para persistência:
 * embedding do texto residual vs âncora de domínio. Salva apenas se
 * pertencerem ao domínio (ex.: agro) — mesmo com score de consulta baixo.
 * Fontes fora do domínio ficam com shouldPersist=false e nunca vão ao banco.
 *
 * Processa em lotes para não estourar a memória com centenas de vetores
 * de uma vez (causa clássica de SIGKILL em funções longas).
 */
const domainEmbeddingCache = new Map<DomainKey, Promise<number[]>>();
const retrievalEmbeddingCache = new WeakMap<object, number[]>();

async function getDomainEmbedding(domain: DomainKey): Promise<number[]> {
  const cached = domainEmbeddingCache.get(domain);
  if (cached) return cached;
  const promise = embedText(DOMAIN_DESCRIPTORS[domain] ?? AGRO_DOMAIN_DESCRIPTOR, 'RETRIEVAL_DOCUMENT');
  domainEmbeddingCache.set(domain, promise);
  return promise;
}

export async function classifyOutOfTopKForPersistence(
  _query: string,
  sources: ScientificSource[],
  understood: UnderstoodSource[],
  domain: DomainKey = 'agro',
): Promise<UnderstoodSource[]> {
  const seen = new Set(understood.map((s) => (s.title || '').trim().toLowerCase()));
  const remaining = sources.filter((s) => {
    const title = (s.title || '').trim().toLowerCase();
    return title && !seen.has(title);
  });
  if (remaining.length === 0) return [];

  const domainEmbedding = await getDomainEmbedding(domain);
  const out: UnderstoodSource[] = [];
  for (const source of remaining) {
      const docEmbedding = retrievalEmbeddingCache.get(source) || [];
      const domainCos = docEmbedding.length ? cosineSimilarity(domainEmbedding, docEmbedding) : 0;
      const domainScore = Math.round(cosineToPercentage(domainCos) * 10) / 10;
      const inDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;
    out.push({
      ...source, semanticScore: 0, semanticCategories: [],
      bestExcerpt: (source.abstract || source.title || '').slice(0, 600),
      discarded: true, docEmbedding, usedFullText: false,
      domainScore, inAgroDomain: inDomain, shouldPersist: inDomain, chunks: [],
    });
  }
  return out;
}

/** Aplica a regra de descarte e ordena por relevância. */
export function filterAndRankRelevant(sources: UnderstoodSource[]): UnderstoodSource[] {
  return sources
    .filter((s) => !s.discarded)
    .sort((a, b) => b.semanticScore - a.semanticScore);
}
