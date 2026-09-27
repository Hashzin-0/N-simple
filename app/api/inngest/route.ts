import { serve } from 'inngest/next';
import { inngest, semanticFullFn, semanticBackfillFn } from '@/lib/semantic/phase2';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Endpoint do Inngest (dev local: `npx inngest-cli@latest dev` +
 * `INNGEST_DEV=1`; produção: registrar a URL no dashboard com a event key).
 *
 * Handlers da fase 2 do semântico (`lib/semantic/phase2.ts`):
 *  - `semantic/full.requested` → cadeia de chunks (understandOne completo → 'full');
 *  - cron a cada 10 min → backfill das fontes 'light' restantes.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [semanticFullFn, semanticBackfillFn],
});
