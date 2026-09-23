import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  QuestionDificuldade,
  QuestionOrigem,
  StatusGeral,
  TutorErrorAttempt,
  TutorErrorsResponse,
  TutorQuestion,
} from '@/lib/tutor/types';

export const dynamic = 'force-dynamic';

function mapAttemptRow(row: Record<string, unknown>): TutorErrorAttempt {
  return {
    id: String(row.id),
    questionId: row.question_id ? String(row.question_id) : null,
    assunto: row.assunto ? String(row.assunto) : null,
    subassunto: row.subassunto ? String(row.subassunto) : null,
    topic: row.topic ? String(row.topic) : null,
    answerText: String(row.answer_text || ''),
    statusGeral: (row.status_geral as StatusGeral) || 'revisar',
    dificuldade: row.dificuldade ? (row.dificuldade as QuestionDificuldade) : null,
    createdAt: String(row.created_at || ''),
  };
}

function mapQuestionRow(row: Record<string, unknown>): TutorQuestion {
  return {
    id: String(row.id),
    enunciado: String(row.enunciado || ''),
    alternativas: (row.alternativas as Record<string, string> | null) ?? null,
    gabarito: row.gabarito ? String(row.gabarito) : null,
    explicacao: row.explicacao ? String(row.explicacao) : null,
    assunto: String(row.assunto || 'agronomia'),
    subassunto: row.subassunto ? String(row.subassunto) : null,
    disciplina: row.disciplina ? String(row.disciplina) : null,
    instituicao: row.instituicao ? String(row.instituicao) : null,
    ano: typeof row.ano === 'number' ? row.ano : null,
    tipo_prova: row.tipo_prova ? String(row.tipo_prova) : null,
    fonte: row.fonte ? String(row.fonte) : null,
    fonte_url: row.fonte_url ? String(row.fonte_url) : null,
    origem: ((row.origem as QuestionOrigem) || 'gerada') as QuestionOrigem,
    dificuldade: ((row.dificuldade as QuestionDificuldade) || 'basica') as QuestionDificuldade,
  };
}

/**
 * Fila de erros: tentativas com status_geral='revisar' (e não resolvidas).
 * Resolve question_id → questions; sem link, usa topic para busca por embedding.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = Math.min(Number(searchParams.get('limit') || 8), 20);

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      attempts: [],
      questions: [],
      source: 'supabase_unavailable',
    } satisfies TutorErrorsResponse);
  }

  try {
    const { data, error } = await supabase!
      .from('tutor_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('status_geral', 'revisar')
      .or('resolved.is.null,resolved.eq.false')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[TutorErrors] GET error:', error);
      return NextResponse.json({
        ok: false,
        attempts: [],
        questions: [],
        source: 'error',
        message: error.message,
      } satisfies TutorErrorsResponse);
    }

    const attempts = (data || []).map(mapAttemptRow);
    if (attempts.length === 0) {
      return NextResponse.json({
        ok: true,
        attempts: [],
        questions: [],
        source: 'empty',
      } satisfies TutorErrorsResponse);
    }

    const questionIds = attempts
      .map((a) => a.questionId)
      .filter((id): id is string => !!id);

    let questions: TutorQuestion[] = [];
    if (questionIds.length > 0) {
      const { data: qRows, error: qError } = await supabase!
        .from('questions')
        .select('*')
        .in('id', questionIds);
      if (!qError && qRows) {
        questions = qRows.map((r) => mapQuestionRow(r as Record<string, unknown>));
      }
    }

    // Tentativas órfãs (sem question_id): busca por tópico
    const orphanTopics = attempts
      .filter((a) => !a.questionId && a.topic)
      .map((a) => a.topic!)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 3);

    for (const topic of orphanTopics) {
      if (questions.length >= limit) break;
      const { data: byTopic, error: topicError } = await supabase!.rpc(
        'search_questions_by_topic',
        { search_topic: topic, match_count: 3 }
      );
      if (!topicError && byTopic) {
        const mapped = (byTopic as Record<string, unknown>[]).map(mapQuestionRow);
        for (const q of mapped) {
          if (!questions.some((existing) => existing.id === q.id)) {
            questions.push(q);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      attempts,
      questions: questions.slice(0, limit),
      source: 'supabase',
    } satisfies TutorErrorsResponse);
  } catch (error) {
    console.error('[TutorErrors] GET exception:', error);
    const message = error instanceof Error ? error.message : 'Falha ao carregar fila de erros.';
    return NextResponse.json({
      ok: false,
      attempts: [],
      questions: [],
      source: 'error',
      message,
    } satisfies TutorErrorsResponse);
  }
}
