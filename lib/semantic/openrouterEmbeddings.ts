import type { EmbedTaskType } from './geminiEmbeddings';

export interface OpenRouterEmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  contextTokens: number;
  inputType: 'text' | 'multimodal';
}

export const OPENROUTER_FREE_EMBEDDING_MODELS: OpenRouterEmbeddingModel[] = [
  {
    id: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
    name: 'NVIDIA Llama Nemotron Embed VL 1B V2',
    dimensions: 1024,
    contextTokens: 131072,
    inputType: 'multimodal',
  },
  {
    id: 'nvidia/nemotron-3-embed-1b:free',
    name: 'NVIDIA Nemotron 3 Embed 1B',
    dimensions: 2048,
    contextTokens: 32768,
    inputType: 'text',
  },
  {
    id: 'liquid/lfm-2.5-embedding-350m:free',
    name: 'Liquid LFM2.5-Embedding-350M',
    dimensions: 1024,
    contextTokens: 512,
    inputType: 'text',
  },
];

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error('[OpenRouterEmbeddings] OPENROUTER_API_KEY não configurada.');
  }
  return key;
}

function getInputType(taskType: EmbedTaskType): 'search_query' | 'search_document' {
  return taskType === 'RETRIEVAL_QUERY' ? 'search_query' : 'search_document';
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status === 500 ||
    status === 502 || status === 503 || status === 504 || status === 524 || status === 529;
}

export async function openRouterEmbed(
  model: OpenRouterEmbeddingModel,
  input: string,
  taskType: EmbedTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const clean = (input || '').trim();
  if (!clean) return new Array(model.dimensions).fill(0);

  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
      'X-Title': 'Agrotools',
    },
    body: JSON.stringify({
      model: model.id,
      input: clean,
      encoding_format: 'float',
      input_type: getInputType(taskType),
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const body = await response.text();

  if (!response.ok) {
    const error = new Error(
      `OpenRouter ${model.id} HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
    (error as Error & { status?: number; retryable?: boolean }).status = response.status;
    (error as Error & { status?: number; retryable?: boolean }).retryable = isRetryable(response.status);
    throw error;
  }

  let data: { data?: Array<{ embedding?: number[] }> };
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`[OpenRouterEmbeddings] Resposta JSON inválida de ${model.id}.`);
  }

  const vector = data.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(`[OpenRouterEmbeddings] ${model.id} retornou vetor vazio.`);
  }

  return vector;
}

const cache = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[]>>();
const CACHE_MAX = 1500;

function cacheKey(modelId: string, taskType: EmbedTaskType, text: string): string {
  return `${modelId}\u0000${taskType}\u0000${text}`;
}

export async function cachedOpenRouterEmbed(
  model: OpenRouterEmbeddingModel,
  input: string,
  taskType: EmbedTaskType,
): Promise<number[]> {
  const clean = (input || '').trim();
  const key = cacheKey(model.id, taskType, clean);
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = openRouterEmbed(model, clean, taskType)
    .then((vector) => {
      cache.set(key, vector);
      while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
        else break;
      }
      return vector;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
