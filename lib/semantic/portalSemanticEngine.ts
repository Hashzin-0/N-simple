import type { ScientificSource } from '@/components/PesquisadorAgro/types';
import type { DomainKey } from './config';
import {
  geminiEmbedText,
  type EmbedTaskType,
} from './geminiEmbeddings';
import {
  OPENROUTER_FREE_EMBEDDING_MODELS,
  openRouterEmbed,
  type OpenRouterEmbeddingModel,
  OpenRouterEmbeddingError,
} from './openrouterEmbeddings';
import {
  SEMANTIC_DISCARD_THRESHOLD,
  AGRO_DOMAIN_RELEVANCE_THRESHOLD,
} from './config';
import {
  cosineSimilarity,
  cosineToPercentage,
} from './embeddings';
import type { UnderstoodSource } from './relevanceEngine';

type ProviderKind = 'gemini' | 'openrouter';

interface Provider {
  kind: ProviderKind;
  model: string;
  dimensions: number;
  openRouterModel?: OpenRouterEmbeddingModel;
}

export interface PortalSemanticProgress {
  portal: string;
  index: number;
  total: number;
  provider: ProviderKind;
  model: string;
}

export interface PortalSemanticOptions {
  onSourceComplete?: (
    source: UnderstoodSource,
    meta: { index: number; total: number; sourceName: string; provider: ProviderKind; model: string },
  ) => void | Promise<void>;
  onPortalProgress?: (progress: PortalSemanticProgress) => void | Promise<void>;
}

export interface PortalSemanticResult {
  sources: UnderstoodSource[];
  exhaustedProviders: string[];
}

const GEMINI: Provider = {
  kind: 'gemini',
  model: 'gemini-embedding-2',
  dimensions: 768,
};

const FALLBACK_PROVIDERS: Provider[] = OPENROUTER_FREE_EMBEDDING_MODELS.map((model) => ({
  kind: 'openrouter',
  model: model.id,
  dimensions: model.dimensions,
  openRouterModel: model,
}));

/**
 * Um único estado de provider para todo o processo. As filas dos portais
 * executam em paralelo, mas o orçamento/quota do Gemini continua sendo global.
 *
 * Quando o Gemini esgota quota, as próximas fontes de TODAS as filas usam
 * o próximo fallback. Fontes Gemini já concluídas continuam válidas.
 */
class SemanticProviderPool {
  private providers: Provider[] = [GEMINI, ...FALLBACK_PROVIDERS];
  private currentIndex = 0;
  private switchLock: Promise<void> = Promise.resolve();
  private queryVectors = new Map<string, Promise<number[]>>();

  current(): Provider {
    return this.providers[this.currentIndex];
  }

  async queryEmbedding(provider: Provider, query: string): Promise<number[]> {
    const key = `${provider.kind}:${provider.model}:${query}`;
    const cached = this.queryVectors.get(key);
    if (cached) return cached;

    const promise = this.embed(provider, query, 'RETRIEVAL_QUERY');
    this.queryVectors.set(key, promise);
    try {
      return await promise;
    } catch (err) {
      this.queryVectors.delete(key);
      throw err;
    }
  }

  async embedDocumentAndQuery(
    documentText: string,
    query: string,
  ): Promise<{ provider: Provider; documentVector: number[]; queryVector: number[] }> {
    for (;;) {
      const provider = this.current();
      try {
        const documentVector = await this.embed(provider, documentText, 'RETRIEVAL_DOCUMENT');
        const queryKey = `${provider.kind}:${provider.model}:${query}`;
        let queryPromise = this.queryVectors.get(queryKey);
        if (!queryPromise) {
          queryPromise = this.embed(provider, query, 'RETRIEVAL_QUERY');
          this.queryVectors.set(queryKey, queryPromise);
        }
        const queryVector = await queryPromise;
        return { provider, documentVector, queryVector };
      } catch (err) {
        const switched = await this.switchAfterFailure(provider, err);
        if (!switched) throw err;
      }
    }
  }

  private async embed(provider: Provider, text: string, taskType: EmbedTaskType): Promise<number[]> {
    if (provider.kind === 'gemini') {
      return geminiEmbedText(text, taskType);
    }
    return openRouterEmbed(provider.openRouterModel!, text, taskType);
  }

  private async switchAfterFailure(provider: Provider, err: unknown): Promise<boolean> {
    let switched = false;
    const previous = this.switchLock;
    let release!: () => void;
    this.switchLock = new Promise<void>((resolve) => { release = resolve; });

    await previous;
    try {
      // Outro worker pode já ter avançado o provider enquanto este erro
      // aguardava o lock. Só avance se ainda estivermos no provider que falhou.
      if (this.current() === provider) {
        const next = this.currentIndex + 1;
        if (next < this.providers.length) {
          this.currentIndex = next;
          switched = true;
          console.warn(
            `[SemanticProviderPool] ${provider.model} falhou; fallback=${this.current().model}. Motivo: ${formatError(err)}`,
          );
        } else {
          console.error('[SemanticProviderPool] Todos os provedores semânticos foram esgotados.');
        }
      } else {
        switched = true;
      }
    } finally {
      release();
    }
    return switched;
  }
}

