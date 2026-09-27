import { ScientificSource } from '@/components/PesquisadorAgro/types';
import {
  understandSources,
  UnderstoodSource,
  UnderstandSourcesOptions,
} from './relevanceEngine';
import { embedText } from './embeddings';
import { geminiEmbedText, EmbedTaskType } from './geminiEmbeddings';
import {
  cachedOpenRouterEmbed,
  OPENROUTER_FREE_EMBEDDING_MODELS,
  OpenRouterEmbeddingModel,
} from './openrouterEmbeddings';
import { cosineSimilarity, cosineToPercentage } from './embeddings';
import {
  AGRO_DOMAIN_RELEVANCE_THRESHOLD,
  DomainKey,
  SEMANTIC_DISCARD_THRESHOLD,
} from './config';

export interface PortalSemanticProgress {
  portal: string;
  index: number;
  total: number;
  provider: 'gemini' | 'openrouter';
  model: string;
}

export interface PortalSemanticOptions extends UnderstandSourcesOptions {
  onPortalProgress?: (progress: PortalSemanticProgress) => void;
}

export interface PortalSemanticResult {
  sources: UnderstoodSource[];
  providerUsage: Record<string, number>;
  fallbackModel?: string;
}

interface ActiveProvider {
  kind: 'gemini' | 'openrouter';
  model: string;
  dimensions: number;
}

const GEMINI_PROVIDER: ActiveProvider = {
  kind: 'gemini',
  model: 'gemini-embedding-2',
  dimensions: 768,
};

class SemanticProviderPool {
  private index = -1;
  private switching: Promise<ActiveProvider> | null = null;

  get active(): ActiveProvider {
    if (this.index < 0) return GEMINI_PROVIDER;
    const model = OPENROUTER_FREE_EMBEDDING_MODELS[this.index];
    return {
      kind: 'openrouter',
      model: model.id,
      dimensions: model.dimensions,
    };
  }

  private async switchToNext(): Promise<ActiveProvider> {
    if (this.switching) return this.switching;

    this.switching = Promise.resolve().then(() => {
      this.index += 1;
      if (this.index >= OPENROUTER_FREE_EMBEDDING_MODELS.length) {
        throw new Error('[SemanticProviderPool] Gemini e todos os modelos OpenRouter :free esgotaram.');
      }
      const provider = this.active;
      console.warn(`[SemanticProviderPool] Fallback semântico → ${provider.model}`);
      return provider;
    }).finally(() => {
      this.switching = null;
    });

    return this.switching;
  }

  async embed(
    text: string,
    taskType: EmbedTaskType,
  ): Promise<{ vector: number[]; provider: ActiveProvider }> {
    let provider = this.active;

    while (true) {
      try {
        if (provider.kind === 'gemini') {
          const vector = await geminiEmbedText(text, taskType);
          return { vector, provider };
        }

        const model = OPENROUTER_FREE_EMBEDDING_MODELS.find((item) => item.id === provider.model);
        if (!model) throw new Error(`Modelo OpenRouter não registrado: ${provider.model}`);
        const vector = await cachedOpenRouterEmbed(model, text, taskType);
        return { vector, provider };
      } catch (error) {
        const status = Number((error as { status?: number })?.status ?? 0);
        const retryable = status === 0 || status === 408 || status === 409 || status === 429 ||
          status === 500 || status === 502 || status === 503 || status === 504 || status === 524 || status === 529;

        if (!retryable && provider.kind === 'gemini') throw error;

        await this.switchToNext();
        provider = this.active;
      }
    }
  }
}

function sourceText(source: ScientificSource): string {
  return [
    `title: ${source.title || 'none'}`,
    `abstract: ${source.abstract || ''}`,
    `keywords: ${(source.keywords || []).join(' ')}`,
    `topics: ${(source.matchedTopics || []).join(' ')}`,
  ].filter(Boolean).join(' ').slice(0, 12000);
}

function portalOf(source: ScientificSource): string {
  return (source.sourceName || 'Outros').trim() || 'Outros';
}

