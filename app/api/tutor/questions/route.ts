import { NextRequest } from 'next/server';
import { searchQuestions } from '@/lib/tutor/questionBank';
import type { QuestionDificuldade } from '@/lib/tutor/types';

export const dynamic = 'force-dynamic';

interface QuestionsBody {
  query?: string;
  assunto?: string;
  dificuldade?: QuestionDificuldade;
  excludeIds?: string[];
  limit?: number;
  threshold?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QuestionsBody;
    const query = (body.query || body.assunto || '').trim();

    if (!query) {
      return Response.json(
        { error: 'O parâmetro query (ou assunto) é obrigatório.' },
        { status: 400 }
      );
    }

    const questions = await searchQuestions({
      query,
      assunto: body.assunto,
      dificuldade: body.dificuldade,
      excludeIds: body.excludeIds,
      limit: Math.min(body.limit ?? 8, 20),
      threshold: body.threshold,
    });

    return Response.json({ questions });
  } catch (error: unknown) {
    console.error('[TutorQuestions] Error:', error);
    const message = error instanceof Error ? error.message : 'Falha ao buscar questões.';
    return Response.json({ error: message }, { status: 500 });
  }
}