function formatError(err: unknown): string {
  if (err instanceof OpenRouterEmbeddingError) return `${err.status} ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

function portalKey(source: ScientificSource): string {
  return source.sourceName || 'Outro';
}

function sourceText(source: ScientificSource): string {
  return [
    `title: ${source.title || 'none'}`,
    `abstract: ${source.abstract || 'none'}`,
    source.keywords?.length ? `keywords: ${source.keywords.join(', ')}` : '',
    source.matchedTopics?.length ? `topics: ${source.matchedTopics.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
}

function makeUnderstood(
  source: ScientificSource,
  queryVector: number[],
  documentVector: number[],
  provider: Provider,
): UnderstoodSource {
  const cosine = cosineSimilarity(queryVector, documentVector);
  const semanticScore = Math.round(cosineToPercentage(cosine) * 10) / 10;
  const isFallback = provider.kind === 'openrouter';

  // O corte 45 foi calibrado para o espaço Gemini. Não o reutilizamos
  // cegamente em outros espaços vetoriais. No fallback, a ordem é definida
  // pelo score/rank do próprio modelo e a fonte permanece persistível.
  const discarded = isFallback ? false : semanticScore <= SEMANTIC_DISCARD_THRESHOLD;
  const bestExcerpt = (source.abstract || source.title || '').slice(0, 600);

  return {
    ...source,
    semanticScore,
    semanticCategories: [],
    bestExcerpt,
    discarded,
    docEmbedding: provider.kind === 'gemini' ? documentVector : [],
    chunks: [],
    usedFullText: false,
    domainScore: semanticScore,
    inAgroDomain: isFallback ? true : semanticScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD,
    shouldPersist: isFallback || !discarded,
    semanticProvider: provider.kind,
    semanticModel: provider.model,
    semanticDimensions: documentVector.length,
    trigonometricSimilarity: {
      cosTheta: Math.round(Math.max(-1, Math.min(1, cosine)) * 1000) / 1000,
      angleDegrees: Math.round(Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI) * 10) / 10,
      percentage: Math.round(semanticScore),
      alignmentQuality:
        semanticScore >= 90 ? 'Excepcional' :
        semanticScore >= 80 ? 'Muito Alta' :
        semanticScore >= 68 ? 'Alta' : 'Moderada',
    },
  };
}

interface ScoredSource {
  source: UnderstoodSource;
  providerKey: string;
  localScore: number;
}

/**
 * Executa uma fila sequencial por portal, enquanto todos os portais rodam
 * em paralelo. Não há Promise.all dentro da fila de um portal.
 */
export async function understandSourcesByPortalQueue(
  query: string,
  sources: ScientificSource[],
  _domain: DomainKey = 'agro',
  options?: PortalSemanticOptions,
): Promise<PortalSemanticResult> {
  if (sources.length === 0) return { sources: [], exhaustedProviders: [] };

  const grouped = new Map<string, ScientificSource[]>();
  for (const source of sources) {
    const key = portalKey(source);
    const list = grouped.get(key);
    if (list) list.push(source);
    else grouped.set(key, [source]);
  }

  const pool = new SemanticProviderPool();
  const allScored: ScoredSource[] = [];
  const scoredLock: { promise: Promise<void> } = { promise: Promise.resolve() };

  const runPortalQueue = async (portal: string, portalSources: ScientificSource[]) => {
    const results: ScoredSource[] = [];

    for (let i = 0; i < portalSources.length; i++) {
      const source = portalSources[i];
      const { provider, documentVector, queryVector } =
        await pool.embedDocumentAndQuery(sourceText(source), query);
      const understood = makeUnderstood(source, queryVector, documentVector, provider);
      const localScore = cosineSimilarity(queryVector, documentVector);
      results.push({
        source: understood,
        providerKey: `${provider.kind}:${provider.model}`,
        localScore,
      });

      await options?.onSourceComplete?.(understood, {
        index: i,
        total: portalSources.length,
        sourceName: portal,
        provider: provider.kind,
        model: provider.model,
      });
      await options?.onPortalProgress?.({
        portal,
        index: i + 1,
        total: portalSources.length,
        provider: provider.kind,
        model: provider.model,
      });
    }

    await (async () => {
      const previous = scoredLock.promise;
      let release!: () => void;
      scoredLock.promise = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        allScored.push(...results);
      } finally {
        release();
      }
    })();
  };

  await Promise.all(
    [...grouped.entries()].map(([portal, portalSources]) =>
      runPortalQueue(portal, portalSources),
    ),
  );

  // Fusão somente por ranking dentro do mesmo espaço vetorial. Nunca usamos
  // cosine bruto para comparar Gemini com OpenRouter.
  const groups = new Map<string, ScoredSource[]>();
  for (const item of allScored) {
    const list = groups.get(item.providerKey);
    if (list) list.push(item);
    else groups.set(item.providerKey, [item]);
  }

  const fused = new Map<string, number>();
  for (const group of groups.values()) {
    group.sort((a, b) => b.localScore - a.localScore);
    group.forEach((item, rank) => {
      const rrf = 1 / (60 + rank + 1);
      fused.set(item.source.id, (fused.get(item.source.id) || 0) + rrf);
    });
  }

  const maxFusion = Math.max(...fused.values(), 1 / 61);
  allScored.sort((a, b) =>
    (fused.get(b.source.id)! / maxFusion) - (fused.get(a.source.id)! / maxFusion),
  );

  return {
    sources: allScored.map((item) => ({
      ...item.source,
      semanticFusionScore: Math.round(((fused.get(item.source.id)! / maxFusion) * 100) * 10) / 10,
    })),
    exhaustedProviders: [],
  };
}
