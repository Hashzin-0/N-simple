import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { embedText, embedTexts, cosineSimilarity, cosineToPercentage } from './embeddings';
import { UnderstoodSource, getDomainAnchorEmbedding, angleQuality } from './relevanceEngine';
import {
  SEMANTIC_DISCARD_THRESHOLD,
  BI_ENCODER_WEIGHT,
  CROSS_ENCODER_WEIGHT,
  AGRO_DOMAIN_RELEVANCE_THRESHOLD,
  DomainKey,
} from './config';

/**
 * FILAS POR PORTAL — semântico dedicado por portal.
 *
 * Cada portal (YouTube, Embrapa, SciELO, ...) tem a SUA fila de fontes
 * ordenada 1→2→3 por relevância intra-portal. O processamento round-robin
 * (global + detalhe por portal) é orquestrado por `searchSources`.
 *
 * FASE 1 (este módulo): light de TUDO em lote — 1 embed do título+abstract
 * por fonte (lotes de 50 requests), score de cosseno vs query + âncora de
 * domínio. Sem full-text, sem cross-encoder, sem categorias: isso tudo é
 * da fase 2 (full, em segundo plano via Inngest). Cabe no budget da função.
 */

export interface PortalQueueItem {
  source: UnderstoodSource;
  portal: string;
  /** Posição na fila do portal (0-based; 1→2→3 para o usuário). */
  index: number;
  /** Tamanho total da fila deste portal. */
  total: number;
}

export interface LightPhaseResult {
  /** Todas as fontes light-entendidas (inclui descartadas — vão para a fila). */
  understood: UnderstoodSource[];
  /** portal → fila ordenada 1→2→3. */
  queues: Map<string, UnderstoodSource[]>;
}

function sourceText(src: ScientificSource): string {
  return [src.title, src.abstract, (src.keywords || []).join(' ')]
    .filter(Boolean)
    .join(' ');
}

/**
 * FASE 1: analisa TODAS as fontes em modo light e monta as filas por portal.
 *
 * Não descarta fonte por falha de infra: se o batch de embeddings falhar
 * (quota/RPM), assume candidata de domínio (shouldPersist=true) para não
 * perder o progresso dos scrapers — a fase 2 reavalia com full-text real.
 */
export async function runLightPhase(
  query: string,
  sources: ScientificSource[],
  queryEmbedding: number[] | undefined,
  domain: DomainKey,
): Promise<LightPhaseResult> {
  if (sources.length === 0) {
    return { understood: [], queues: new Map() };
  }

  let qEmb = queryEmbedding && queryEmbedding.length > 0 ? queryEmbedding : [];
  if (qEmb.length === 0) {
    qEmb = await embedText(query, 'RETRIEVAL_QUERY').catch(() => []);
  }

  const texts = sources.map(sourceText);
  let docEmbeddings: number[][] = [];
  try {
    docEmbeddings = await embedTexts(texts, 'RETRIEVAL_DOCUMENT');
  } catch (err) {
    console.warn('[PortalQueues] batch de embeddings da fase 1 falhou:', err);
    docEmbeddings = texts.map(() => []);
  }

  const anchor = await getDomainAnchorEmbedding(domain).catch(() => null);

  const understood: UnderstoodSource[] = sources.map((src, i) => {
    const doc = docEmbeddings[i] || [];
    const hasVec = doc.length > 0 && qEmb.length > 0;
    const cos = hasVec ? cosineSimilarity(qEmb, doc) : 0;
    const biPct = cosineToPercentage(cos);
    // Mesmo score do understandOneLight (sem cross-encoder: peso 0.3 neutro).
    const semanticScore =
      Math.round((biPct * BI_ENCODER_WEIGHT + 50 * CROSS_ENCODER_WEIGHT) * 10) / 10;

    let domainScore = 0;
    let inAgroDomain = false;
    if (doc.length > 0 && anchor) {
      domainScore = cosineToPercentage(cosineSimilarity(doc, anchor));
      inAgroDomain = domainScore > AGRO_DOMAIN_RELEVANCE_THRESHOLD;
    } else {
      // Sem embedding de domínio → mantém candidata (não perder progresso).
      inAgroDomain = true;
      domainScore = AGRO_DOMAIN_RELEVANCE_THRESHOLD + 1;
    }

    const discarded = semanticScore <= SEMANTIC_DISCARD_THRESHOLD;
    const cosTheta = Math.max(0, cos);

    return {
      ...src,
      semanticScore,
      semanticCategories: [],
      bestExcerpt: (src.abstract || src.title || '').slice(0, 600),
      discarded,
      docEmbedding: doc,
      chunks: [],
      usedFullText: false,
      domainScore,
      inAgroDomain,
      shouldPersist: !discarded || inAgroDomain,
      semanticStatus: 'light' as const,
      semanticQuery: query,
      trigonometricSimilarity: {
        cosTheta: Math.round(cosTheta * 1000) / 1000,
        angleDegrees:
          Math.round(Math.acos(Math.min(1, cosTheta)) * (180 / Math.PI) * 10) / 10,
        percentage: Math.round(semanticScore),
        alignmentQuality: angleQuality(semanticScore),
      },
    } satisfies UnderstoodSource;
  });

  const queues = new Map<string, UnderstoodSource[]>();
  for (const src of understood) {
    const portal = src.sourceName;
    const list = queues.get(portal);
    if (list) list.push(src);
    else queues.set(portal, [src]);
  }
  // Fila 1→2→3 por relevância DENTRO do portal.
  for (const list of queues.values()) {
    list.sort((a, b) => b.semanticScore - a.semanticScore);
  }

  return { understood, queues };
}

/**
 * Round-robin justo entre as filas: pega a posição N de todos os portais
 * antes de avançar para a posição N+1 — YouTube 1, Embrapa 1, SciELO 1, ...
 * depois YouTube 2, Embrapa 2, ... Nenhum portal espera o outro esgotar.
 */
export function roundRobinQueueItems(
  queues: Map<string, UnderstoodSource[]>,
): PortalQueueItem[] {
  const portals = [...queues.keys()];
  const maxLen = portals.reduce((max, p) => Math.max(max, queues.get(p)!.length), 0);
  const items: PortalQueueItem[] = [];

  for (let pos = 0; pos < maxLen; pos++) {
    for (const portal of portals) {
      const list = queues.get(portal)!;
      if (pos < list.length) {
        items.push({ source: list[pos], portal, index: pos, total: list.length });
      }
    }
  }
  return items;
}
