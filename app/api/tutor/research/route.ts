import { NextRequest } from 'next/server';
import { researchQuestions } from '@/lib/tutor/researchQuestions';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ResearchBody {
  tema?: string;
  subtema?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResearchBody;
    const tema = (body.tema || '').trim();
    const subtema = body.subtema?.trim() || undefined;

    if (!tema) {
      return Response.json(
        { error: 'O parâmetro tema é obrigatório.' },
        { status: 400 }
      );
    }

    const result = await researchQuestions(tema, subtema);
    return Response.json(result);
  } catch (error: unknown) {
    console.error('[TutorResearch] Error:', error);
    const message = error instanceof Error ? error.message : 'Falha ao pesquisar questões.';
    return Response.json({ error: message }, { status: 500 });
  }
}
