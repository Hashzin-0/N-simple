import { EMBEDDING_DIM } from './config';

/**
 * Gemini Embedding 2 — wrapper para a API de embeddings do Google.
 *
 * Substitui o bi-encoder ONNX local (~500MB) por chamadas à API,
 * eliminando o problema de OOM em ambientes serverless.
 *
 * Modelo: gemini-embedding-2 (768 dims via Matryoshka, 8192 tokens)
 * Documentação: https://ai.google.dev/gemini-api/docs/embeddings
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface EmbedContentResponse {
  embedding: {
    values: number[];
  };
}

interface BatchEmbedContentResponse {
  embeddings: Array<{
    values: number[];
  }>;
}

/**
 * Fila de embeddings com concorrência limitada.
 * Evita que múltiples chamadas simultâneas à API atinjam rate limits.
 */
class EmbeddingQueue {
  private queue: Array<() => void> = [];
  private running = 0;
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        this.running++;
        fn().then(
          (val) => resolve(val),
          (err) => reject(err),
        ).finally(() => {
          this.running--;
          this.processNext();
        });
      };
      this.queue.push(task);
      this.processNext();
    });
  }

  private processNext() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }
}

const embeddingQueue = new EmbeddingQueue(
  parseInt(process.env.EMBEDDING_CONCURRENCY || '2', 10),
);

/**
 * Obtém todas as API keys do Gemini das variáveis de ambiente.
 * Prefere GEMINI_API_KEYS (comma-separated), fallback para GEMINI_API_KEY.
 */
function getGeminiKeys(): string[] {
  const keysEnv = process.env.GEMINI_API_KEYS;
  if (keysEnv) {
    return keysEnv
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  const singleKey = process.env.GEMINI_API_KEY;
  return singleKey ? [singleKey] : [];
}

/**
 * Detecta erros de quota/rate-limit que justificam trocar de chave.
 */
function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('rate limit') ||
    msg.includes('403') ||
    msg.includes('PERMISSION_DENIED')
  );
}

/**
 * Gera embedding de um único texto via Gemini Embedding 2.
 * Passa por uma fila com concorrência limitada para evitar rate limits.
 *
 * @param text Texto para gerar embedding
 * @param taskType Tipo de tarefa (afeta qualidade do embedding)
 * @returns Vetor de embedding normalizado
 */
export function geminiEmbedText(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const clean = (text || '').trim();
  if (!clean) return Promise.resolve(new Array(EMBEDDING_DIM).fill(0));

  return embeddingQueue.add(() => geminiEmbedTextInternal(clean, taskType));
}

/**
 * Implementação interna — chamada pela fila.
 * Inclui rotação de chaves: se uma chave atinge quota, tenta a próxima.
 */
async function geminiEmbedTextInternal(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('[GeminiEmbeddings] Nenhuma API key configurada. Defina GEMINI_API_KEYS ou GEMINI_API_KEY.');
  }

  const taskPrefix = getTaskPrefix(taskType);
  const content = taskPrefix ? `${taskPrefix} ${text}` : text;

  let lastError: unknown = null;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const apiKey = keys[keyIndex];
    const url = `${GEMINI_API_BASE}/models/gemini-embedding-2:embedContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            parts: [{ text: content }],
          },
          outputDimensionality: EMBEDDING_DIM,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`API error ${response.status}: ${errorText}`);

        if (isQuotaError(error) || response.status === 429) {
          console.warn(`[GeminiEmbeddings] Key ${keyIndex + 1}/${keys.length} quota/rate-limit, rotacionando...`);
          lastError = error;
          continue;
        }

        throw new Error(`[GeminiEmbeddings] ${error.message}`);
      }

      const data: EmbedContentResponse = await response.json();
      return data.embedding.values;
    } catch (err: unknown) {
      if (isQuotaError(err)) {
        console.warn(`[GeminiEmbeddings] Key ${keyIndex + 1}/${keys.length} quota error, rotacionando...`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(`[GeminiEmbeddings] Todas as ${keys.length} chaves esgotaram quota. Último erro: ${lastError}`);
}

/**
 * Gera embeddings para múltiplos textos usando Batch API.
 * Processa em lotes pequenos para controlar rate limits.
 * Rota entre chaves se uma atingir quota.
 *
 * @param texts Array de textos
 * @param batchSize Tamanho do lote (default: 20 para free tier)
 * @returns Array de vetores de embedding
 */
export async function geminiEmbedTexts(
  texts: string[],
  batchSize: number = 20,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('[GeminiEmbeddings] Nenhuma API key configurada. Defina GEMINI_API_KEYS ou GEMINI_API_KEY.');
  }

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await embedBatch(keys, batch);
    results.push(...batchResults);

    // Delay entre lotes para evitar rate limit
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return results;
}

/**
 * Envia um lote de textos para a Batch Embed API.
 * Rota entre chaves no quota, com retry para erros transient.
 */
async function embedBatch(
  keys: string[],
  texts: string[],
  retries = 2,
): Promise<number[][]> {
  const requests = texts.map((text) => ({
    model: 'models/gemini-embedding-2',
    content: {
      parts: [{ text }],
    },
  }));

  let lastError: unknown = null;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const apiKey = keys[keyIndex];
    const url = `${GEMINI_API_BASE}/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        });

        if (response.status === 429) {
          if (attempt < retries) {
            const delay = Math.pow(2, attempt) * 3000;
            console.warn(`[GeminiEmbeddings] Batch key ${keyIndex + 1}/${keys.length} rate limit, retry ${attempt + 1}/${retries} em ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          // Esgotou retries nesta chave, rotaciona
          console.warn(`[GeminiEmbeddings] Batch key ${keyIndex + 1}/${keys.length} esgotou retries, rotacionando...`);
          lastError = new Error('429 rate limit');
          break;
        }

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Batch API error ${response.status}: ${errorText}`);

          if (isQuotaError(error)) {
            console.warn(`[GeminiEmbeddings] Batch key ${keyIndex + 1}/${keys.length} quota error, rotacionando...`);
            lastError = error;
            break;
          }

          throw new Error(`[GeminiEmbeddings] ${error.message}`);
        }

        const data: BatchEmbedContentResponse = await response.json();
        return data.embeddings.map((e) => e.values);
      } catch (err: unknown) {
        if (isQuotaError(err)) {
          console.warn(`[GeminiEmbeddings] Batch key ${keyIndex + 1}/${keys.length} quota error, rotacionando...`);
          lastError = err;
          break;
        }
        throw err;
      }
    }
  }

  throw new Error(`[GeminiEmbeddings] Batch: todas as ${keys.length} chaves esgotaram. Último erro: ${lastError}`);
}

/**
 * Mapeia tipo de tarefa para prefixo no prompt.
 * Gemini Embedding 2 usa instruções no prompt em vez de task_type parameter.
 */
function getTaskPrefix(taskType: string): string {
  switch (taskType) {
    case 'RETRIEVAL_QUERY':
      return 'task:search result | query:';
    case 'RETRIEVAL_DOCUMENT':
      return 'task:search result | document:';
    case 'SEMANTIC_SIMILARITY':
      return 'task:semantic similarity | text:';
    default:
      return '';
  }
}

/**
 * Metadados do embedding para persistência no Supabase.
 * Permite validação de consistência do espaço vetorial.
 */
export const EMBEDDING_METADATA = {
  model: 'gemini-embedding-2',
  dimensions: EMBEDDING_DIM,
  version: 'v1',
} as const;
