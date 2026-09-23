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
export async function retrieve(
  query: string,
  sources: ScientificSource[],
  topK: number = RETRIEVAL_TOP_K,
  queryEmbedding?: number[],
): Promise<{ source: ScientificSource; score: number; queryEmbedding: number[] }[]> {
  const emb = queryEmbedding ?? (await embedText(query, 'RETRIEVAL_QUERY'));

  const texts = sources.map((source) =>
    [source.title, source.abstract, (source.keywords || []).join(' ')]
      .filter(Boolean)
      .join(' '),
  );
  const sourceEmbeddings = await embedTexts(texts, 'RETRIEVAL_DOCUMENT');

  return sources
    .map((source, i) => ({
      source,
      score: cosineSimilarity(emb, sourceEmbeddings[i]),
      queryEmbedding: emb,
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
  candidates: { source: ScientificSource; score: number; queryEmbedding: number[] }[],
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
  const chunkTexts = rawChunks.length > 0 ? rawChunks : [source.title];

  // Mesmo taskType do queryEmbedding (RETRIEVAL_*) — alinhado ao espaço
  // vetorial do retrieve/consulta (Gemini exige mesmo task family).
  const chunkEmbeddings = await embedTexts(chunkTexts, 'RETRIEVAL_DOCUMENT');
  const chunkScores = chunkEmbeddings.map((emb) => cosineSimilarity(emb, queryEmbedding));

  const orderedIdx = chunkScores
    .map((score, idx) => ({ score, idx }))
    .sort((a, b) => b.score - a.score);

  const topK = orderedIdx.slice(0, TOP_K_CHUNKS_FOR_SCORE);
  const avgTopKCos = topK.reduce((sum, c) => sum + c.score, 0) / Math.max(1, topK.length);
  const biEncoderPct = cosineToPercentage(avgTopKCos);

  const bestIdx = orderedIdx[0]?.idx ?? 0;
  const bestChunkText = chunkTexts[bestIdx] || chunkTexts[0] || source.abstract || source.title;

  const crossProb = await crossEncoderScore(query, `${source.title}. ${bestChunkText}`);
  const crossPct = Math.round(crossProb * 1000) / 10;

  const semanticScore =
    Math.round((biEncoderPct * BI_ENCODER_WEIGHT + crossPct * CROSS_ENCODER_WEIGHT) * 10) / 10;

  const docEmbedding = centroid(chunkEmbeddings);
  const categories = await extractSemanticCategories(analysisText, docEmbedding);

  const discarded = semanticScore <= SEMANTIC_DISCARD_THRESHOLD;

  const domainAnchor = await getDomainAnchorEmbedding(domain);
  const domainCos = cosineSimilarity(docEmbedding, domainAnchor);
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
    chunks: chunkTexts.map((text, i) => ({
      text,
      embedding: chunkEmbeddings[i],
      score: chunkScores[i],
    })),
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
 * Pipeline completo: retrieve → rerank → understand.
 * Mantém interface estável para o restante do sistema.
 */
export async function understandSources(
  query: string,
  sources: ScientificSource[],
  sharedQueryEmbedding?: number[],
  domain: DomainKey = 'agro',
): Promise<UnderstoodSource[]> {
  if (sources.length === 0) return [];

  // Etapa 1: Retrieval (Gemini Embedding, em lote)
  const retrieved = await retrieve(query, sources, RETRIEVAL_TOP_K, sharedQueryEmbedding);

  // Etapa 2: Reranking (Cross-Encoder ONNX)
  const reranked = await rerank(query, retrieved, RERANK_TOP_K);

  // Etapa 3: Entender cada fonte final
  const queryEmbedding =
    sharedQueryEmbedding ??
    reranked[0]?.queryEmbedding ??
    (await embedText(query, 'RETRIEVAL_QUERY'));
  const results: UnderstoodSource[] = new Array(reranked.length);
  let cursor = 0;

  async function worker() {
    while (cursor < reranked.length) {
      const i = cursor++;
      try {
        results[i] = await understandOne(
          query,
          queryEmbedding,
          reranked[i].source,
          reranked[i].retrievalScore,
          domain,
        );
      } catch (err) {
        console.warn('[SemanticEngine] Falha ao entender fonte, descartando:', reranked[i]?.source.title, err);
        results[i] = {
          ...reranked[i].source,
          semanticScore: 0,
          semanticCategories: [],
          bestExcerpt: '',
          discarded: true,
          docEmbedding: [],
          usedFullText: false,
          domainScore: 0,
          inAgroDomain: false,
          shouldPersist: false,
          chunks: [],
        };
      }
    }
  }

  const workerCount = Math.min(ENGINE_CONCURRENCY, reranked.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

/**
 * Classifica fontes que ficaram FORA do top-K do rerank para persistência:
 * embedding do texto residual vs âncora de domínio. Salva apenas se
 * pertencerem ao domínio (ex.: agro) — mesmo com score de consulta baixo.
 * Fontes fora do domínio ficam com shouldPersist=false e nunca vão ao banco.
 */
export async function classifyOutOfTopKForPersistence(
  query: string,
  sources: ScientificSource[],
  understood: UnderstoodSource[],
  domain: DomainKey = 'agro',
): Promise<UnderstoodSource[]> {
  if (sources.length === 0) return [];

  const seen = new Set(understood.map((s) => (s.title || '').trim().toLowerCase()));
  const remaining = sources.filter((s) => {
    const t = (s.title || '').trim().toLowerCase();
    return t && !seen.has(t);
  });
  if (remaining.length === 0) return [];

  try {
    const texts = remaining.map((s) =>
      [s.title, s.abstract, (s.keywords || []).join(' ')].filter(Boolean).join(' ')
    );
    const docEmbeddings = await embedTexts(texts, 'RETRIEVAL_DOCUMENT');
    const anchor = await getDomainAnchorEmbedding(domain);

    return remaining.map((s, i) => {
      const docEmbedding = docEmbeddings[i] || [];
      const domainScore =
        docEmbedding.length > 0 ? cosineToPercentage(cosineSimilarity(docEmbedding, anchor)) : 0;
      const inDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;
      return {
        ...s,
        semanticScore: 0,
        semanticCategories: [],
        bestExcerpt: (s.abstract || '').slice(0, 600),
        discarded: true,
        docEmbedding,
        usedFullText: false,
        domainScore,
        inAgroDomain: inDomain,
        shouldPersist: inDomain,
        chunks: [],
      } satisfies UnderstoodSource;
    });
  } catch (err) {
    console.warn('[SemanticEngine] classifyOutOfTopKForPersistence falhou:', err);
    return [];
  }
}

/** Aplica a regra de descarte e ordena por relevância. */
export function filterAndRankRelevant(sources: UnderstoodSource[]): UnderstoodSource[] {
  return sources
    .filter((s) => !s.discarded)
    .sort((a, b) => b.semanticScore - a.semanticScore);
}
