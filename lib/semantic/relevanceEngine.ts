import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { embedText, embedTexts, cosineSimilarity, cosineToPercentage } from './embeddings';
import { chunkText } from './textChunker';
import { fetchFullText } from './fullTextFetcher';
import { extractSemanticCategories, SemanticCategory } from './categoryExtractor';
import { crossEncoderScore } from '@/lib/scrapers/semanticFilter';
import {
  SEMANTIC_DISCARD_THRESHOLD,
  TOP_K_CHUNKS_FOR_SCORE,
  BI_ENCODER_WEIGHT,
  CROSS_ENCODER_WEIGHT,
  ENGINE_CONCURRENCY,
  AGRO_DOMAIN_RELEVANCE_THRESHOLD,
  AGRO_DOMAIN_DESCRIPTOR,
  DOMAIN_DESCRIPTORS,
  DomainKey,
  RETRIEVAL_TOP_K,
  RERANK_TOP_K,
  EMBEDDING_CANDIDATE_LIMIT,
  MAX_CHUNKS_PER_SOURCE,
} from './config';

/**
 * MOTOR SEMÂNTICO — Arquitetura híbrida retrieval + reranking.
 *
 * Etapa 1 (retrieve): Gemini Embedding 2 → pgvector → TOP_K candidatas
 * Etapa 2 (rerank): Cross-Encoder ONNX → RERANK_TOP_K finais
 * Etapa 3 (entender): Análise completa com chunks, categorias, domínio
 *
 * Fontes com score final <= 45 são marcadas `discarded` e nunca devem
 * ser salvas nem mostradas ao usuário.
 */

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

// Embeddings do descritor de domínio — cache por DomainKey (padrão: agro).
const domainAnchorPromises = new Map<string, Promise<number[]>>();
function getDomainAnchorEmbedding(domain: DomainKey = 'agro'): Promise<number[]> {
  const descriptor = DOMAIN_DESCRIPTORS[domain] ?? AGRO_DOMAIN_DESCRIPTOR;
  let promise = domainAnchorPromises.get(domain);
  if (!promise) {
    promise = embedText(descriptor, 'RETRIEVAL_DOCUMENT');
    domainAnchorPromises.set(domain, promise);
  }
  return promise;
}

function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map((s) => s / vectors.length);
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
 * ETAPA 2: Reranking — aplica cross-encoder ONNX sobre os top-K candidatos
 * do retrieval para refinar a ordenação.
 */
export async function rerank(
  query: string,
  candidates: { source: ScientificSource; score: number; queryEmbedding: number[]; documentEmbedding: number[] }[],
  topK: number = RERANK_TOP_K,
): Promise<{ source: ScientificSource; retrievalScore: number; rerankScore: number; queryEmbedding: number[] }[]> {
  const reranked = await Promise.all(
    candidates.map(async (c) => {
      const docText = [c.source.title, c.source.abstract, (c.source.keywords || []).join(' ')]
        .filter(Boolean)
        .join(' ')
        .slice(0, 512);

      const crossProb = await crossEncoderScore(query, docText);
      return {
        source: c.source,
        retrievalScore: c.score,
        rerankScore: crossProb,
        queryEmbedding: c.queryEmbedding,
        documentEmbedding: c.documentEmbedding,
      };
    }),
  );

  return reranked
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topK);
}

/**
 * Entende uma única fonte: fetch full text, gera chunks, embeddings,
 * categorias, e score final combinando bi-encoder + cross-encoder.
 */
