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
 * Obtém a API key do Gemini das variáveis de ambiente.
 */
function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('[GeminiEmbeddings] GEMINI_API_KEY não configurada.');
  }
  return key;
}

/**
 * Gera embedding de um único texto via Gemini Embedding 2.
 *
 * Para tarefas de retrieval, usa o prefixo de task no prompt:
 * - "task: search result | query: ..." para queries
 * - "task: search result | document: ..." para documentos
 *
 * @param text Texto para gerar embedding
 * @param taskType Tipo de tarefa (afeta qualidade do embedding)
 * @returns Vetor de embedding normalizado
 */
export async function geminiEmbedText(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const clean = (text || '').trim();
  if (!clean) return new Array(EMBEDDING_DIM).fill(0);

  const apiKey = getApiKey();
  const taskPrefix = getTaskPrefix(taskType);
  const content = taskPrefix ? `${taskPrefix} ${clean}` : clean;

  const url = `${GEMINI_API_BASE}/models/gemini-embedding-2:embedContent?key=${apiKey}`;

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
    const error = await response.text();
    throw new Error(`[GeminiEmbeddings] API error ${response.status}: ${error}`);
  }

  const data: EmbedContentResponse = await response.json();
  return data.embedding.values;
}

/**
 * Gera embeddings para múltiplos textos usando Batch API.
 * Processa em lotes pequenos para controlar rate limits.
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

  const apiKey = getApiKey();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await embedBatch(apiKey, batch);
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
 * Inclui retry com backoff exponencial para rate limits.
 */
async function embedBatch(
  apiKey: string,
  texts: string[],
  retries = 3,
): Promise<number[][]> {
  const url = `${GEMINI_API_BASE}/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map((text) => ({
    model: 'models/gemini-embedding-2',
    content: {
      parts: [{ text }],
    },
  }));

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (response.status === 429) {
      const delay = Math.pow(2, attempt) * 5000;
      console.warn(`[GeminiEmbeddings] Rate limit atingido, aguardando ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[GeminiEmbeddings] Batch API error ${response.status}: ${error}`);
    }

    const data: BatchEmbedContentResponse = await response.json();
    return data.embeddings.map((e) => e.values);
  }

  throw new Error('[GeminiEmbeddings] Batch API: max retries excedido');
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
