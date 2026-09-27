import { createHash } from 'node:crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Verificação de aluno ativo do CEFSA (Centro Educacional da Fundação
 * Salvador Arena) — usada pelo gate do painel de admin.
 *
 * Fonte da verdade: os Web Services do Moodle do CEFSA
 * (`ead.cefsa.edu.br`, override via CEFSA_MOODLE_URL):
 *   1. POST /login/token.php  (username + password + service) → token
 *   2. POST /webservice/rest/server.php?wsfunction=core_webservice_get_site_info
 *   3. (opcional) core_user_get_users_by_field → e-mail/suspensão
 * A senha do aluno passa pelaqui uma única vez e **nunca é gravada** —
 * só identidade + `verified_at`/`expires_at` em `cefsa_verifications`.
 *
 * Não confundir com o Portal do Aluno (`aluno.cefsa.edu.br`): é ASP.NET
 * MVC com reCAPTCHA v3 e antiforgery, sem API — fora do alcance.
 */

export const CEFSA_MOODLE_URL = (
  process.env.CEFSA_MOODLE_URL || 'https://ead.cefsa.edu.br'
).replace(/\/+$/, '');
const CEFSA_MOODLE_SERVICE = process.env.CEFSA_MOODLE_SERVICE || 'moodle_mobile_app';
const TOKEN_ENDPOINT = `${CEFSA_MOODLE_URL}/login/token.php`;
// Endpoint REST do Moodle deste host (o canônico /webservice/rest.php
// responde 404 aqui — verificado em 2026-09).
const REST_ENDPOINT = `${CEFSA_MOODLE_URL}/webservice/rest/server.php`;
const WS_TIMEOUT_MS = 12_000;

/** Validade da verificação no Supabase (revalidar via POST antes de expirar). */
export const CEFSA_VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const INVALID_CREDENTIALS_HINT =
  'Se a sua conta do CEFSA usa login Microsoft/Office 365, o Moodle pode não validar senha local — nesse caso a verificação local não funciona (caminho B: SSO).';

export type CefsaFailureReason =
  | 'invalid_credentials'
  | 'account_inactive'
  | 'moodle_service_disabled'
  | 'moodle_unavailable';

export interface CefsaIdentity {
  moodleUserId: string;
  username: string;
  fullName: string;
  email: string | null;
  siteUrl: string | null;
}

export type CefsaVerifyResult =
  | { ok: true; identity: CefsaIdentity }
  | { ok: false; reason: CefsaFailureReason; detail?: string };

