import { EMBEDDING_MODEL } from './config';

/**
 * Embeddings contextuais locais (bi-encoder), 100% LLM-free.
 *
 * Diferente de `trigonometry.ts` (que fazia TF ponderado — bag-of-words
 * disfarçado de "trigonometria"), aqui o vetor de cada texto vem de um
 * transformer real (MiniLM multilíngue) que entende contexto, ordem das
 * palavras e sinônimos — ou seja, entende o ASSUNTO, não apenas os tokens.
 *
 * Roda inteiramente local via ONNX Runtime (@xenova/transformers), o
 * mesmo pacote já usado em `lib/scrapers/semanticFilter.ts` para o
 * cross-encoder. Nenhuma chamada de API/LLM é feita aqui.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.useBrowserCache = false;
      env.allowLocalModels = true;
      env.cacheDir = '/tmp';
      return pipeline('feature-extraction', EMBEDDING_MODEL);
    })();
  }
  return extractorPromise;
}

/**
 * Gera o vetor de embedding (mean-pooled, L2-normalizado) de um texto.
 */
export async function embedText(text: string): Promise<number[]> {
  const clean = (text || '').trim();
  if (!clean) return new Array(384).fill(0);

  const extractor = await getExtractor();
  const output = await extractor(clean, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Gera embeddings para vários textos. Processa em série para manter
 * previsibilidade de memória em ambientes serverless; a chamada é
 * internamente eficiente pois o modelo já fica em cache após a 1ª carga.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
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
 * Embeddings de sentence-transformers raramente ocupam o range completo;
 * na prática pares relevantes ficam ~0.35-0.9 e irrelevantes ~0.0-0.3.
 * Normalizamos nesse range empírico para produzir um score interpretável.
 */
export function cosineToPercentage(cos: number): number {
  const MIN = 0.05; // piso empírico (pares totalmente não relacionados)
  const MAX = 0.85; // teto empírico (pares quase idênticos)
  const clamped = Math.max(MIN, Math.min(MAX, cos));
  const pct = ((clamped - MIN) / (MAX - MIN)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}
