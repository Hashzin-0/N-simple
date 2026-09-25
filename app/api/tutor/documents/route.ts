import { NextRequest } from 'next/server';
import {
  MAX_UPLOAD_BYTES,
  MAX_PAGES,
  deleteDocument,
  extractDocumentText,
  generateDocumentDigest,
  isAcceptedFile,
  listDocuments,
  saveDocument,
  uploadToGeminiFiles,
} from '@/lib/tutor/documents';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET /api/tutor/documents?userId=... — lista documentos enviados */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || null;
    const documents = await listDocuments(userId);
    return Response.json({ documents });
  } catch (error: unknown) {
    console.error('[TutorDocuments] GET Error:', error);
    return Response.json({ error: 'Falha ao listar documentos.' }, { status: 500 });
  }
}

/** DELETE /api/tutor/documents?id=... — remove documento (Gemini Files + Supabase) */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'Parâmetro id é obrigatório.' }, { status: 400 });
    }
    const ok = await deleteDocument(id);
    if (!ok) {
      return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error: unknown) {
    console.error('[TutorDocuments] DELETE Error:', error);
    return Response.json({ error: 'Falha ao remover documento.' }, { status: 500 });
  }
}

/**
 * POST /api/tutor/documents (multipart/form-data: file, userId?)
 * Sobe na Gemini Files API + extrai texto localmente + gera digest + persiste chunks.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const userId = typeof formData.get('userId') === 'string'
      ? ((formData.get('userId') as string) || null)
      : null;

    if (!(file instanceof File)) {
      return Response.json({ error: 'Arquivo é obrigatório.' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: 'Arquivo maior que 20MB. Envie um arquivo menor.' },
        { status: 413 }
      );
    }
    const mime = file.type || 'application/pdf';
    if (!isAcceptedFile(file.name, mime)) {
      return Response.json(
        { error: 'Formato não suportado. Use PDF, TXT, MD ou CSV.' },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, pages } = await extractDocumentText(mime, buffer);

    if (pages !== null && pages > MAX_PAGES) {
      return Response.json(
        { error: `PDF com ${pages} páginas excede o limite de ${MAX_PAGES}.` },
        { status: 413 }
      );
    }
    if (!text || text.trim().length < 40) {
      return Response.json(
        { error: 'Não consegui extrair texto deste arquivo (pode ser um PDF escaneado).' },
        { status: 422 }
      );
    }

    // 1) Files API (referência multimodal, expira em 48h — temos o texto como fonte persistente)
    const geminiFile = await uploadToGeminiFiles(buffer, mime, file.name);

    // 2) Digest (resumo/outline) — base do contexto de voz e das features de revisão
    const digest = await generateDocumentDigest(file.name, text);

    // 3) Persistência (documento + chunks com embedding)
    const saved = await saveDocument({
      userId,
      name: file.name,
      mimeType: mime,
      sizeBytes: file.size,
      pages,
      text,
      fileUri: geminiFile?.uri ?? null,
      fileName: geminiFile?.name ?? null,
      digest,
    });

    if (!saved) {
      return Response.json(
        {
          error:
            'Supabase não configurado ou falha ao salvar. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.',
        },
        { status: 503 }
      );
    }

    return Response.json({ document: saved, uploadedToFilesApi: Boolean(geminiFile) });
  } catch (error: unknown) {
    console.error('[TutorDocuments] POST Error:', error);
    const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo.';
    return Response.json({ error: message }, { status: 500 });
  }
}