interface MoodleJson {
  [key: string]: unknown;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** POST url-encoded e parse JSON (Moodle devolve 200 + {errorcode} nos erros). */
async function postForm(url: string, params: Record<string, string>): Promise<MoodleJson> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    cache: 'no-store',
    signal: AbortSignal.timeout(WS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('resposta não-JSON');
  return parsed as MoodleJson;
}

/** Chama uma função WS. Lança se o Moodle responder com <EXCEPTION>. */
async function wsCall(token: string, fn: string, params: Record<string, string>): Promise<unknown> {
  const data = await postForm(REST_ENDPOINT, {
    wstoken: token,
    wsfunction: fn,
    moodlewsrestformat: 'json',
    ...params,
  });
  if ('exception' in data) {
    throw new Error(asText(data.errorcode) || 'ws_error');
  }
  return data;
}

async function loadIdentity(token: string, usuario: string): Promise<CefsaVerifyResult> {
  let info: MoodleJson;
  try {
    info = (await wsCall(token, 'core_webservice_get_site_info', {})) as MoodleJson;
  } catch (error) {
    return {
      ok: false,
      reason: 'moodle_unavailable',
      detail: `core_webservice_get_site_info: ${error instanceof Error ? error.message : 'erro'}`,
    };
  }

  const moodleUserId = asText(info.userid);
  if (!moodleUserId) {
    return { ok: false, reason: 'moodle_unavailable', detail: 'sem userid no site info' };
  }

  let email: string | null = null;
  let suspended = false;
  let confirmed = true;
  try {
    const users = (await wsCall(token, 'core_user_get_users_by_field', {
      field: 'userid',
      'values[0]': moodleUserId,
    })) as unknown;
    const first = Array.isArray(users) ? users[0] : null;
    if (first && typeof first === 'object') {
      const u = first as MoodleJson;
      email = asText(u.email) || null;
      suspended = Number(u.suspended ?? 0) === 1;
      confirmed = Number(u.confirmed ?? 1) !== 0;
    }
  } catch {
    // Função pode não estar liberada no service do Moodle — segue sem
    // e-mail e sem checagem de suspensão (identidade mínima já basta).
  }

  if (suspended || !confirmed) return { ok: false, reason: 'account_inactive' };

  return {
    ok: true,
    identity: {
      moodleUserId,
      username: asText(info.username) || usuario,
      fullName: asText(info.fullname),
      email,
      siteUrl: asText(info.siteurl) || null,
    },
  };
}

/** Valida RA/RM + senha contra o Moodle do CEFSA. Nunca lança. */
export async function verifyCefsaCredentials(
  usuario: string,
  senha: string
): Promise<CefsaVerifyResult> {
  let tokenData: MoodleJson;
  try {
    tokenData = await postForm(TOKEN_ENDPOINT, {
      username: usuario,
      password: senha,
      service: CEFSA_MOODLE_SERVICE,
    });
  } catch (error) {
    return {
      ok: false,
      reason: 'moodle_unavailable',
      detail: error instanceof Error ? error.message : 'falha de rede',
    };
  }

  const token = asText(tokenData.token);
  if (token) return loadIdentity(token, usuario);

  const code = asText(tokenData.errorcode);
  const error = asText(tokenData.error);
  switch (code) {
    case 'invalidlogin':
      return { ok: false, reason: 'invalid_credentials', detail: INVALID_CREDENTIALS_HINT };
    case 'usernotconfirmed':
    case 'passwordisexpired':
    case 'userauthexpired':
      return { ok: false, reason: 'account_inactive', detail: error || code };
    case 'servicenotavailable':
    case 'servicenotexists':
    case 'enablewsdescription':
    case 'requirecorrectaccess':
      return { ok: false, reason: 'moodle_service_disabled', detail: error || code };
    default:
      return { ok: false, reason: 'moodle_unavailable', detail: error || code || 'resposta vazia' };
  }
}

// ─────────────────────────────────────────────────────────────
// Rate limit (module-level Map, por instância do servidor)
// ─────────────────────────────────────────────────────────────
// Protege o CEFSA contra uso desta rota como ferramenta de força-bruta.
// Limite por IP (todas as tentativas) + trava por RA (falhas consecutivas).
// Obs.: memória por instância — em serverless não é global; é a melhor
// opção aqui porque a chave publishable do Supabase é pública e não dá
// para confiar em contador gravado no banco.

const IP_MAX_ATTEMPTS = 10;
const IP_WINDOW_MS = 10 * 60_000;
const ACCOUNT_MAX_FAILS = 5;
const ACCOUNT_WINDOW_MS = 15 * 60_000;
const ACCOUNT_LOCK_MS = 15 * 60_000;

interface AttemptCounter {
  count: number;
  resetAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptCounter>();

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function ipKey(ip: string): string {
  return `ip:${hashKey(ip)}`;
}

function accountKey(usuario: string): string {
  return `acc:${hashKey(usuario.trim().toLowerCase())}`;
}

function pruneAttempts(now: number): void {
  if (attempts.size < 500) return;
  for (const [key, counter] of attempts) {
    if (counter.resetAt <= now && counter.lockedUntil <= now) attempts.delete(key);
  }
}

function bump(key: string, windowMs: number, lockedMs: number, lockAt: number): void {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs, lockedUntil: 0 });
    return;
  }
  current.count += 1;
  if (lockAt > 0 && current.count >= lockAt) {
    current.lockedUntil = now + lockedMs;
    current.resetAt = now + lockedMs;
  }
}

