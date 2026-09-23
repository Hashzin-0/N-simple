/**
 * Resolução de config pública de auth no servidor (sem NEXT_PUBLIC_*).
 * - Supabase URL/key: env server-side (fallback NEXT_PUBLIC só p/ dev local legado).
 * - Google Client ID: GOOGLE_CLIENT_ID ou Management API do Supabase
 *   (GET /v1/projects/{ref}/config/auth → external_google_client_id).
 */

export interface PublicAuthConfig {
  supabaseUrl: string;
  supabaseKey: string;
  googleClientId: string | null;
  googleEnabled: boolean;
}

const MANAGEMENT_TOKENS = ['SUPABASE_MANAGEMENT_TOKEN', 'SUPABASE_ACCESS_TOKEN'] as const;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedGoogle: { clientId: string | null; enabled: boolean; at: number } | null = null;
let inflightGoogle: Promise<{ clientId: string | null; enabled: boolean }> | null = null;

function readSupabaseEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return { url, key };
}

function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const first = host.split('.')[0];
    return first && first !== 'supabase' ? first : null;
  } catch {
    return null;
  }
}

function managementToken(): string | null {
  for (const name of MANAGEMENT_TOKENS) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
}

async function fetchGoogleFromManagement(
  url: string,
  key: string
): Promise<{ clientId: string | null; enabled: boolean }> {
  const ref = projectRefFromUrl(url);
  const token = managementToken();
  const results: { clientId: string | null; enabled: boolean } = { clientId: null, enabled: false };

  // Público: /auth/v1/settings → apenas se o provider está habilitado
  try {
    const settingsRes = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 600 },
    });
    if (settingsRes.ok) {
      const settings = (await settingsRes.json()) as { external?: { google?: boolean } };
      results.enabled = Boolean(settings.external?.google);
    }
  } catch {
    // segue sem o flag público
  }

  if (ref && token) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: token,
        },
        next: { revalidate: 600 },
      });
      if (res.ok) {
        const authConfig = (await res.json()) as {
          external_google_client_id?: string;
          external_google_enabled?: boolean;
        };
        const raw = (authConfig.external_google_client_id || '').trim();
        // Dashboard pode listar IDs separados por víncula; o Web é o primeiro
        results.clientId = raw ? (raw.split(',')[0] || null) : null;
        if (typeof authConfig.external_google_enabled === 'boolean') {
          results.enabled = authConfig.external_google_enabled;
        }
      }
    } catch {
      // sem Management API — cliente cai no fluxo OAuth redirect
    }
  }

  return results;
}

async function resolveGoogle(): Promise<{ clientId: string | null; enabled: boolean }> {
  const envId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (cachedGoogle && Date.now() - cachedGoogle.at < CACHE_TTL_MS) {
    if (envId) return { clientId: envId, enabled: cachedGoogle.enabled || true };
    return { clientId: cachedGoogle.clientId, enabled: cachedGoogle.enabled };
  }

  if (!inflightGoogle) {
    const { url, key } = readSupabaseEnv();
    inflightGoogle = fetchGoogleFromManagement(url, key)
      .then((result) => {
        const clientId = envId || result.clientId;
        cachedGoogle = { clientId, enabled: result.enabled || Boolean(envId), at: Date.now() };
        return { clientId, enabled: cachedGoogle.enabled };
      })
      .finally(() => {
        inflightGoogle = null;
      });
  }

  return inflightGoogle;
}

export async function getPublicAuthConfig(): Promise<PublicAuthConfig> {
  const { url, key } = readSupabaseEnv();
  const google = url && key ? await resolveGoogle() : { clientId: null, enabled: false };
  return {
    supabaseUrl: url,
    supabaseKey: key,
    googleClientId: google.clientId,
    googleEnabled: google.enabled,
  };
}
