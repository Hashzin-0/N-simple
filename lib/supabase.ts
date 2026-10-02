import { createClient } from '@supabase/supabase-js';

// Prefer server-only names; NEXT_PUBLIC_* only as local-dev fallback (no NEXT_PUBLIC on deploy).
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase] Variáveis de ambiente não configuradas. ' +
    'Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY em .env.local'
  );
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ── Chave privilegiada (server-only) ─────────────────────────────────
// SUPABASE_SECRET_KEY: formato novo (Dashboard → JWT Signing Keys →
// sb_secret_*). SUPABASE_SERVICE_ROLE_KEY: legado, aceito como fallback.
// service_role/secret bypassa RLS — é a identidade das escritas da
// pipeline semântica (sources/chunks/categories/topics/search_queries).
const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseUrl && adminKey
  ? createClient(supabaseUrl, adminKey)
  : null;

if (supabaseUrl && !adminKey && supabase) {
  console.warn(
    '[Supabase] SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) não configurada — ' +
      'a pipeline semântica vai usar a publishable key. Após ' +
      'supabase/migration-semantic-privileged-writes.sql as policies públicas de ' +
      'escrita são revogadas e as gravações falharão até a chave ser definida.'
  );
}

/**
 * Cliente da pipeline semântica (fontes/chunks/categorias/topics/log).
 * Chave privilegiada quando configurada; senão publishable (aviso único
 * acima) — funciona só enquanto existirem policies públicas de escrita.
 */
export const supabaseSemantic = supabaseAdmin ?? supabase;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