/** true se ainda há orçamento para tentar (chamar antes de ir ao Moodle). */
export function checkCefsaRateLimit(
  ip: string,
  usuario: string
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  pruneAttempts(now);

  const acc = attempts.get(accountKey(usuario));
  if (acc) {
    if (acc.lockedUntil > now) {
      return { allowed: false, retryAfterSec: Math.ceil((acc.lockedUntil - now) / 1000) };
    }
    if (acc.resetAt > now && acc.count >= ACCOUNT_MAX_FAILS) {
      return { allowed: false, retryAfterSec: Math.ceil((acc.resetAt - now) / 1000) };
    }
  }

  const perIp = attempts.get(ipKey(ip));
  if (perIp && perIp.resetAt > now && perIp.count >= IP_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((perIp.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfterSec: 0 };
}

/** Registra o desfecho: sucesso zera a trava da conta, falha soma. */
export function recordCefsaAttempt(ip: string, usuario: string, valid: boolean): void {
  const now = Date.now();
  pruneAttempts(now);
  bump(ipKey(ip), IP_WINDOW_MS, 0, 0);
  if (valid) {
    attempts.delete(accountKey(usuario));
    return;
  }
  bump(accountKey(usuario), ACCOUNT_WINDOW_MS, ACCOUNT_LOCK_MS, ACCOUNT_MAX_FAILS);
}

// ─────────────────────────────────────────────────────────────
// Persistência (Supabase — publishable key, padrão do repo)
// ─────────────────────────────────────────────────────────────

export interface CefsaVerification {
  userId: string;
  raRm: string;
  moodleUserId: string | null;
  fullName: string | null;
  email: string | null;
  siteUrl: string | null;
  verifiedAt: string;
  expiresAt: string;
}

function rowToVerification(row: Record<string, unknown>): CefsaVerification {
  return {
    userId: asText(row.user_id),
    raRm: asText(row.ra_rm),
    moodleUserId: asText(row.moodle_user_id) || null,
    fullName: asText(row.full_name) || null,
    email: asText(row.email) || null,
    siteUrl: asText(row.site_url) || null,
    verifiedAt: asText(row.verified_at),
    expiresAt: asText(row.expires_at),
  };
}

export function isVerificationFresh(verification: CefsaVerification | null): boolean {
  if (!verification) return false;
  const expires = Date.parse(verification.expiresAt);
  return Number.isFinite(expires) && expires > Date.now();
}

/** Grava/atualiza a verificação de um usuário. Retorna se persistiu. */
export async function saveVerification(
  input: { userId: string; raRm: string; identity: CefsaIdentity }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const now = Date.now();
  try {
    const { error } = await supabase!.from('cefsa_verifications').upsert(
      {
        user_id: input.userId,
        ra_rm: input.raRm,
        moodle_user_id: input.identity.moodleUserId,
        full_name: input.identity.fullName,
        email: input.identity.email,
        site_url: input.identity.siteUrl,
        verified_at: new Date(now).toISOString(),
        expires_at: new Date(now + CEFSA_VERIFY_TTL_MS).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('[Cefsa] saveVerification error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Cefsa] saveVerification exception:', error);
    return false;
  }
}

/** Lê a verificação de um usuário (pode estar expirada). */
export async function getVerification(userId: string): Promise<CefsaVerification | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase!
      .from('cefsa_verifications')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[Cefsa] getVerification error:', error);
      return null;
    }
    return data ? rowToVerification(data as Record<string, unknown>) : null;
  } catch (error) {
    console.error('[Cefsa] getVerification exception:', error);
    return null;
  }
}
