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

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
