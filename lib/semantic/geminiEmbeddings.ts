import { EMBEDDING_DIM } from './config';

/**
 * Gemini Embedding 2 — wrapper para a API de embeddings do Google.
 *
 * Substitui o bi-encoder ONNX local (~500MB) por chamadas à API,
 * eliminando o problema de OOM em ambientes serverless.
 *
 * Modelo: gemini-embedding-2 (768 dims via Matryoshka, 8192 tokens)
 * Documentação: https://ai.google.dev/gemini-api/docs/embeddings
 *
 * Rate limiting: o free tier do Gemini expõe ~100 requisições/minuto
 * (RPM) por chave. Este módulo NUNCA emite mais que
 * EMBEDDING_RPM_PER_KEY (default 80, com folga sob 100) por chave em
 * qualquer janela deslizante de 60s — single (embedContent) e batch
 * (batchEmbedContents) passam pelo mesmo orçamento. Cada request HTTP
 * conta como 1 unidade (um lote de 50 textos = 1 RPM).
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

export type EmbedTaskType =
  | 'RETRIEVAL_QUERY'
  | 'RETRIEVAL_DOCUMENT'
  | 'SEMANTIC_SIMILARITY';

/**
 * Orçamento RPM por chave. Default 80 < 100 (limite do free tier),
 * deixando folga para outras chamadas (generateContent etc.) na mesma key.
 * Nunca deixe EMBEDDING_RPM_PER_KEY chegar a 100.
 */
const RPM_PER_KEY = (() => {
  const raw = parseInt(process.env.EMBEDDING_RPM_PER_KEY || '80', 10);
  if (Number.isNaN(raw) || raw < 1) return 80;
  // Teto rígido: não pode atingir 100 (limite da API).
  return Math.min(raw, 95);
})();

const WINDOW_MS = 60_000;

/**
 * Rate limiter por chave com janela deslizante de 60s.
 *
 * Cada chave mantém os timestamps dos requests da janela atual.
 * `acquire()` bloqueia até existir uma chave com espaço no orçamento
 * (round-robin entre as disponíveis). Chaves em cooldown (429/quota)
 * são puladas temporariamente.
 */
class EmbeddingRateLimiter {
  private readonly hits: Map<string, number[]> = new Map();
  private readonly cooldownUntil: Map<string, number> = new Map();
  private readonly waiters: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rr = 0;

  /**
   * Aguarda até uma chave ter orçamento e retorna seu índice.
   * Também respeita cooldown pós-429 da chave.
   */
  async acquire(keys: string[]): Promise<number> {
    for (;;) {
      const now = Date.now();
      this.prune(now);

      // Round-robin a partir da última escolhida, entre chaves livres.
      for (let n = 0; n < keys.length; n++) {
        const idx = (this.rr + n) % keys.length;
        const key = keys[idx];
        if ((this.cooldownUntil.get(key) ?? 0) > now) continue;

        const hits = this.hits.get(key);
        if (!hits || hits.length < RPM_PER_KEY) {
          this.rr = (idx + 1) % keys.length;
          hits?.push(now);
          if (!hits) this.hits.set(key, [now]);
          else this.hits.set(key, hits);
          return idx;
        }
      }

      // Todas em cooldown → espera o cooldown mais próximo.
      // Todas sem orçamento → espera o expiry da janela.
      await this.sleepUntilNextOpportunity(keys, now);
    }
  }

  /** Marca a chave em cooldown (429/quota) para pular nas próximas aquisições. */
  penalize(keyIndex: number, keys: string[], ms = 5_000): void {
    const key = keys[keyIndex];
    if (!key) return;
    this.cooldownUntil.set(key, Date.now() + ms);
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS;
    for (const [key, times] of this.hits) {
      const alive = times.filter((t) => t > cutoff);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
    for (const [key, until] of this.cooldownUntil) {
      if (until <= now) this.cooldownUntil.delete(key);
    }
  }

  private sleepUntilNextOpportunity(keys: string[], now: number): Promise<void> {
    let delay = 250;

    const cooldowns = keys
      .map((k) => this.cooldownUntil.get(k) ?? 0)
      .filter((t) => t > now)
      .sort((a, b) => a - b);
    if (cooldowns.length === keys.length) {
      // Todas em cooldown: espera a primeira liberar.
      delay = Math.max(50, cooldowns[0] - now + 25);
    } else {
      // Alguma sem orçamento: espera o request mais antigo da janela sair.
      let oldest = Infinity;
      for (const k of keys) {
        const hits = this.hits.get(k);
        if (hits && hits.length >= RPM_PER_KEY && hits.length > 0) {
          oldest = Math.min(oldest, hits[0]);
        }
      }
      if (Number.isFinite(oldest)) {
        delay = Math.max(50, oldest + WINDOW_MS - now + 25);
      }
    }

    return new Promise((resolve) => {
      const wake = () => {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        resolve();
      };
      this.waiters.push(wake);
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          const pending = this.waiters.splice(0, this.waiters.length);
          for (const fn of pending) fn();
        }, delay);
      }
    });
  }
}

