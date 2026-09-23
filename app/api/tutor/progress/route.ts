import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AvaliacaoResultado, TutorAttemptPayload, TutorProgressEntry } from '@/lib/tutor/types';

export const dynamic = 'force-dynamic';

const MASTERY_ALPHA = 0.35;

function statusToScore(status: string): number {
  if (status === 'dominou') return 1;
  if (status === 'parcial') return 0.55;
  return 0.15;
}

function upsertInArray(list: string[], item: string, max = 6): string[] {
  const clean = (item || '').trim();
  if (!clean) return list;
  const without = list.filter((x) => x.toLowerCase() !== clean.toLowerCase());
  return [clean, ...without].slice(0, max);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [], source: 'supabase_unavailable' });
  }

  try {
    const { data, error } = await supabase!
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .order('last_review', { ascending: false });

    if (error) {
      console.error('[TutorProgress] GET error:', error);
      return NextResponse.json({ entries: [], source: 'error' });
    }

    const entries: TutorProgressEntry[] = (data || []).map((row) => ({
      topic: row.topic,
      attempts: row.attempts || 0,
      strengths: row.strengths || [],
      weaknesses: row.weaknesses || [],
      masteryEstimate: typeof row.mastery_estimate === 'number' ? row.mastery_estimate : 0,
      lastReview: row.last_review || row.updated_at,
    }));

    return NextResponse.json({ entries, source: 'supabase' });
  } catch (error) {
    console.error('[TutorProgress] GET exception:', error);
    return NextResponse.json({ entries: [], source: 'error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, attempt } = body as { userId: string; attempt: TutorAttemptPayload };

    if (!userId || !attempt?.answerText || !attempt?.evaluation || !attempt?.topic) {
      return NextResponse.json(
        { error: 'userId, attempt.topic, attempt.answerText e attempt.evaluation são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ saved: false, source: 'supabase_unavailable' });
    }

    const evaluation = attempt.evaluation as AvaliacaoResultado;
    const now = new Date().toISOString();

    // 1. Registra a tentativa individual
    const { error: attemptError } = await supabase!.from('tutor_attempts').insert({
      user_id: userId,
      question_id: attempt.questionId ?? null,
      assunto: attempt.assunto ?? null,
      subassunto: attempt.subassunto ?? null,
      topic: attempt.topic,
      answer_text: attempt.answerText,
      evaluation: evaluation as unknown as Record<string, unknown>,
      status_geral: evaluation.statusGeral,
      dificuldade: attempt.dificuldade ?? null,
    });

    if (attemptError) {
      console.error('[TutorProgress] attempt insert error:', attemptError);
      return NextResponse.json({ saved: false, source: 'error' }, { status: 500 });
    }

    // 2. Atualiza progresso agregado por tópico (upsert + mastery exponencial)
    const { data: existing } = await supabase!
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', attempt.topic)
      .maybeSingle();

    const prevAttempts = existing?.attempts || 0;
    const prevMastery = typeof existing?.mastery_estimate === 'number' ? existing.mastery_estimate : 0;
    const score = statusToScore(evaluation.statusGeral);
    const nextMastery =
      prevAttempts === 0
        ? score
        : prevMastery * (1 - MASTERY_ALPHA) + score * MASTERY_ALPHA;

    let strengths = (existing?.strengths as string[]) || [];
    let weaknesses = (existing?.weaknesses as string[]) || [];

    for (const c of evaluation.conceitosCorretos || []) {
      strengths = upsertInArray(strengths, c);
      weaknesses = weaknesses.filter((w) => w.toLowerCase() !== c.toLowerCase());
    }
    for (const c of evaluation.omissoes || []) {
      weaknesses = upsertInArray(weaknesses, c);
    }
    for (const c of evaluation.errosConceituais || []) {
      weaknesses = upsertInArray(weaknesses, c);
    }

    const { error: progressError } = await supabase!.from('user_progress').upsert(
      {
        user_id: userId,
        topic: attempt.topic,
        attempts: prevAttempts + 1,
        strengths,
        weaknesses,
        mastery_estimate: Math.round(nextMastery * 1000) / 1000,
        last_review: now,
        updated_at: now,
      },
      { onConflict: 'user_id,topic' }
    );

    if (progressError) {
      console.error('[TutorProgress] progress upsert error:', progressError);
      return NextResponse.json({ saved: false, source: 'error' }, { status: 500 });
    }

    return NextResponse.json({
      saved: true,
      source: 'supabase',
      masteryEstimate: Math.round(nextMastery * 1000) / 1000,
      attempts: prevAttempts + 1,
    });
  } catch (error) {
    console.error('[TutorProgress] POST exception:', error);
    return NextResponse.json({ saved: false, source: 'error' }, { status: 500 });
  }
}
