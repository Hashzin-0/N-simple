import { countSemanticPending } from '@/lib/semantic/phase2';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/gemini/semantic-status — fila da fase 2 (understandOne em 2º plano).
 * Usado pelo card de fontes para o chip "classificando em 2º plano"
 * (polling simples enquanto a busca SSE já terminou).
 */
export async function GET() {
  try {
    const counts = await countSemanticPending();
    return Response.json(counts);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'erro ao contar pendências' },
      { status: 500 },
    );
  }
}
