import type { EmbedTaskType } from './geminiEmbeddings';

export interface OpenRouterEmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  contextTokens: number;
  inputType: 'text' | 'multimodal';
}

/**
 * Somente rotas :free de EMBEDDINGS atualmente catalogadas pelo OpenRouter
 * e adequadas para recuperação semântica. A ordem é deliberadamente prática:
 * o primeiro é obrigatório pelo produto; depois priorizamos o Nemotron 3
 * para recuperação textual; por último fica o modelo Liquid, que tem apenas
 * 512 tokens de contexto.
 *
 * Cada modelo possui um espaço vetorial próprio. Nunca compare cossenos entre
 * modelos diferentes; o orquestrador faz fusão por ranking.
 */
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

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';

export class OpenRouterEmbeddingError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = false) {
    super(message);
    this.name = 'OpenRouterEmbeddingError';
    this.status = status;
    this.retryable = retryable;
  }
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new OpenRouterEmbeddingError(
      'OPENROUTER_API_KEY não configurada.',
      500,
      false,
    );
  }
  return key;
}

function getInput(taskType: EmbedTaskType, text: string): string {
  const clean = text.trim();
  if (taskType === 'RETRIEVAL_QUERY') return clean;
  if (taskType === 'RETRIEVAL_DOCUMENT') {
    return clean.includes('title:') && clean.includes('| text:')
      ? clean
      : `title: none | text: ${clean}`;
  }
  return clean;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function requestEmbedding(
  model: OpenRouterEmbeddingModel,
  input: string,
): Promise<number[]> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
      'X-Title': 'AgroTools Semantic Researcher',
    },
    body: JSON.stringify({
      model: model.id,
      input,
      encoding_format: 'float',
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new OpenRouterEmbeddingError(
      `OpenRouter ${model.id} HTTP ${response.status}: ${body.slice(0, 800)}`,
      response.status,
      isRetryableStatus(response.status),
    );
  }

  let parsed: { data?: Array<{ embedding?: number[] }> };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new OpenRouterEmbeddingError(
      `OpenRouter ${model.id} retornou JSON inválido.`,
      502,
      true,
    );
  }

  const vector = parsed.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new OpenRouterEmbeddingError(
      `OpenRouter ${model.id} não retornou um vetor de embedding.`,
      502,
      true,
    );
  }

  return vector;
}

const cache = new Map<string, number[]>();
const inFlight = new Map<string, Promise<number[]>>();
const CACHE_MAX = 1000;

function cacheSet(key: string, vector: number[]) {
  cache.set(key, vector);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function openRouterEmbed(
  model: OpenRouterEmbeddingModel,
  text: string,
  taskType: EmbedTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const input = getInput(taskType, text);
  if (!input) return new Array(model.dimensions).fill(0);

  const key = `${model.id}\u0000${taskType}\u0000${input}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const running = inFlight.get(key);
  if (running) return running;

  const promise = requestEmbedding(model, input).then((vector) => {
    if (vector.length !== model.dimensions) {
      console.warn(
        `[OpenRouterEmbeddings] ${model.id}: dimensão declarada=${model.dimensions}, recebida=${vector.length}; usando dimensão recebida.`,
      );
    }
    cacheSet(key, vector);
    return vector;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}