const rateLimiter = new EmbeddingRateLimiter();

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
 * Passa pelo rate limiter (janela 60s por chave) antes da chamada.
 *
 * @param text Texto para gerar embedding
 * @param taskType Tipo de tarefa (afeta qualidade do embedding)
 * @returns Vetor de embedding normalizado
 */
export function geminiEmbedText(
  text: string,
  taskType: EmbedTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const clean = (text || '').trim();
  if (!clean) return Promise.resolve(new Array(EMBEDDING_DIM).fill(0));

  return geminiEmbedTextInternal(clean, taskType);
}

/**
 * Implementação interna — adquire orçamento RPM e tenta as chaves.
 * Em 429/quota: penaliza a key (cooldown) e rotaciona para a próxima.
 */
async function geminiEmbedTextInternal(
  text: string,
  taskType: EmbedTaskType,
): Promise<number[]> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('[GeminiEmbeddings] Nenhuma API key configurada. Defina GEMINI_API_KEYS ou GEMINI_API_KEY.');
  }

  const taskPrefix = getTaskPrefix(taskType);
  const content = taskPrefix ? `${taskPrefix} ${text}` : text;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = await rateLimiter.acquire(keys);
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
          console.warn(`[GeminiEmbeddings] Key ${keyIndex + 1}/${keys.length} quota/rate-limit, cooldown+rotacao...`);
          rateLimiter.penalize(keyIndex, keys, 10_000);
          lastError = error;
          continue;
        }

        throw new Error(`[GeminiEmbeddings] ${error.message}`);
      }

      const data: EmbedContentResponse = await response.json();
      return data.embedding.values;
    } catch (err: unknown) {
      if (isQuotaError(err)) {
        console.warn(`[GeminiEmbeddings] Key ${keyIndex + 1}/${keys.length} quota error, cooldown+rotacao...`);
        rateLimiter.penalize(keyIndex, keys, 10_000);
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
 * Cada lote conta como 1 request no orçamento RPM da chave.
 *
 * @param texts Array de textos
 * @param batchSize Tamanho do lote (default: 50)
 * @param taskType Prefixo de tarefa aplicado a cada texto (mesmo do single)
 * @returns Array de vetores de embedding
 */
export async function geminiEmbedTexts(
  texts: string[],
  batchSize: number = 50,
  taskType: EmbedTaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('[GeminiEmbeddings] Nenhuma API key configurada. Defina GEMINI_API_KEYS ou GEMINI_API_KEY.');
  }

  const prefix = getTaskPrefix(taskType);
  const prepared = prefix ? texts.map((t) => `${prefix} ${t}`) : texts;

  const results: number[][] = [];

  for (let i = 0; i < prepared.length; i += batchSize) {
    const batch = prepared.slice(i, i + batchSize);
    const batchResults = await embedBatch(keys, batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Envia um lote de textos para a Batch Embed API.
 * Adquire orçamento RPM por lote; rotaciona e penaliza keys em quota.
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

  // Uma tentativa de HTTP por "passe" de chave. Cada fetch real adquire
  // seu próprio slot no orçamento RPM (retries de backoff também).
  for (let pass = 0; pass < keys.length; pass++) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const slot = await rateLimiter.acquire(keys);
      const url = `${GEMINI_API_BASE}/models/gemini-embedding-2:batchEmbedContents?key=${keys[slot]}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        });

        if (response.status === 429) {
          rateLimiter.penalize(slot, keys, 10_000);
          lastError = new Error('429 rate limit');
          if (attempt < retries) {
            const delay = Math.pow(2, attempt) * 3000;
            console.warn(`[GeminiEmbeddings] Batch key ${slot + 1}/${keys.length} rate limit, retry ${attempt + 1}/${retries} em ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          console.warn(`[GeminiEmbeddings] Batch key ${slot + 1}/${keys.length} esgotou retries, rotacionando...`);
          break;
        }

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Batch API error ${response.status}: ${errorText}`);

          if (isQuotaError(error)) {
            console.warn(`[GeminiEmbeddings] Batch key ${slot + 1}/${keys.length} quota error, cooldown...`);
            rateLimiter.penalize(slot, keys, 10_000);
            lastError = error;
            break;
          }

          throw new Error(`[GeminiEmbeddings] ${error.message}`);
        }

        const data: BatchEmbedContentResponse = await response.json();
        return data.embeddings.map((e) => e.values);
      } catch (err: unknown) {
        if (isQuotaError(err)) {
          console.warn(`[GeminiEmbeddings] Batch key ${slot + 1}/${keys.length} quota error, cooldown...`);
          rateLimiter.penalize(slot, keys, 10_000);
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
 * Aplicado de forma idêntica em single e batch (consistência de qualidade).
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
  rpmPerKey: RPM_PER_KEY,
} as const;
