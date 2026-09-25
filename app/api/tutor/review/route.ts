import { NextRequest } from 'next/server';
import {
  generateReview,
  listReviewArtifacts,
  type ReviewKind,
  type Dificuldade,
} from '@/lib/tutor/review';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KINDS: ReviewKind[] = [
  'simulado',
  'quiz',
  'mapa_mental',
  'seminario',
  'resumo',
  'plano',
  'flashcards',
];

const DIFICULDADES: Dificuldade[] = ['facil', 'media', 'dificil'];

interface ReviewRequestBody {
  kind?: string;
  tema?: string;
  subtema?: string;
  quantidade?: number;
  dificuldade?: string;
  documentIds?: string[];
  userId?: string | null;
}

/** GET /api/tutor/review?kind=&userId= — lista artefatos salvos */
export async function GET(req: NextRequest) {
  try {
    const kind = req.nextUrl.searchParams.get('kind') as ReviewKind | null;
    const userId = req.nextUrl.searchParams.get('userId');
    const artifacts = await listReviewArtifacts(
      kind && KINDS.includes(kind) ? kind : undefined,
      userId || null
    );
    return Response.json({ artifacts });
  } catch (error: unknown) {
    console.error('[TutorReview] GET error:', error);
    return Response.json({ error: 'Falha ao listar artefatos.' }, { status: 500 });
  }
}

/**
 * POST /api/tutor/review
 * Gera um artefato de revisão (simulado, quiz, mapa mental, seminário, resumo,
 * plano ou flashcards) com base nos documentos enviados (fonte primária) ou no tema.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReviewRequestBody;
    const kind = (body.kind || '').trim() as ReviewKind;
    const tema = (body.tema || '').trim();

    if (!KINDS.includes(kind)) {
      return Response.json(
        { error: `Tipo inválido. Use: ${KINDS.join(', ')}.` },
        { status: 400 }
      );
    }
    if (!tema) {
      return Response.json({ error: 'O parâmetro tema é obrigatório.' }, { status: 400 });
    }

    const result = await generateReview({
      kind,
      tema,
      subtema: body.subtema?.trim() || undefined,
      quantidade: Number.isFinite(body.quantidade) ? Number(body.quantidade) : undefined,
      dificuldade: DIFICULDADES.includes(body.dificuldade as Dificuldade)
        ? (body.dificuldade as Dificuldade)
        : undefined,
      documentIds: Array.isArray(body.documentIds) ? body.documentIds : undefined,
      userId: body.userId ?? null,
    });

    return Response.json({ result });
  } catch (error: unknown) {
    console.error('[TutorReview] POST error:', error);
    const message = error instanceof Error ? error.message : 'Falha ao gerar a revisão.';
    return Response.json({ error: message }, { status: 502 });
  }
}
