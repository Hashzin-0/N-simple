import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { enqueueFullSemantic } from '@/lib/semantic/enqueue';

export const dynamic = 'force-dynamic';

/**
 * POST /api/semantic/light-registered — receptor do Database Webhook do
 * Supabase para `sources`.
 *
 * Rede de segurança para fontes 'light' gravadas FORA da aplicação
 * (SQL manual, seed, migração): dentro do app o gatilho é o próprio
 * `lib/evidenceIndex.indexSources`, que dispara logo após cada lote.
 * Este endpoint cobre o resto — mesma fila, mesmo debounce, mesma cadeia.
 *
 * Configuração no painel do Supabase (Database → Webhooks):
 *  - Table: `sources`; Events: Insert + Update;
 *  - Function: `POST https://<APP_URL>/api/semantic/light-registered`;
 *  - Header: `Authorization: Bearer <SEMANTIC_WEBHOOK_SECRET>`.
 *
 * Duas formas de chegar aqui (podem coexistir):
 *  1. Dashboard do Supabase (Database → Webhooks) — ver passos acima;
 *  2. SQL versionado: `supabase/migration-semantic-webhook.sql` cria o
 *     trigger `trg_sources_light_webhook` (WHEN `semantic_status='light'`)
 *     + tabela `public.semantic_webhook_config` (1 linha: url + secret;
 *     deny-by-default: RLS sem policies + REVOKE). A config NÃO usa
 *     `ALTER DATABASE ... SET "app.settings.x"`: gravar GUC placeholder
 *     exige superuser e no Supabase dá `42501 permission denied to set
 *     parameter`. GUC segue como override opcional (só superuser).
 *
 * Segredo server-side (`SEMANTIC_WEBHOOK_SECRET` em `.env` = coluna
 * `secret` da config): se vazio, o endpoint responde 503 e o webhook é
 * ignorado — nenhuma escrita fora do app passa a disparar a fase 2 sem
 * configuração explícita.
 */

/** Igualdade de segredos sem vazamento por tempo de comparação. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface SupabaseWebhookPayload {
  type?: string;
  table?: string;
  record?: Record<string, unknown> | null;
  records?: Array<{ record?: Record<string, unknown> | null }>;
}

/** Normaliza os dois formatos de payload (record único / records[]). */
function extractRows(payload: SupabaseWebhookPayload): Array<Record<string, unknown>> {
  if (Array.isArray(payload.records)) {
    return payload.records.map((entry) => entry?.record ?? {}).filter(Boolean);
  }
  if (payload.record) return [payload.record];
  return [];
}

export async function POST(req: NextRequest) {
  const secret = process.env.SEMANTIC_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: 'SEMANTIC_WEBHOOK_SECRET não configurado — webhook desativado.' },
      { status: 503 },
    );
  }

  const auth = req.headers.get('authorization');
  const provided =
    auth && auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : req.headers.get('x-webhook-secret');
  if (!secretMatches(provided, secret)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await req.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, reason: 'json inválido' }, { status: 400 });
  }

  const lightRows = extractRows(payload).filter((row) => row.semantic_status === 'light');
  if (lightRows.length === 0) {
    return NextResponse.json({ ok: true, enqueued: false, reason: 'nenhuma fonte light no payload' });
  }

  const query = lightRows
    .map((row) => (typeof row.semantic_query === 'string' ? row.semantic_query : ''))
    .find((q) => q.trim().length > 0);

  const enqueued = await enqueueFullSemantic({ query: query || undefined });

  return NextResponse.json({ ok: true, enqueued, light: lightRows.length });
}
