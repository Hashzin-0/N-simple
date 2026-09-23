import { NextRequest } from 'next/server';
import { evaluateAnswer } from '@/lib/tutor/evaluate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface EvaluateRequestBody {
  enunciado: string;
  respostaAluno: string;
  gabarito?: string | null;
  explicacao?: string | null;
  contextoFontes?: string;
  dificuldade?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluateRequestBody;
    const enunciado = (body.enunciado || '').trim();
    const respostaAluno = (body.respostaAluno || '').trim();

    if (!enunciado || !respostaAluno) {
      return Response.json(
        { error: 'Os parâmetros enunciado e respostaAluno são obrigatórios.' },
        { status: 400 }
      );
    }

    const avaliacao = await evaluateAnswer({
      enunciado,
      respostaAluno,
      gabarito: body.gabarito ?? null,
      explicacao: body.explicacao ?? null,
      contextoFontes: body.contextoFontes,
      dificuldade: body.dificuldade,
    });

    return Response.json({ avaliacao });
  } catch (error: unknown) {
    console.error('[TutorEvaluate] Error:', error);
    const message = error instanceof Error ? error.message : 'Falha ao avaliar a resposta.';
    return Response.json({ error: message }, { status: 500 });
  }
}
