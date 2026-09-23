import { EMBEDDING_DIM } from './config';
import { geminiEmbedText, geminiEmbedTexts, EmbedTaskType } from './geminiEmbeddings';

/**
 * Interface estável de embeddings para todo o sistema.
 *
 * Internamente, usa Gemini Embedding 2 (API) em vez de ONNX local.
 * O restante do sistema não precisa saber qual fornecedor gera o embedding.
 *
 * Mantém a mesma interface pública (embedText, embedTexts) para
 * compatibilidade com relevanceEngine.ts, categoryExtractor.ts, etc.
 */

export type { EmbedTaskType };

/**
 * Cache LRU em processo por (taskType + texto).
 *
 * Vetores idênticos = mesmo resultado da API; reuso é fiel ao contrato de
 * "re-entendimento completo" (o pipeline continua rodando; só evitamos
 * refazer a mesma chamada HTTP). Corta repetições de títulos, tópicos e
 * frases de categoria recorrentes no fluxo complementary — cada request
 * economizado é 1 menos no orçamento RPM < 100.
 */
const EMBED_CACHE_MAX = 1000;
const embedCache = new Map<string, number[]>();

function cacheGet(key: string): number[] | undefined {
  const hit = embedCache.get(key);
  if (!hit) return undefined;
  // Reinsere no fim (ordem de uso) — Map preserva inserção.
  embedCache.delete(key);
  embedCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: number[]): void {
  embedCache.set(key, value);
  while (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest === undefined) break;
    embedCache.delete(oldest);
  }
}

function makeKey(text: string, taskType: string): string {
  return `${taskType}\u0000${text}`;
}

/** Apenas para testes/diagnóstico — não usar na lógica de negócio. */
export function __getEmbedCacheSize(): number {
  return embedCache.size;
}

/**
 * Gera o vetor de embedding de um único texto.
 * Usa Gemini Embedding 2 via API (~0MB memória local).
 * Cacheada por (taskType, texto).
 */
export async function embedText(
  text: string,
  taskType: EmbedTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const clean = (text || '').trim();
  if (!clean) return new Array(EMBEDDING_DIM).fill(0);

  const key = makeKey(clean, taskType);
  const cached = cacheGet(key);
  if (cached) return cached;

  const vector = await geminiEmbedText(clean, taskType);
  cacheSet(key, vector);
  return vector;
}

/**
 * Gera embeddings para múltiplos textos.
 * Deduplica entradas idênticas, serve do cache o que já existe e só
 * chama a API para os misses (em lotes, 1 request = 50 textos).
 *
 * @param texts Textos a embedar
 * @param taskType Prefixo de tarefa — mesmo comportamento do embedText
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbedTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const keys = texts.map((t) => makeKey((t || '').trim(), taskType));
  const results: Array<number[] | null> = new Array(texts.length).fill(null);
  const missIndexByKey = new Map<string, number[]>();
  const missTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = cacheGet(keys[i]);
    if (cached) {
      results[i] = cached;
      continue;
    }
    const list = missIndexByKey.get(keys[i]);
    if (list) {
      list.push(i);
    } else {
      missIndexByKey.set(keys[i], [i]);
      missTexts.push((texts[i] || '').trim());
    }
  }

  if (missTexts.length > 0) {
    const vectors = await geminiEmbedTexts(missTexts, 50, taskType);
    let m = 0;
    for (const [key, indices] of missIndexByKey) {
      const vector = vectors[m++];
      cacheSet(key, vector);
      for (const idx of indices) results[idx] = vector;
    }
  }

  return results as number[][];
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
