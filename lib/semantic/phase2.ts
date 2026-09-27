import { Inngest } from 'inngest';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { embedText } from '@/lib/semantic/embeddings';
import { understandFullOne, UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { indexSources } from '@/lib/evidenceIndex';
import { extractTopics } from '@/lib/topicExtractor';
import { buildSourceFromDb } from '@/lib/reuseDecision';
import { ENGINE_CONCURRENCY, DomainKey } from '@/lib/semantic/config';

/**
 * FASE 2 — understandOne completo em segundo plano (Inngest).
 *
 * A fase 1 (foreground) grava TODAS as fontes com semantic_status='light'.
 * Aqui elas são reprocessadas com full-text + cross-encoder + categorias e
 * atualizadas para 'full' — só então a memória de evidências as reutiliza.
 *
 * Retomável de onde parou: o checkpoint é a própria coluna
 * `semantic_status`; cada step processa um chunk pequeno e re-enfileira
 * o próximo. O budget "reseta" a cada invocação (300s na Vercel).
 *
 * Ordem: round-robin entre portais (nenhum espera o outro) com prioridade
 * para as mais reutilizadas (reuse_count) no backfill.
 *
 * Dev local: `npx inngest-cli@latest dev` + INNGEST_DEV=1 no .env.
 */

export const inngest = new Inngest({ id: 'agronomica-n-pro' });

export const SEMANTIC_FULL_EVENT = 'semantic/full.requested';

/** Fontes processadas por step (cada uma: fetch full-text + chunks + embeds). */
export const PHASE2_CHUNK_SIZE = 8;
/** Teto de re-encadeamentos de uma mesma cadeia (evita loop infinito). */
export const MAX_CHAIN_ROUNDS = 120;

export interface FullSemanticEventData {
  /** Ids explícitos (ordem round-robin da busca que os enfileirou). */
  sourceIds?: string[];
  /** Query da busca que descobriu as fontes (fallback por linha). */
  query?: string;
  /** Índice do step na cadeia (0 = primeiro). */
  round?: number;
}

export interface ChunkOutcome {
  loaded: number;
  processed: number;
  remaining: number;
}

const SOURCE_COLUMNS =
  'id, title, authors, year, publication, source_name, source_type, abstract, ' +
  'keywords, direct_url, search_url, doi, abnt_citation, vantagens, desvantagens, ' +
  'caracteristicas, last_verified, reuse_count, semantic_query';

interface PendingRow {
  id: string;
  semantic_query: string | null;
  reuse_count: number;
  source_name: string;
  [key: string]: unknown;
}

function toScientificSource(row: PendingRow): ScientificSource {
  return buildSourceFromDb({
    ...(row as unknown as Parameters<typeof buildSourceFromDb>[0]),
    source_topics: [],
  });
}

/**
 * Carrega o próximo lote de fontes 'light' (fila da fase 2).
 *  - `sourceIds`: preserva a ordem round-robin enviada pela busca;
 *  - sem ids: ordena por reuse_count (mais reutilizáveis primeiro) e
 *    intercala portais para o chunk não vir todo de um portal só.
 */
async function loadPendingBatch(
  opts: { sourceIds?: string[]; size: number },
): Promise<PendingRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { size, sourceIds } = opts;

  if (sourceIds && sourceIds.length > 0) {
    const { data, error } = await supabase!
      .from('sources')
      .select(SOURCE_COLUMNS)
      .eq('semantic_status', 'light')
      .in('id', sourceIds);
    if (error || !data) {
      console.warn('[Phase2] Falha ao carregar lote por ids:', error);
      return [];
    }
    const order = new Map(sourceIds.map((id, i) => [id, i]));
    return (data as unknown as PendingRow[])
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, size);
  }

  const candidateCount = Math.min(Math.max(size * 5, 20), 60);
  const { data, error } = await supabase!
    .from('sources')
    .select(SOURCE_COLUMNS)
    .eq('semantic_status', 'light')
    .order('reuse_count', { ascending: false })
    .limit(candidateCount);
  if (error || !data) {
    console.warn('[Phase2] Falha ao carregar lote pendente:', error);
    return [];
  }

  // Round-robin por portal sobre os candidatos (fila 1→2→3 compartilhada).
  const byPortal = new Map<string, PendingRow[]>();
  for (const row of data as unknown as PendingRow[]) {
    const portal = row.source_name || 'outro';
    const list = byPortal.get(portal);
    if (list) list.push(row);
    else byPortal.set(portal, [row]);
  }
  const interleaved: PendingRow[] = [];
  const maxLen = [...byPortal.values()].reduce((max, l) => Math.max(max, l.length), 0);
  for (let pos = 0; pos < maxLen && interleaved.length < size; pos++) {
    for (const list of byPortal.values()) {
      if (pos < list.length && interleaved.length < size) interleaved.push(list[pos]);
    }
  }
  return interleaved;
}

/** Conta o que ainda falta na fila (chip "classificando em 2º plano"). */
export async function countSemanticPending(): Promise<{
  pending: number;
  full: number;
  lightByPortal: Record<string, number>;
}> {
  const empty = { pending: 0, full: 0, lightByPortal: {} as Record<string, number> };
  if (!isSupabaseConfigured()) return empty;

  try {
    const [pendingRes, fullRes, lightRes] = await Promise.all([
      supabase!
        .from('sources')
        .select('id', { count: 'exact', head: true })
        .eq('semantic_status', 'light'),
      supabase!
        .from('sources')
        .select('id', { count: 'exact', head: true })
        .eq('semantic_status', 'full'),
      supabase!
        .from('sources')
        .select('source_name')
        .eq('semantic_status', 'light')
        .limit(5000),
    ]);

    const lightByPortal: Record<string, number> = {};
    for (const row of (lightRes.data ?? []) as Array<{ source_name: string }>) {
      const portal = row.source_name || 'outro';
      lightByPortal[portal] = (lightByPortal[portal] ?? 0) + 1;
    }

    return {
      pending: pendingRes.count ?? 0,
      full: fullRes.count ?? 0,
      lightByPortal,
    };
  } catch (err) {
    console.warn('[Phase2] countSemanticPending falhou:', err);
    return empty;
  }
}