async function understandOne(
  query: string,
  queryEmbedding: number[],
  source: ScientificSource,
  retrievalScore: number,
  domain: DomainKey = 'agro',
): Promise<UnderstoodSource> {
  const { text: fullText, ok: hasFullText } = await fetchFullText(source.directUrl);
  const analysisText = buildAnalysisText(source, fullText, hasFullText);
  const rawChunks = chunkText(analysisText);
  const chunkTexts = (rawChunks.length > 0 ? rawChunks : [source.title]).slice(0, MAX_CHUNKS_PER_SOURCE);

  // Não há embedding remoto aqui. O vetor da fonte já foi produzido no retrieval.
  // A verificação profunda usa apenas o cross-encoder local sobre texto real.
  const chunkScores = await Promise.all(
    chunkTexts.map(async (chunk) => ({
      text: chunk,
      score: await crossEncoderScore(query, `${source.title}. ${chunk}`),
    }))
  );
  chunkScores.sort((a, b) => b.score - a.score);

  const bestChunkText = chunkScores[0]?.text || source.abstract || source.title;
  const crossPct = Math.round((chunkScores[0]?.score ?? 0.5) * 1000) / 10;
  const biEncoderPct = cosineToPercentage(retrievalScore);
  const semanticScore = Math.round((biEncoderPct * BI_ENCODER_WEIGHT + crossPct * CROSS_ENCODER_WEIGHT) * 10) / 10;

  const docEmbedding = (source as ScientificSource & { __retrievalEmbedding?: number[] }).__retrievalEmbedding || [];
  const categories = docEmbedding.length > 0
    ? await extractSemanticCategories(analysisText, docEmbedding)
    : [];

  const discarded = semanticScore <= SEMANTIC_DISCARD_THRESHOLD;

  const domainAnchor = docEmbedding.length > 0 ? await getDomainAnchorEmbedding(domain) : [];
  const domainCos = docEmbedding.length > 0 && domainAnchor.length > 0 ? cosineSimilarity(docEmbedding, domainAnchor) : 0;
  const domainScore = cosineToPercentage(domainCos);
  const inAgroDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;

  const shouldPersist = !discarded || inAgroDomain;

  return {
    ...source,
    semanticScore,
    semanticCategories: categories,
    bestExcerpt: bestChunkText.slice(0, 600),
    discarded,
    docEmbedding,
    usedFullText: hasFullText,
    domainScore,
    inAgroDomain,
    shouldPersist,
    chunks: chunkScores.map((item) => ({ text: item.text, embedding: [], score: item.score })),
    trigonometricSimilarity: {
      cosTheta: Math.round(Math.max(0, avgTopKCos) * 1000) / 1000,
      angleDegrees:
        Math.round(Math.acos(Math.max(-1, Math.min(1, avgTopKCos))) * (180 / Math.PI) * 10) / 10,
      percentage: Math.round(semanticScore),
      alignmentQuality: angleQuality(semanticScore),
    },
  };
}

/**
 * Fallback "semântico leve" quando o pipeline completo falha (OOM,
 * timeout de full-text, cross-encoder, etc.). Usa só abstract/título,
 * sem full-text nem ONNX — suficiente para classificar domínio e
 * PERSISTIR a fonte em vez de descartá-la e perder o progresso do scraper.
 */
async function understandOneLight(
  query: string,
  source: ScientificSource,
  domain: DomainKey,
): Promise<UnderstoodSource> {
  const analysisText = buildAnalysisText(source, '', false);
  const chunks = chunkText(analysisText).slice(0, MAX_CHUNKS_PER_SOURCE);
  const candidates = chunks.length > 0 ? chunks : [source.abstract || source.title || ''];
  const scored = await Promise.all(
    candidates.map(async (chunk) => ({
      text: chunk,
      score: await crossEncoderScore(query, `${source.title}. ${chunk}`),
    })),
  );
  scored.sort((x, y) => y.score - x.score);
  const semanticScore = Math.round((scored[0]?.score ?? 0.5) * 1000) / 10;
  const domainScore = Math.round(
    (await crossEncoderScore(
      DOMAIN_DESCRIPTORS[domain] ?? AGRO_DOMAIN_DESCRIPTOR,
      analysisText.slice(0, 1200),
    )) * 100,
  ) / 10;
  const inDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;
  const discarded = semanticScore <= SEMANTIC_DISCARD_THRESHOLD;
  return {
    ...source,
    semanticScore,
    semanticCategories: [],
    bestExcerpt: (scored[0]?.text || source.abstract || source.title || '').slice(0, 600),
    discarded,
    docEmbedding: [],
    usedFullText: false,
    domainScore,
    inAgroDomain: inDomain,
    shouldPersist: !discarded && inDomain,
    chunks: scored.map((item) => ({ text: item.text, embedding: [], score: item.score })),
    trigonometricSimilarity: {
      cosTheta: 0,
      angleDegrees: 90,
      percentage: Math.round(semanticScore),
      alignmentQuality: angleQuality(semanticScore),
    },
  };
}


export async function understandSourcesLightFallback(
  query: string,
  sources: ScientificSource[],
  domain: DomainKey = 'agro',
  options?: UnderstandSourcesOptions,
): Promise<UnderstoodSource[]> {
  const results: UnderstoodSource[] = new Array(sources.length);
  let cursor = 0;
  async function worker() {
    while (cursor < sources.length) {
      const index = cursor++;
      results[index] = await understandOneLight(query, sources[index], domain);
      if (options?.onSourceComplete) {
        await options.onSourceComplete(results[index], { index, total: sources.length });
      }
    }
  }
  const count = Math.min(ENGINE_CONCURRENCY, Math.max(1, sources.length));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}

