import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let initializedWith: string | null = null;

export function initBrowserSupabase(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  const signature = `${url}|${key}`;
  if (client && initializedWith === signature) return client;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  initializedWith = signature;
  return client;
}

export function getBrowserSupabase(): SupabaseClient | null {
  return client;
}
