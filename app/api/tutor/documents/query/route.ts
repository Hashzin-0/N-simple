import { NextRequest } from 'next/server';
import { getDocumentsContext, queryDocuments } from '@/lib/tutor/documents';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface QueryBody {
  docIds?: string[];
  query?: string;
  limit?: number;
}

/**
 * POST /api/tutor/documents/query
 * Busca semântica no material enviado — usada pela tool de voz "lerDocumento"
 * e pelo roteador de features quando precisa de trechos exatos.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QueryBody;
    const query = (body.query || '').trim();
    const docIds = Array.isArray(body.docIds) ? body.docIds.filter(Boolean) : [];
    const limit = Math.min(Math.max(body.limit ?? 6, 1), 12);

    if (!query) {
      return Response.json({ error: 'Parâmetro query é obrigatório.' }, { status: 400 });
    }

    const chunks = await queryDocuments(docIds, query, limit);
    return Response.json({ chunks });
  } catch (error: unknown) {
    console.error('[TutorDocumentsQuery] Error:', error);
    return Response.json({ error: 'Falha ao consultar documentos.' }, { status: 500 });
  }
}

/** GET /api/tutor/documents/context?userId= — digest compacto para prompts/voz */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || null;
    const { context, documents } = await getDocumentsContext(userId);
    return Response.json({
      context,
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        pages: d.pages,
        status: d.status,
        topicos: d.digest?.topicos ?? [],
      })),
    });
  } catch (error: unknown) {
    console.error('[TutorDocumentsContext] Error:', error);
    return Response.json({ error: 'Falha ao montar contexto.' }, { status: 500 });
  }
}
