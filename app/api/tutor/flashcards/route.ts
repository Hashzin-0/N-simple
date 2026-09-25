import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface FlashcardRow {
  id: string;
  user_id: string;
  topic: string;
  document_id: string | null;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  reps: number;
  due_at: string;
  last_review: string | null;
  created_at: string;
}

/** GET /api/tutor/flashcards?userId=&topic=&due=1 — lista flashcards */
export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return Response.json({ cards: [], configured: false });
    }
    const userId = req.nextUrl.searchParams.get('userId');
    const topic = req.nextUrl.searchParams.get('topic');
    const dueOnly = req.nextUrl.searchParams.get('due') === '1';

    let query = supabase!
      .from('tutor_flashcards')
      .select('*')
      .order('due_at', { ascending: true })
      .limit(200);
    if (userId) query = query.eq('user_id', userId);
    if (topic) query = query.eq('topic', topic);
    if (dueOnly) query = query.lte('due_at', new Date().toISOString());

    const { data, error } = await query;
    if (error) {
      console.warn('[TutorFlashcards] GET error:', error.message);
      return Response.json({ cards: [], error: error.message });
    }
    return Response.json({ cards: (data ?? []) as FlashcardRow[] });
  } catch (error: unknown) {
    console.error('[TutorFlashcards] GET error:', error);
    return Response.json({ error: 'Falha ao listar flashcards.' }, { status: 500 });
  }
}

/**
 * POST /api/tutor/flashcards
 * action='review' → repetição espaçada (SM-2 simplificado):
 *   bom/facil: ease sobe, intervalo cresce (1 → 3 → intervalo × ease)
 *   ruim: ease desce (mín. 1.3), intervalo volta para 1 dia
 * action='delete' → remove o card.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: string;
      id?: string;
      quality?: string;
    };

    if (!isSupabaseConfigured()) {
      return Response.json({ error: 'Supabase não configurado.' }, { status: 503 });
    }
    if (!body.id) {
      return Response.json({ error: 'O parâmetro id é obrigatório.' }, { status: 400 });
    }

    if (body.action === 'delete') {
      const { error } = await supabase!.from('tutor_flashcards').delete().eq('id', body.id);
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    if (body.action !== 'review') {
      return Response.json({ error: 'Ação inválida. Use "review" ou "delete".' }, { status: 400 });
    }

    const quality = body.quality === 'facil' || body.quality === 'ruim' ? body.quality : 'bom';

    const { data: row, error: fetchError } = await supabase!
      .from('tutor_flashcards')
      .select('*')
      .eq('id', body.id)
      .maybeSingle();
    if (fetchError || !row) {
      return Response.json({ error: 'Flashcard não encontrado.' }, { status: 404 });
    }

    const card = row as FlashcardRow;
    let ease = card.ease || 2.5;
    let interval = card.interval_days || 0;
    let reps = card.reps || 0;

    if (quality === 'ruim') {
      ease = Math.max(1.3, ease - 0.2);
      interval = 1;
      reps = 0;
    } else {
      ease = Math.min(3.0, ease + (quality === 'facil' ? 0.1 : 0.05));
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 3;
      else interval = Math.max(1, Math.round(interval * ease));
      reps += 1;
    }

    const now = new Date();
    const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    const update = {
      ease,
      interval_days: interval,
      reps,
      due_at: due.toISOString(),
      last_review: now.toISOString(),
    };

    const { data: updated, error: updateError } = await supabase!
      .from('tutor_flashcards')
      .update(update)
      .eq('id', card.id)
      .select('*')
      .single();
    if (updateError || !updated) {
      return Response.json({ error: updateError?.message ?? 'Falha ao atualizar.' }, { status: 500 });
    }

    return Response.json({ card: updated as FlashcardRow });
  } catch (error: unknown) {
    console.error('[TutorFlashcards] POST error:', error);
    const message = error instanceof Error ? error.message : 'Falha ao atualizar flashcard.';
    return Response.json({ error: message }, { status: 500 });
  }
}
