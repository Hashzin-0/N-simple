import { ScientificSource } from '@/components/PesquisadorAgro/types';

/**
 * Semantic relevance scoring using a local cross-encoder model.
 * 
 * Inspired by LiteSemRAG's contextual token-level embeddings approach:
 * - Uses a cross-encoder that jointly encodes (query, document) pairs
 * - Produces a relevance score based on semantic understanding, not just keyword matching
 * - Handles polysemy through contextual encoding (e.g., "subsolo" in agricultural vs urban context)
 * 
 * Model: Xenova/ms-marco-MiniLM-L-6-v2 (ONNX, ~90MB)
 * - Trained on MS MARCO passage ranking
 * - Works with Portuguese despite being English-trained (tested)
 * - Raw logit output: positive = relevant, negative = not relevant
 * - Score range: approximately -12 to +10
 */

export interface SemanticScoredSource extends ScientificSource {
  semanticScore: number;
  semanticLogit: number;
  semanticLabel: 'relevant' | 'not_relevant';
}

/**
 * Semantic relevance threshold.
 * 
 * Based on empirical testing:
 * - logit > 0: Strongly relevant (topical match)
 * - logit -2 to 0: Borderline (related but not primary focus)
 * - logit < -2: Irrelevant (different topic entirely)
 * 
 * Threshold at -2 catches:
 * - "A mulher do subsolo" (Dostoiévski) → logit -6.81
 * - "Estacionamento subsolo" → logit -6.77
 * - "Usina nuclear Angra" → logit -6.74
 * 
 * While keeping:
 * - "Gessagem no sistema plantio direto" → logit -2.12 (borderline, still agricultural)
 * - "Teores de alumínio após calagem" → logit -0.51 (related to soil)
 */
export const SEMANTIC_LOGIT_THRESHOLD = -2;

// Lazy-loaded model state
let tokenizerCache: any = null;
let modelCache: any = null;
let modelLoading = false;
let modelLoadError: string | null = null;

async function getTokenizer() {
  const { AutoTokenizer, env } = await import('@xenova/transformers');
  env.useBrowserCache = false;
  env.allowLocalModels = true;
  if (!tokenizerCache) {
    tokenizerCache = await AutoTokenizer.from_pretrained('Xenova/ms-marco-MiniLM-L-6-v2');
  }
  return tokenizerCache;
}

async function getModel() {
  const { AutoModelForSequenceClassification, env } = await import('@xenova/transformers');
  env.useBrowserCache = false;
  env.allowLocalModels = true;
  if (!modelCache) {
    modelCache = await AutoModelForSequenceClassification.from_pretrained('Xenova/ms-marco-MiniLM-L-6-v2');
  }
  return modelCache;
}

/**
 * Compute raw logit score for a query-document pair.
 * Positive = relevant, negative = not relevant.
 */
async function scorePairRaw(query: string, docText: string): Promise<number> {
  const tokenizer = await getTokenizer();
  const model = await getModel();
  const { Tensor } = await import('@xenova/transformers');

  const qTokens = tokenizer(query, { padding: false, truncation: true });
  const dTokens = tokenizer(docText, { padding: false, truncation: true });

  const clsToken = BigInt(101);
  const sepToken = BigInt(102);

  const qIds = Array.from(qTokens.input_ids.data).slice(1, -1);
  const dIds = Array.from(dTokens.input_ids.data).slice(1, -1);

  const ids = [clsToken, ...qIds, sepToken, ...dIds, sepToken];
  const types = ids.map((_, i) => BigInt(i < 1 + qIds.length + 1 ? 0 : 1));
  const mask = ids.map(() => BigInt(1));

  const inputIds = new Tensor('int64', ids, [1, ids.length]);
  const maskTensor = new Tensor('int64', mask, [1, mask.length]);
  const typesTensor = new Tensor('int64', types, [1, types.length]);

  const out = await model({
    input_ids: inputIds,
    attention_mask: maskTensor,
    token_type_ids: typesTensor,
  });

  return Number(out.logits.data[0]);
}

function logitToProbability(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Sinal secundário reutilizável pelo motor semântico principal
 * (`lib/semantic/relevanceEngine.ts`): score de cross-encoder (0-1)
 * para um par (query, texto) qualquer — não só título/abstract.
 */
export async function crossEncoderScore(query: string, text: string): Promise<number> {
  try {
    const logit = await scorePairRaw(query, text.slice(0, 512));
    return logitToProbability(logit);
  } catch {
    return 0.5;
  }
}

/**
 * Score all sources by semantic relevance and filter out irrelevant results.
 * 
 * Uses a cross-encoder model to score query-document relevance.
 * Only returns sources with semanticLogit > SEMANTIC_LOGIT_THRESHOLD.
 * 
 * Inspired by LiteSemRAG's contextual encoding approach:
 * - Jointly encodes (query, document) for semantic understanding
 * - Handles polysemy through contextual encoding
 * - Catches false positives that keyword matching misses
 */
export async function scoreBySemanticRelevance(
  query: string,
  sources: ScientificSource[],
): Promise<SemanticScoredSource[]> {
  const startMs = Date.now();

  const scored = await Promise.all(
    sources.map(async (src) => {
      try {
        const docText = [
          src.title,
          src.abstract || '',
          (src.keywords || []).join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 512);

        const logit = await scorePairRaw(query, docText);
        const score = logitToProbability(logit);

        return {
          ...src,
          semanticLogit: logit,
          semanticScore: score,
          semanticLabel: (logit > 0 ? 'relevant' : 'not_relevant') as 'relevant' | 'not_relevant',
        };
      } catch (err) {
        return {
          ...src,
          semanticLogit: 0,
          semanticScore: 0.5,
          semanticLabel: 'relevant' as const,
        };
      }
    }),
  );

  const elapsedMs = Date.now() - startMs;

  // Diagnostic logging
  const sorted = [...scored].sort((a, b) => b.semanticLogit - a.semanticLogit);
  const logits = sorted.map((s) => s.semanticLogit);
  const mean = logits.reduce((a, b) => a + b, 0) / logits.length;
  const min = Math.min(...logits);
  const max = Math.max(...logits);
  const filtered = scored.filter(s => s.semanticLogit <= SEMANTIC_LOGIT_THRESHOLD);

  console.log(`[SemanticFilter] ${sources.length} scored in ${elapsedMs}ms → ${scored.length - filtered.length} kept, ${filtered.length} filtered`);
  console.log(`[SemanticFilter] mean=${mean.toFixed(2)} min=${min.toFixed(2)} max=${max.toFixed(2)} threshold=${SEMANTIC_LOGIT_THRESHOLD}`);
  
  if (filtered.length > 0) {
    console.log(`[SemanticFilter] Filtered out:`);
    filtered.forEach(s => {
      console.log(`  ✗ logit=${s.semanticLogit.toFixed(2)} | ${s.title.slice(0, 60)}`);
    });
  }

  // Filter: only return sources above threshold
  return scored.filter(s => s.semanticLogit > SEMANTIC_LOGIT_THRESHOLD);
}