/**
 * Processa UM chunk da fila: understandOne completo + persistência com
 * semantic_status='full'. Nunca lança — erros viram contadores.
 */
export async function processFullSemanticChunk(
  opts: FullSemanticEventData & { size?: number },
): Promise<ChunkOutcome> {
  const size = opts.size ?? PHASE2_CHUNK_SIZE;
  const rows = await loadPendingBatch({ sourceIds: opts.sourceIds, size });
  if (rows.length === 0) return { loaded: 0, processed: 0, remaining: 0 };

  const domain: DomainKey = 'agro';
  const understood: UnderstoodSource[] = [];
  let promoted = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const i = cursor++;
      const row = rows[i];
      try {
        const source = toScientificSource(row);
        const query =
          row.semantic_query ||
          opts.query ||
          extractTopics(source.title).join(' ') ||
          source.title;
        const queryEmbedding = await embedText(query, 'RETRIEVAL_QUERY').catch(() => []);

        const full = await understandFullOne(query, queryEmbedding, source, domain);
        // Fallback leve (entendeu só o resumo) NÃO promove — a fonte fica
        // 'light' e o backfill tenta de novo. Só 'full' entra no chunk.
        if (full.semanticStatus !== 'full') {
          console.warn('[Phase2] fallback leve — permanece light:', row.id);
          continue;
        }
        understood.push({
          ...full,
          // Fase 2 não redecide persistência: a fonte JÁ está no banco
          // (foi aceita na fase 1) — aqui só classifica e formata.
          shouldPersist: true,
          semanticQuery: row.semantic_query ?? query,
        });
        promoted += 1;
      } catch (err) {
        console.warn('[Phase2] understandOne falhou:', row.id, err);
      }
    }
  }

  const workerCount = Math.min(ENGINE_CONCURRENCY, rows.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  let processed = 0;
  if (understood.length > 0) {
    try {
      const stats = await indexSources(understood, extractTopics(opts.query || ''));
      processed = stats.indexedIds.length;
      console.info(
        `[Phase2] chunk: ${processed}/${rows.length} atualizadas para 'full' ` +
          `(promovidas: ${promoted}, errors=${stats.errors})`,
      );
    } catch (err) {
      console.warn('[Phase2] indexSources do chunk falhou:', err);
      processed = 0;
    }
  }

  let remaining = 0;
  try {
    const countRes = await supabase!
      .from('sources')
      .select('id', { count: 'exact', head: true })
      .eq('semantic_status', 'light');
    remaining = countRes.count ?? 0;
  } catch {
    remaining = Math.max(0, rows.length - processed);
  }

  return { loaded: rows.length, processed, remaining };
}

/**
 * Enfileira a fase 2. Fire-and-forget: se o Inngest não estiver
 * configurado/rodando, avisa e o cron de backfill assume depois.
 */
export async function enqueueFullSemantic(data: FullSemanticEventData): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (!data.sourceIds || data.sourceIds.length === 0) return false;

  try {
    await inngest.send({ name: SEMANTIC_FULL_EVENT, data });
    return true;
  } catch (err) {
    console.warn(
      '[Phase2] Não foi possível enfileirar a fase 2 (Inngest fora do ar?). ' +
        'As fontes continuam light e o cron de backfill as assume. Erro:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** Cadeia de chunks: processa um lote e re-enfila o próximo até zerar. */
export const semanticFullFn = inngest.createFunction(
  {
    id: 'semantic-full',
    retries: 2,
    concurrency: { limit: 1, key: 'semantic-queue' },
    triggers: [{ event: SEMANTIC_FULL_EVENT }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as FullSemanticEventData;
    const round = typeof data.round === 'number' ? data.round : 0;

    const outcome = await step.run('process-chunk', () =>
      processFullSemanticChunk({ ...data, size: PHASE2_CHUNK_SIZE }),
    );

    const shouldContinue =
      outcome.loaded > 0 &&
      outcome.processed > 0 &&
      outcome.remaining > 0 &&
      round < MAX_CHAIN_ROUNDS;

    if (shouldContinue) {
      await step.run('requeue', () =>
        inngest.send({
          name: SEMANTIC_FULL_EVENT,
          // Próximo passo da cadeia: sem ids explícitos (os da busca já
          // foram) — passa a alimentar o backfill geral round-robin.
          data: { query: data.query, round: round + 1 },
        }),
      );
    } else if (outcome.loaded > 0 && outcome.processed === 0) {
      console.warn('[Phase2] Chunk não atualizou nenhuma fonte — cadeia interrompida.', outcome);
    }

    return outcome;
  },
);

/**
 * Backfill contínuo: a cada 10 min dispara uma nova cadeia para as fontes
 * 'light' restantes (linhas antigas do banco + fontes órfãs de buscas).
 */
export const semanticBackfillFn = inngest.createFunction(
  { id: 'semantic-backfill', retries: 1, triggers: [{ cron: '*/10 * * * *' }] },
  async ({ step }) => {
    await step.run('kick-backfill', async () => {
      if (!isSupabaseConfigured()) return 'sem supabase';
      try {
        await inngest.send({ name: SEMANTIC_FULL_EVENT, data: { round: 0 } });
        return 'enfileirado';
      } catch (err) {
        return `falhou: ${err instanceof Error ? err.message : String(err)}`;
      }
    });
    return 'ok';
  },
);
