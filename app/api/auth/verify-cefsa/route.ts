import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  CEFSA_VERIFY_TTL_MS,
  checkCefsaRateLimit,
  getVerification,
  isVerificationFresh,
  recordCefsaAttempt,
  saveVerification,
  verifyCefsaCredentials,
} from '@/lib/cefsa';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Verificação de aluno ativo do CEFSA (gate do painel de admin).
 *
 * POST /api/auth/verify-cefsa { ra, senha, userId? }
 *   → { valid: true,  student: {...}, verification: {...}, persisted, source }
 *   → { valid: false, reason, hint?, source }            (200 = resposta de credencial)
 *   → 400 body inválido · 401 token inválido · 429 rate limit · 503 Moodle fora
 *
 * GET /api/auth/verify-cefsa?userId=...
 *   → { verified, verification | null, source }           (gate: verified=true ⇒ admin)
 *
 * Identidade: `Authorization: Bearer <supabase access_token>` (confiável) ou,
 * na ausência de token, `userId` no corpo/query — convenção do repo (mais fraca,
 * manter só até o painel de admin mandar sempre o token).
 *
 * A senha só viaja para o Moodle e não é gravada. A verificação vale
 * CEFSA_VERIFY_TTL_MS (7 dias) — revalidar via POST quando expirar.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const MAX_USUARIO_LEN = 100;
const MAX_SENHA_LEN = 200;
const MAX_USER_ID_LEN = 128;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Resolve o usuário do app: token Supabase > userId do corpo/query. */
async function resolveUserId(
  request: NextRequest,
  fallback: string | null
): Promise<{ userId: string | null; status?: number; error?: string }> {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^bearer\s+/i, '').trim();
  if (!token) return { userId: fallback };

  if (!isSupabaseConfigured()) {
    return { userId: null, status: 503, error: 'Supabase não configurado.' };
  }
  const { data, error } = await supabase!.auth.getUser(token);
  if (error || !data.user) {
    return { userId: null, status: 401, error: 'Token inválido ou expirado.' };
  }
  if (fallback && fallback !== data.user.id) {
    return { userId: null, status: 400, error: 'userId não corresponde ao token.' };
  }
  return { userId: data.user.id };
}

function normalizeUsuario(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\r\n\t]/g, '').trim().slice(0, MAX_USUARIO_LEN);
}

function normalizeSenha(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.slice(0, MAX_SENHA_LEN);
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers: NO_STORE });
    }

    const usuario = normalizeUsuario(body.ra ?? body.usuario ?? body.username ?? body.login);
    const senha = normalizeSenha(body.senha ?? body.password ?? body.pwd);
    if (!usuario || !senha) {
      return NextResponse.json(
        { error: 'ra (RA/RM) e senha são obrigatórios.' },
        { status: 400, headers: NO_STORE }
      );
    }

    const rawUserId = typeof body.userId === 'string' ? body.userId.trim() : null;
    const fallbackId = rawUserId && rawUserId.length <= MAX_USER_ID_LEN ? rawUserId : null;
    const caller = await resolveUserId(request, fallbackId);
    if (caller.status) {
      return NextResponse.json({ error: caller.error }, { status: caller.status, headers: NO_STORE });
    }

    const ip = clientIp(request);
    const limit = checkCefsaRateLimit(ip, usuario);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: 'Muitas tentativas de verificação. Aguarde antes de tentar novamente.',
          retry_after: limit.retryAfterSec,
          source: 'rate_limit',
        },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const result = await verifyCefsaCredentials(usuario, senha);
    recordCefsaAttempt(ip, usuario, result.ok);

    if (!result.ok) {
      if (result.reason === 'invalid_credentials' || result.reason === 'account_inactive') {
        return NextResponse.json(
          {
            valid: false,
            reason: result.reason,
            hint: result.reason === 'invalid_credentials' ? result.detail : undefined,
            source: 'cefsa',
          },
          { status: 200, headers: NO_STORE }
        );
      }
      console.warn('[VerifyCefsa] Moodle indisponível:', result.reason, result.detail);
      return NextResponse.json(
        { valid: false, reason: result.reason, source: 'cefsa' },
        { status: 503, headers: NO_STORE }
      );
    }

    const now = Date.now();
    const verification = {
      verifiedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CEFSA_VERIFY_TTL_MS).toISOString(),
    };
    const persisted = caller.userId
      ? await saveVerification({ userId: caller.userId, raRm: usuario, identity: result.identity })
      : false;

    return NextResponse.json(
      {
        valid: true,
        student: {
          username: result.identity.username,
          fullName: result.identity.fullName,
          email: result.identity.email,
          moodleUserId: result.identity.moodleUserId,
          raRm: usuario,
        },
        verification,
        persisted,
        source: persisted ? 'supabase' : isSupabaseConfigured() ? 'missing_user_id' : 'supabase_unavailable',
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    console.error('[VerifyCefsa] POST error:', error);
    return NextResponse.json(
      { error: 'Falha ao verificar credenciais no CEFSA.' },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** Gate do painel admin: existe verificação vigente para este usuário? */
export async function GET(request: NextRequest) {
  try {
    const rawUserId = request.nextUrl.searchParams.get('userId');
    const fallbackId = rawUserId && rawUserId.length <= MAX_USER_ID_LEN ? rawUserId : null;
    const caller = await resolveUserId(request, fallbackId);
    if (caller.status) {
      return NextResponse.json({ error: caller.error }, { status: caller.status, headers: NO_STORE });
    }
    if (!caller.userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: NO_STORE }
      );
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { verified: false, verification: null, source: 'supabase_unavailable' },
        { status: 200, headers: NO_STORE }
      );
    }

    const verification = await getVerification(caller.userId);
    return NextResponse.json(
      {
        verified: isVerificationFresh(verification),
        verification,
        source: 'supabase',
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    console.error('[VerifyCefsa] GET error:', error);
    return NextResponse.json({ error: 'Falha ao consultar verificação.' }, { status: 500, headers: NO_STORE });
  }
}
