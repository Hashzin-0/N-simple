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
} from './config';

/**
 * MOTOR SEMÂNTICO PRINCIPAL — 100% LLM-free.
 *
 * Para cada fonte:
 *   1. Lê o conteúdo de verdade (página/PDF completo, não só título+resumo).
 *   2. Divide em chunks e gera embeddings contextuais reais (bi-encoder).
 *   3. Compara com o embedding da pergunta do usuário via cosseno.
 *   4. Reforça com um cross-encoder (2º sinal, também local) sobre o
 *      trecho mais parecido — mesma ideia do LiteSemRAG de combinar
 *      similaridade estrutural com recuperação semântica isolada.
 *   5. Produz UM score 0-100 e categoriza o assunto real da fonte,
 *      pronto para indexar no Supabase e ser reaproveitado depois.
 *
 * Fontes com score final <= 45 são marcadas `discarded` e nunca devem
 * ser salvas nem mostradas ao usuário.
 */

export interface UnderstoodChunk {
  text: string;
  embedding: number[];
  score: number; // similaridade com a query, 0-1
}

export interface UnderstoodSource extends ScientificSource {
  semanticScore: number;
  semanticCategories: SemanticCategory[];
  bestExcerpt: string;
  discarded: boolean;
  docEmbedding: number[];
  chunks: UnderstoodChunk[];
  usedFullText: boolean;
  /** Score 0-100 de pertencimento ao domínio agronegócio/agropecuária (eixo independente da query). */
  domainScore: number;
  /** true se a fonte é sobre agro em geral, mesmo que não relevante para a query atual. */
  inAgroDomain: boolean;
  /**
   * true quando a fonte deve ser salva no banco: ou é relevante para a
   * query (semanticScore > 45), ou é irrelevante para a query mas ainda
   * assim sobre agronegócio/agropecuária (inAgroDomain). Fontes fora do
   * domínio inteiro E irrelevantes para a query nunca são persistidas.
   */
  shouldPersist: boolean;
}

// Embedding do descritor de domínio agro — calculado uma única vez e reaproveitado.
let domainAnchorEmbeddingPromise: Promise<number[]> | null = null;
function getDomainAnchorEmbedding(): Promise<number[]> {
  if (!domainAnchorEmbeddingPromise) {
    domainAnchorEmbeddingPromise = embedText(AGRO_DOMAIN_DESCRIPTOR);
  }
  return domainAnchorEmbeddingPromise;
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

async function understandOne(
  query: string,
  queryEmbedding: number[],
  source: ScientificSource
): Promise<UnderstoodSource> {
  const { text: fullText, ok: hasFullText } = await fetchFullText(source.directUrl);
  const analysisText = buildAnalysisText(source, fullText, hasFullText);

  const rawChunks = chunkText(analysisText);
  const chunkTexts = rawChunks.length > 0 ? rawChunks : [source.title];

  const chunkEmbeddings = await embedTexts(chunkTexts);
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

  const domainAnchor = await getDomainAnchorEmbedding();
  const domainCos = cosineSimilarity(docEmbedding, domainAnchor);
  const domainScore = cosineToPercentage(domainCos);
  const inAgroDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;

  // Regra do usuário: fontes ≤45% só são salvas se forem sobre agro em
  // geral (base de conhecimento futura); fora do domínio, são descartadas
  // por completo e nunca chegam ao banco.
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
    // Mantém o campo de exibição existente na UI, agora alimentado pelo score real.
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
 * Lê e entende um lote de fontes em relação à query, com paralelismo
 * limitado (importante em serverless: cada fonte pode envolver 1 fetch
 * de rede + várias inferências locais).
 */
export async function understandSources(
  query: string,
  sources: ScientificSource[]
): Promise<UnderstoodSource[]> {
  if (sources.length === 0) return [];

  const queryEmbedding = await embedText(query);
  const results: UnderstoodSource[] = new Array(sources.length);
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const i = cursor++;
      try {
        results[i] = await understandOne(query, queryEmbedding, sources[i]);
      } catch (err) {
        console.warn('[SemanticEngine] Falha ao entender fonte, descartando:', sources[i]?.title, err);
        results[i] = {
          ...sources[i],
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

  const workerCount = Math.min(ENGINE_CONCURRENCY, sources.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

/** Aplica a regra única de descarte (≤45%) e ordena por relevância real. */
export function filterAndRankRelevant(sources: UnderstoodSource[]): UnderstoodSource[] {
  return sources
    .filter((s) => !s.discarded)
    .sort((a, b) => b.semanticScore - a.semanticScore);
}