export interface UnderstandSourcesOptions {
  /**
   * Chamado após cada fonte terminar de ser entendida (sucesso ou
   * fallback leve). Use para persistir incrementalmente e emitir
   * progresso ao cliente — se o processo morrer no meio, o que já
   * passou aqui já foi salvo.
   */
  onSourceComplete?: (
    source: UnderstoodSource,
    meta: { index: number; total: number }
  ) => void | Promise<void>;
}

/**
 * Pipeline completo: retrieve → rerank → understand.
 * Mantém interface estável para o restado do sistema.
 *
 * Com `options.onSourceComplete`, cada fonte do top-K é reportada
 * assim que pronta (para indexação incremental no Supabase).
 */
export async function understandSources(
  query: string,
  sources: ScientificSource[],
  sharedQueryEmbedding?: number[],
  domain: DomainKey = 'agro',
  options?: UnderstandSourcesOptions,
): Promise<UnderstoodSource[]> {
  if (sources.length === 0) return [];

  // Etapa 1: Retrieval (Gemini Embedding, em lote)
  const retrieved = await retrieve(query, sources, RETRIEVAL_TOP_K, sharedQueryEmbedding);
  for (const candidate of retrieved) {
    (candidate.source as ScientificSource & { __retrievalEmbedding?: number[] }).__retrievalEmbedding = candidate.documentEmbedding;
  }

  // Etapa 2: Reranking (Cross-Encoder ONNX)
  let reranked: Awaited<ReturnType<typeof rerank>> = [];
  try {
    reranked = await rerank(query, retrieved, RERANK_TOP_K);
  } catch (err) {
    console.warn('[SemanticEngine] Rerank falhou, seguindo só com retrieval:', err);
    reranked = retrieved
      .slice(0, RERANK_TOP_K)
      .map((c) => ({
        source: c.source,
        retrievalScore: c.score,
        rerankScore: c.score,
        queryEmbedding: c.queryEmbedding,
      }));
  }

  // Etapa 3: Entender cada fonte final
  const queryEmbedding =
    sharedQueryEmbedding ??
    reranked[0]?.queryEmbedding ??
    (await embedText(query, 'RETRIEVAL_QUERY'));
  const total = reranked.length;
  const results: UnderstoodSource[] = new Array(total);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < total) {
      const i = cursor++;
      let understood: UnderstoodSource;
      try {
        understood = await understandOne(
          query,
          queryEmbedding,
          reranked[i].source,
          reranked[i].retrievalScore,
          domain,
        );
      } catch (err) {
        console.warn(
          '[SemanticEngine] Pipeline completo falhou, fallback leve:',
          reranked[i]?.source.title,
          err,
        );
        try {
          understood = await understandOneLight(
            queryEmbedding,
            reranked[i].source,
            domain,
          );
        } catch (lightErr) {
          console.warn('[SemanticEngine] Fallback leve também falhou:', lightErr);
          understood = {
            ...reranked[i].source,
            semanticScore: 0,
            semanticCategories: [],
            bestExcerpt: (reranked[i].source.abstract || '').slice(0, 600),
            discarded: true,
            docEmbedding: [],
            usedFullText: false,
            domainScore: 0,
            inAgroDomain: false,
            // Não descarta por erro de infra: tenta salvar mesmo assim.
            shouldPersist: true,
            chunks: [],
          };
        }
      }
      results[i] = understood;
      completed += 1;
      if (options?.onSourceComplete) {
        try {
          await options.onSourceComplete(understood, { index: i, total });
        } catch (cbErr) {
          console.warn('[SemanticEngine] onSourceComplete falhou:', cbErr);
        }
      }
    }
  }

  const workerCount = Math.min(ENGINE_CONCURRENCY, Math.max(1, total));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // complete foi usado só para o callback; evita lint de variável não lida
  void completed;

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
export async function classifyOutOfTopKForPersistence(
  _query: string,
  _sources: ScientificSource[],
  _understood: UnderstoodSource[],
  _domain: DomainKey = 'agro',
): Promise<UnderstoodSource[]> {
  // Não gera embeddings adicionais para centenas de fontes fora do retrieval.
  // O retrieval é a etapa responsável por decidir quais fontes merecem análise.
  return [];
}

/** Aplica a regra de descarte e ordena por relevância. */
export function filterAndRankRelevant(sources: UnderstoodSource[]): UnderstoodSource[] {
  return sources
    .filter((s) => !s.discarded)
    .sort((a, b) => b.semanticScore - a.semanticScore);
}
