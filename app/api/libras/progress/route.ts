import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ProgressEntry {
  word_id: string;
  learned: boolean;
  quiz_score: number;
  module_id: string;
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
      .from('libras_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[LibrasProgress] GET error:', error);
      return NextResponse.json({ entries: [], source: 'error' });
    }

    return NextResponse.json({ entries: data || [], source: 'supabase' });
  } catch (error) {
    console.error('[LibrasProgress] GET exception:', error);
    return NextResponse.json({ entries: [], source: 'error' });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, entries } = body as { userId: string; entries: ProgressEntry[] };

  if (!userId || !entries || !Array.isArray(entries)) {
    return NextResponse.json(
      { error: 'userId and entries array are required' },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ saved: false, source: 'supabase_unavailable' });
  }

  try {
    const wordIds = entries.map((e) => e.word_id).filter(Boolean);
    const { data: existingRows, error: selectError } = await supabase!
      .from('libras_progress')
      .select('word_id, learned, quiz_score, module_id')
      .eq('user_id', userId)
      .in('word_id', wordIds);

    if (selectError) {
      console.error('[LibrasProgress] POST select error:', selectError);
    }

    const existingByWord = new Map(
      (existingRows || []).map((row) => [row.word_id as string, row])
    );

    // Nunca rebaixa: learned = OR, quiz_score = max(novo, existente).
    const upserts = entries.map((entry) => {
      const prev = existingByWord.get(entry.word_id);
      return {
        user_id: userId,
        word_id: entry.word_id,
        learned: Boolean(entry.learned) || Boolean(prev?.learned),
        quiz_score: Math.max(
          Number(entry.quiz_score) || 0,
          Number(prev?.quiz_score) || 0
        ),
        module_id: entry.module_id || prev?.module_id || null,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase!
      .from('libras_progress')
      .upsert(upserts, { onConflict: 'user_id,word_id' });

    if (error) {
      console.error('[LibrasProgress] POST error:', error);
      return NextResponse.json({ saved: false, source: 'error' });
    }

    return NextResponse.json({ saved: true, source: 'supabase' });
  } catch (error) {
    console.error('[LibrasProgress] POST exception:', error);
    return NextResponse.json({ saved: false, source: 'error' });
  }
}
