import { GoogleGenAI } from '@google/genai';
import PDFParser from 'pdf2json';
import { generateWithFallback } from '@/lib/llm-providers';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { embedText, embedTexts } from '@/lib/semantic/embeddings';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_PAGES = 200;
export const MAX_TEXT_CHARS = 400_000;

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.csv'];

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS = 400;
const EMBED_BATCH = 40;

export interface TutorDocumentDigest {
  resumo: string;
  topicos: string[];
  conceitosChave: string[];
  outline: string[];
}

export interface TutorDocumentRecord {
  id: string;
  user_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  pages: number | null;
  char_count: number;
  file_uri: string | null;
  digest: TutorDocumentDigest | null;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
}

export function isAcceptedFile(name: string, mime: string): boolean {
  if (ACCEPTED_MIME.has(mime)) return true;
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getAI(): GoogleGenAI | null {
  const keysEnv = process.env.GEMINI_API_KEYS;
  const single = process.env.GEMINI_API_KEY;
  const key = keysEnv?.split(',').map((k) => k.trim()).find((k) => k.length > 0) || single;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

/** Envia o arquivo para a Gemini Files API e aguarda STATE_ACTIVE (expira em 48h). */
export async function uploadToGeminiFiles(
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<{ name: string; uri: string } | null> {
  const ai = getAI();
  if (!ai) return null;

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const file = await ai.files.upload({
      file: blob,
      config: { mimeType, displayName: displayName.slice(0, 500) },
    });

    if (!file.name) return null;

    const deadline = Date.now() + 30_000;
    let current = file;
    while (current.state !== 'ACTIVE' && current.state !== 'FAILED') {
      if (Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 1000));
      current = await ai.files.get({ name: file.name });
    }

    if (current.state === 'FAILED') {
      console.warn('[TutorDocs] Files API processamento falhou:', current.error);
      return null;
    }

    const uri = current.uri || `https://generativelanguage.googleapis.com/v1beta/${file.name}`;
    return { name: file.name, uri };
  } catch (err) {
    console.warn('[TutorDocs] Upload Files API falhou (seguindo só com texto):', err);
    return null;
  }
}

export async function deleteGeminiFile(fileName: string): Promise<void> {
  const ai = getAI();
  if (!ai) return;
  try {
    await ai.files.delete({ name: fileName });
  } catch (err) {
    console.warn('[TutorDocs] Falha ao deletar arquivo do Gemini:', err);
  }
}

/** Extrai texto de PDF via pdf2json (mesmo padrão de lib/userDocuments.ts). */
export function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParser(undefined, true);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ text: '', pages: 0 }), 30_000);
    parser.on('pdfParser_dataError', () => {
      clearTimeout(timeout);
      resolve({ text: '', pages: 0 });
    });
    parser.on('pdfParser_dataReady', (pdfData: { Pages?: unknown[] }) => {
      clearTimeout(timeout);
      try {
        const text = (parser as unknown as { getRawTextContent(): string }).getRawTextContent();
        const pages = Array.isArray(pdfData?.Pages) ? pdfData.Pages.length : 0;
        resolve({ text: text || '', pages });
      } catch {
        resolve({ text: '', pages: 0 });
      }
    });
    try {
      parser.parseBuffer(buffer);
    } catch {
      clearTimeout(timeout);
      resolve({ text: '', pages: 0 });
    }
  });
}

export async function extractDocumentText(
  mime: string,
  buffer: Buffer
): Promise<{ text: string; pages: number | null }> {
  let text = '';
  let pages: number | null = null;
  if (mime === 'application/pdf') {
    const pdf = await extractPdfText(buffer);
    text = pdf.text;
    pages = pdf.pages;
    if (pages && pages > MAX_PAGES) {
      return { text: '', pages };
    }
  } else if (mime.startsWith('text/')) {
    text = buffer.toString('utf8');
  }
  // limpa artefatos do pdf2json (marcas ***EOF etc.)
  text = text.replace(/\*\*\*.*?EOF/g, '').replace(/[ \t]+/g, ' ').trim();
  return { text: text.slice(0, MAX_TEXT_CHARS), pages };
}

export function chunkText(text: string): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP;
  for (let start = 0; start < text.length && chunks.length < MAX_CHUNKS; start += step) {
    const piece = text.slice(start, start + CHUNK_SIZE).trim();
    if (piece.length > 40) chunks.push(piece);
    if (start + CHUNK_SIZE >= text.length) break;
  }
  return chunks;
}

