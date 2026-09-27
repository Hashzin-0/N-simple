import { serve } from 'inngest/next';
import { inngest, semanticFullFn, semanticLightKickFn } from '@/lib/semantic/phase2';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Endpoint do Inngest (dev local: `npx inngest-cli@latest dev` +
 * `INNGEST_DEV=1`; produção: registrar a URL no dashboard com a event key).
 *
 * Handlers da fase 2 do semântico (`lib/semantic/phase2.ts`) — SEM cron:
 *  - `semantic/light.registered` → `semantic-light-kick` (debounce 5s)
 *    emite a cadeia assim que um lote 'light' é gravado;
 *  - `semantic/full.requested` → cadeia de chunks (understandOne completo
 *    → 'full'), drenando TODA a fila 'light' a cada gatilho.
 *
 * Redes de segurança para linhas gravadas fora da aplicação:
 * webhook do Supabase em `app/api/semantic/light-registered` e a
 * reativação a cada nova gravação.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [semanticFullFn, semanticLightKickFn],
});
