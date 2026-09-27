import { Inngest } from 'inngest';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Cliente Inngest + eventos da FASE 2 do semântico.
 *
 * Módulo separado de `phase2.ts` para poder ser importado por
 * `lib/evidenceIndex.ts` (ponto único de escrita de `sources`) sem
 * ciclo de imports: evidenceIndex → phase2 → evidenceIndex.
 *
 * Fluxo:
 *   writer grava semantic_status='light'
 *     → `enqueueFullSemantic()` envia `semantic/light.registered`
 *     → `semantic-light-kick` (debounce 5s) reenvia `semantic/full.requested`
 *     → `semantic-full` drena TODA a fila 'light' (novas + legadas).
 */

export const inngest = new Inngest({ id: 'agronomica-n-pro' });

/** Gravação de fonte 'light' — pede o início (ou retomada) da cadeia. */
export const SEMANTIC_LIGHT_EVENT = 'semantic/light.registered';
/** Cadeia de chunks da fase 2 (understandOne completo → 'full'). */
export const SEMANTIC_FULL_EVENT = 'semantic/full.requested';

export interface FullSemanticEventData {
  /** Query da busca que acionou a cadeia (fallback por linha). */
  query?: string;
  /** Índice do step na cadeia (0 = primeiro). */
  round?: number;
  /** Lotes seguidos sem nenhuma promoção (guarda contra loop infinito). */
  stalled?: number;
}

/**
 * Pede a drenagem da fila 'light'. Fire-and-forget: se o Inngest não
 * estiver configurado/rodando, avisa e a próxima gravação tenta de novo.
 *
 * NÃO envia `sourceIds`: o 1º lote já lê a fila global (reuse_count +
 * round-robin de portais), então o disparo cobre também linhas legadas
 * que ninguém acabou de gravar.
 */
export async function enqueueFullSemantic(data: FullSemanticEventData = {}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    await inngest.send({ name: SEMANTIC_LIGHT_EVENT, data: { round: 0, ...data } });
    return true;
  } catch (err) {
    console.warn(
      '[Phase2] Não foi possível enfileirar a fase 2 (Inngest fora do ar?). ' +
        'As fontes continuam light e a próxima gravação reativa a cadeia. Erro:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