/** Gera digest (resumo + outline + conceitos) do documento — alimenta o contexto de voz e as features. */
export async function generateDocumentDigest(
  name: string,
  text: string
): Promise<TutorDocumentDigest | null> {
  if (!text || text.trim().length < 80) return null;

  const sample = text.slice(0, 60_000);
  const prompt = [
    'Você é um assistente de estudos. Leia o material abaixo e gere um digest em JSON válido, sem markdown, sem comentários.',
    `Nome do arquivo: ${name}`,
    '',
    'Formato exato:',
    '{"resumo":"resumo objetivo em até 12 frases sobre o material","topicos":["tema1","tema2"],"conceitosChave":["conceito1","conceito2"],"outline":["seção 1","seção 2","seção 3"]}',
    '',
    'Regras: 5 a 12 tópicos, 6 a 20 conceitos-chave, outline com 4 a 12 blocos na ordem do documento, tudo em português (pt-BR).',
    '',
    '=== MATERIAL ===',
    sample,
  ].join('\n');

  try {
    const result = await generateWithFallback({ prompt });
    let fullText = '';
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += value.text;
    }
    const match = fullText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<TutorDocumentDigest>;
    return {
      resumo: String(parsed.resumo || '').trim(),
      topicos: Array.isArray(parsed.topicos) ? parsed.topicos.map(String).slice(0, 12) : [],
      conceitosChave: Array.isArray(parsed.conceitosChave)
        ? parsed.conceitosChave.map(String).slice(0, 20)
        : [],
      outline: Array.isArray(parsed.outline) ? parsed.outline.map(String).slice(0, 12) : [],
    };
  } catch (err) {
    console.warn('[TutorDocs] Digest falhou:', err);
    return null;
  }
}

interface SaveDocumentArgs {
  userId?: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number;
  pages: number | null;
  text: string;
  fileUri: string | null;
  fileName: string | null;
  digest: TutorDocumentDigest | null;
}

export async function saveDocument(args: SaveDocumentArgs): Promise<TutorDocumentRecord | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: row, error } = await supabase!
      .from('tutor_documents')
      .insert({
        user_id: args.userId ?? null,
        name: args.name,
        mime_type: args.mimeType,
        size_bytes: args.sizeBytes,
        pages: args.pages,
        char_count: args.text.length,
        file_uri: args.fileUri,
        file_name: args.fileName,
        digest: args.digest,
        status: 'ready',
      })
      .select('*')
      .single();

    if (error || !row) {
      console.warn('[TutorDocs] Falha ao salvar documento:', error);
      return null;
    }

    const chunks = chunkText(args.text);
    if (chunks.length > 0) {
      try {
        const embeddings = await embedTexts(chunks);
        const rows = chunks.map((c, i) => ({
          document_id: row.id,
          chunk_index: i,
          text: c,
          embedding: embeddings[i] && embeddings[i].length > 0 ? embeddings[i] : null,
        }));
        // insere em lotes para não estourar payload
        for (let i = 0; i < rows.length; i += 50) {
          const { error: chunkError } = await supabase!
            .from('tutor_document_chunks')
            .insert(rows.slice(i, i + 50));
          if (chunkError) console.warn('[TutorDocs] Falha ao salvar chunks:', chunkError);
        }
      } catch (err) {
        console.warn('[TutorDocs] Embeddings de chunks falharam:', err);
      }
    }

    return row as TutorDocumentRecord;
  } catch (err) {
    console.warn('[TutorDocs] saveDocument falhou:', err);
    return null;
  }
}

export async function listDocuments(userId?: string | null): Promise<TutorDocumentRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    let query = supabase!
      .from('tutor_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as TutorDocumentRecord[];
  } catch {
    return [];
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data: row } = await supabase!
      .from('tutor_documents')
      .select('file_name')
      .eq('id', id)
      .maybeSingle();
    const { error } = await supabase!.from('tutor_documents').delete().eq('id', id);
    if (!error && row?.file_name) void deleteGeminiFile(row.file_name);
    return !error;
  } catch {
    return false;
  }
}

/** Busca semântica nos documentos (RPC pgvector) — usada pela tool de voz "lerDocumento". */
export async function queryDocuments(
  docIds: string[],
  query: string,
  limit = 6
): Promise<Array<{ document_id: string; text: string; similarity: number }>> {
  if (!isSupabaseConfigured() || !query.trim()) return [];
  try {
    const embedding = await embedText(query, 'RETRIEVAL_QUERY');
    const { data, error } = await supabase!.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: limit,
      document_ids: docIds.length > 0 ? docIds : null,
    });
    if (error || !data) return [];
    return data as Array<{ document_id: string; text: string; similarity: number }>;
  } catch (err) {
    console.warn('[TutorDocs] queryDocuments falhou:', err);
    return [];
  }
}

/** Contexto compacto (nome + resumo + tópicos) para injetar em prompts e no system instruction da sessão de voz. */
export async function getDocumentsContext(userId?: string | null): Promise<{
  context: string;
  documents: TutorDocumentRecord[];
}> {
  const documents = (await listDocuments(userId)).filter((d) => d.status === 'ready');
  if (documents.length === 0) return { context: '', documents: [] };

  const lines = documents.map((d) => {
    const digest = d.digest;
    const partes = [
      `- Arquivo "${d.name}"${d.pages ? ` (${d.pages} páginas)` : ''}: ${digest?.resumo || '(sem resumo)'}`,
      digest?.topicos?.length ? `  Tópicos: ${digest.topicos.join(', ')}` : '',
      digest?.conceitosChave?.length
        ? `  Conceitos-chave: ${digest.conceitosChave.slice(0, 10).join(', ')}`
        : '',
    ].filter(Boolean);
    return partes.join('\n');
  });

  return {
    context: ['=== MATERIAL DO ALUNO (documentos enviados) ===', ...lines].join('\n'),
    documents,
  };
}
