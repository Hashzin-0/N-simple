import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  NOISE_GATE_MODES,
  MAX_DISTANCIA_CM,
  MIN_DISTANCIA_CM,
  type NoiseGateMode,
} from '@/lib/noiseGate';

export const dynamic = 'force-dynamic';

/**
 * Preferências do usuário na nuvem (uma linha por user_id).
 * Hoje: apenas `voice` (supressor de ruído do agente de voz).
 *
 * GET  /api/user/settings?userId=...        → { settings | null, source }
 * POST /api/user/settings { userId, voice }  → { saved, source }
 *
 * Sempre responde 200 (padrão do repo): o client trata `source`
 * ('error' / 'supabase_unavailable') e mantém o valor local.
 */

export interface VoiceSettingsPayload {
  modo: NoiseGateMode;
  distancia_cm: number;
  updatedAt: number;
}

function sanitizeVoice(raw: unknown): VoiceSettingsPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const modo = String(rec.modo ?? '') as NoiseGateMode;
  if (!NOISE_GATE_MODES.includes(modo)) return null;
  const distancia = Number(rec.distancia_cm);
  const updatedAt = Number(rec.updatedAt);
  return {
    modo,
    distancia_cm: Number.isFinite(distancia)
      ? Math.min(MAX_DISTANCIA_CM, Math.max(MIN_DISTANCIA_CM, Math.round(distancia)))
      : 30,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ settings: null, source: 'supabase_unavailable' });
  }

  try {
    const { data, error } = await supabase!
      .from('user_settings')
      .select('voice, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[UserSettings] GET error:', error);
      return NextResponse.json({ settings: null, source: 'error' });
    }

    const voice = sanitizeVoice(data?.voice);
    if (!voice) {
      return NextResponse.json({ settings: null, source: 'supabase' });
    }
    // updatedAt da linha serve de desempate local × nuvem no client.
    const rowAt = Date.parse(String(data?.updated_at ?? ''));
    if (Number.isFinite(rowAt) && rowAt > voice.updatedAt) {
      voice.updatedAt = rowAt;
    }
    return NextResponse.json({ settings: voice, source: 'supabase' });
  } catch (error) {
    console.error('[UserSettings] GET exception:', error);
    return NextResponse.json({ settings: null, source: 'error' });
  }
}

export async function POST(request: NextRequest) {
  let body: { userId?: unknown; voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const voice = sanitizeVoice(body.voice);
  if (!voice) {
    return NextResponse.json({ error: 'voice inválido' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ saved: false, source: 'supabase_unavailable' });
  }

  try {
    const { error } = await supabase!.from('user_settings').upsert(
      {
        user_id: userId,
        voice: voice as unknown,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('[UserSettings] POST error:', error);
      return NextResponse.json({ saved: false, source: 'error' });
    }

    return NextResponse.json({ saved: true, source: 'supabase' });
  } catch (error) {
    console.error('[UserSettings] POST exception:', error);
    return NextResponse.json({ saved: false, source: 'error' });
  }
}
