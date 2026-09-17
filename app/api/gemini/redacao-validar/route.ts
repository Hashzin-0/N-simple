import { NextRequest } from 'next/server';
import { validateRedacao } from '@/lib/redacao/validateRedacao';
import type { ValidacaoResult } from '@/components/PesquisadorRedacao/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { redacao, tema, fontes, topics } = await req.json();

    if (!redacao || !tema) {
      return Response.json(
        { error: 'Os parâmetros redacao e tema são obrigatórios.' },
        { status: 400 }
      );
    }

    const validacao: ValidacaoResult = await validateRedacao(
      redacao,
      tema,
      fontes || [],
      topics || [],
    );

    return Response.json({ validacao });
  } catch (error: unknown) {
    console.error('Error in redacao-validar route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Falha ao validar redação.';
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