function buildUnderstood(
  source: ScientificSource,
  queryVector: number[],
  documentVector: number[],
  provider: ActiveProvider,
  domain: DomainKey,
): UnderstoodSource {
  const cosine = cosineSimilarity(queryVector, documentVector);
  const semanticScore = Math.round(cosineToPercentage(cosine) * 10) / 10;
  const discarded = semanticScore <= SEMANTIC_DISCARD_THRESHOLD;
  const inAgroDomain = semanticScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;

  return {
    ...source,
    semanticScore,
    semanticCategories: [],
    bestExcerpt: (source.abstract || source.title || '').slice(0, 600),
    discarded,
    docEmbedding: documentVector,
    chunks: [],
    usedFullText: false,
    domainScore: semanticScore,
    inAgroDomain,
    shouldPersist: !discarded || inAgroDomain,\n    semanticProvider: provider.kind,\n    semanticModel: provider.model,\n    semanticDimensions: provider.dimensions,
    trigonometricSimilarity: {
      cosTheta: Math.round(Math.max(-1, Math.min(1, cosine)) * 1000) / 1000,
      angleDegrees: Math.round(
        Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI) * 10
      ) / 10,
      percentage: Math.round(semanticScore),
      alignmentQuality:
        semanticScore >= 90 ? 'Excepcional' :
        semanticScore >= 80 ? 'Muito Alta' :
        semanticScore >= 68 ? 'Alta' : 'Moderada',
    },
  };
}

export async function understandSourcesByPortalQueue(
  query: string,
  sources: ScientificSource[],
  domain: DomainKey = 'agro',
  options?: PortalSemanticOptions,
): Promise<PortalSemanticResult> {
  if (sources.length === 0) return { sources: [], providerUsage: {} };

  const pool = new SemanticProviderPool();
  const usage: Record<string, number> = {};

  let queryResult: { vector: number[]; provider: ActiveProvider };
  try {
    queryResult = await pool.embed(query, 'RETRIEVAL_QUERY');
  } catch (error) {
    console.error('[PortalSemanticEngine] Query embedding falhou:', error);
    throw error;
  }

  const queues = new Map<string, ScientificSource[]>();
  for (const source of sources) {
    const portal = portalOf(source);
    const list = queues.get(portal);
    if (list) list.push(source);
    else queues.set(portal, [source]);
  }

  const resultsByPortal = new Map<string, UnderstoodSource[]>();

  await Promise.all(
    [...queues.entries()].map(async ([portal, queue]) => {
      const results: UnderstoodSource[] = [];

      for (let i = 0; i < queue.length; i += 1) {
        const source = queue[i];

        // Se outro portal já disparou o fallback, o próximo item usa o
        // provedor global atual. Se a troca ocorreu, a query também precisa
        // ser re-embebida no mesmo espaço vetorial.
        let provider = pool.active;
        if (provider.model !== queryResult.provider.model) {
          queryResult = await pool.embed(query, 'RETRIEVAL_QUERY');
          provider = queryResult.provider;
        }

        let embedded: { vector: number[]; provider: ActiveProvider };
        try {
          embedded = await pool.embed(sourceText(source), 'RETRIEVAL_DOCUMENT');
        } catch (error) {
          console.error(`[PortalSemanticEngine] ${portal} fonte ${i + 1} falhou:`, error);
          continue;
        }

        if (embedded.provider.model !== queryResult.provider.model) {
          queryResult = await pool.embed(query, 'RETRIEVAL_QUERY');
        }

        const understood = buildUnderstood(
          source,
          queryResult.vector,
          embedded.vector,
          embedded.provider,
          domain,
        );

        results.push(understood);
        usage[embedded.provider.model] = (usage[embedded.provider.model] || 0) + 1;\n\n        if (providerBefore.model !== embedded.provider.model) {\n          console.info(\`[PortalSemanticEngine] ${portal}: modelo mudou durante a chamada; fonte concluída no espaço ${embedded.provider.model}.\`);\n        }

        options?.onPortalProgress?.({
          portal,
          index: i + 1,
          total: queue.length,
          provider: embedded.provider.kind,
          model: embedded.provider.model,
        });

        if (options?.onSourceComplete) {
          await options.onSourceComplete(understood, {
            index: i,
            total: queue.length,
            sourceName: portal,
          });
        }
      }

      resultsByPortal.set(portal, results);
    }),
  );

  const combined = [...resultsByPortal.values()].flat();
  return {
    sources: combined.sort((a, b) => b.semanticScore - a.semanticScore),
    providerUsage: usage,
    fallbackModel: Object.keys(usage).find((model) => model.includes(':free')),
  };
}
