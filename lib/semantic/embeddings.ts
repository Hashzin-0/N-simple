import { EMBEDDING_DIM } from './config';
import { geminiEmbedText, geminiEmbedTexts } from './geminiEmbeddings';

/**
 * Interface estável de embeddings para todo o sistema.
 *
 * Internamente, usa Gemini Embedding 2 (API) em vez de ONNX local.
 * O restante do sistema não precisa saber qual fornecedor gera o embedding.
 *
 * Mantém a mesma interface pública (embedText, embedTexts) para
 * compatibilidade com relevanceEngine.ts, categoryExtractor.ts, etc.
 */

/**
 * Gera o vetor de embedding de um único texto.
 * Usa Gemini Embedding 2 via API (~0MB memória local).
 */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const clean = (text || '').trim();
  if (!clean) return new Array(EMBEDDING_DIM).fill(0);

  return geminiEmbedText(clean, taskType);
}

/**
 * Gera embeddings para múltiplos textos.
 * Processa em lotes via Batch API para controlar rate limits e memória.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return geminiEmbedTexts(texts, 50);
}

/**
 * Similaridade de cosseno real entre dois vetores densos.
 * cos(θ) = (A · B) / (||A|| * ||B||)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Converte cosseno [-1, 1] em score percentual [0, 100] realista.
 * Embeddings de Gemini ficam ~0.35-0.9 para pares relevantes.
 * Normalizamos nesse range empírico para produzir um score interpretável.
 */
export function cosineToPercentage(cos: number): number {
  const MIN = 0.05;
  const MAX = 0.85;
  const clamped = Math.max(MIN, Math.min(MAX, cos));
  const pct = ((clamped - MIN) / (MAX - MIN)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}
