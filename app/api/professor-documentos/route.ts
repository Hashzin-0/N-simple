import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
} from '@google/genai';
import { inspectOfficeDocument, type DocumentStructure } from '@/lib/professorDocumentos';
import { applyDocumentEdits, type DocumentEdit } from '@/lib/professorDocumentosEdits';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = process.env.PROFESSOR_GEMINI_MODEL || 'gemini-3.8-flash';
const CONVERTER_URL = process.env.DOCUMENT_CONVERTER_URL?.replace(/\/$/, '');

const SYSTEM_PROMPT = `Você é o Professor IA de Documentos Acadêmicos do N-simple.

O arquivo original é DOCX ou PPTX. O sistema cria uma cópia PDF fiel para sua compreensão visual e mantém o Office original como fonte editável. Portanto:
- O PDF é a fonte visual para entender layout, tipografia, gráficos, tabelas, imagens, relações espaciais e aparência.
- O manifesto OOXML é a fonte estrutural para localizar objetos que podem ser alterados.
- Nunca trate o PDF como se fosse o arquivo editável.
- Nunca invente IDs de objetos. Só use IDs presentes no manifesto.
- Nunca proponha uma alteração que não consiga apontar para um alvo estrutural real.
- Para PowerPoint, transições e animações devem ser expressas como alterações no PresentationML do PPTX original.
- Para Word, alterações textuais devem apontar para o parágrafo real e para o texto original exato.
- Alterações não suportadas pelo patcher devem ser classificadas como "manual" e não como aplicáveis automaticamente.

Ao revisar:
- Primeiro compreenda o arquivo inteiro.
- Diferencie fatos do arquivo, inferências e recomendações.
- Não invente dados, referências, imagens ou requisitos.
- Para PowerPoint, avalie cada slide e a narrativa do conjunto.
- Para Word, avalie macroestrutura, progressão argumentativa, tabelas, figuras, citações, referências e clareza.
- Recomendações visuais e de animação devem ser funcionais, simples e acessíveis.

Quando uma alteração puder ser aplicada automaticamente, retorne-a no array "edits" usando exclusivamente este contrato:
1. replace_text:
{"type":"replace_text","unit":"Slide 2"|"Parágrafo 3","targetId":"...","oldText":"texto exato","newText":"novo texto"}
2. set_transition:
{"type":"set_transition","slide":2,"transition":"fade|push|wipe|split|cover|reveal","speed":"slow|med|fast","advanceOnClick":true,"advanceAfterMs":3000}
3. add_animation:
{"type":"add_animation","slide":2,"targetId":"7","effect":"fade|blinds|box|fly","trigger":"click|withPrevious|afterPrevious","durationMs":700,"delayMs":0}
4. remove_animations:
{"type":"remove_animations","slide":2,"targetId":"7"}

Regras para animações:
- Use targetId de um objeto existente no manifesto.
- Prefira fade, duração 500–900 ms, e gatilho por clique ou com o anterior.
- Não use animação apenas por estética.
- Não remova animações existentes sem motivo.
- Uma transição de slide é diferente de uma animação de objeto.

Retorne JSON válido exatamente neste formato:
{
  "answer": "resposta em português",
  "edits": [],
  "manualChanges": []
}
`;

function jsonFromModel(text: string) {
  const cleaned = text.replace(/^\`\`\`json\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
    }
  }
  return null;
}

async function convertOfficeToPdf(file: File) {
  if (!CONVERTER_URL) {
    throw new Error('O conversor Office→PDF não está configurado. Defina DOCUMENT_CONVERTER_URL no ambiente do servidor.');
  }

  const form = new FormData();
  form.append('files', new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' }), file.name);
  form.append('exportBookmarks', 'true');
  form.append('updateIndexes', 'true');
  form.append('useTransitionEffects', 'true');

  const headers: HeadersInit = {};
  const username = process.env.DOCUMENT_CONVERTER_USERNAME;
  const password = process.env.DOCUMENT_CONVERTER_PASSWORD;
  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  const response = await fetch(`${CONVERTER_URL}/forms/libreoffice/convert`, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Falha na conversão Office→PDF (${response.status}): ${detail}`);
  }

  const pdf = Buffer.from(await response.arrayBuffer());
  if (!pdf.length || pdf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('O conversor retornou uma resposta que não é um PDF válido.');
  }
  if (pdf.byteLength > 50 * 1024 * 1024) {
    throw new Error('O PDF gerado ultrapassou o limite de 50 MB aceito pela análise visual.');
  }
  return pdf;
}

async function uploadPdfToGemini(ai: GoogleGenAI, pdf: Buffer, fileName: string) {
  const tempPath = `/tmp/professor-documentos-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
  await writeFile(tempPath, pdf);
  const file = await ai.files.upload({
    file: tempPath,
    config: { displayName: `${fileName.replace(/\.[^.]+$/, '')}.pdf`, mimeType: 'application/pdf' },
  });

  let current = file;
  const deadline = Date.now() + 90_000;
  while (current.state === 'PROCESSING' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    current = await ai.files.get({ name: current.name });
  }
  if (current.state === 'FAILED') throw new Error('O Gemini não conseguiu processar o PDF visual.');
  if (current.state === 'PROCESSING') throw new Error('O processamento visual do PDF excedeu o tempo limite.');
  if (!current.uri || !current.mimeType) throw new Error('O Gemini não retornou uma referência válida para o PDF.');
  return current;
}

function structurePrompt(structure: DocumentStructure) {
  const targets = structure.editableTargets.map(t => ({
    unit: t.unit,
    objectId: t.objectId,
    name: t.name,
    type: t.type,
    text: t.text,
    runs: t.runs,
  }));
  return `Você receberá o PDF visual deste documento e, junto dele, o manifesto estrutural do Office original.

MANIFESTO:
${JSON.stringify({
  kind: structure.kind,
  title: structure.title,
  slides: structure.slides,
  paragraphs: structure.paragraphs,
  tables: structure.tables,
  images: structure.images,
  animations: structure.animations,
  transitions: structure.transitions,
  notes: structure.notes,
  targets,
}, null, 2)}

CONTEXTO TEXTUAL:
${structure.rawText}

Faça uma leitura integral do PDF e do manifesto. Identifique conteúdo, relações visuais, gráficos, tabelas, imagens, hierarquia, acessibilidade e problemas acadêmicos. Não confunda o número da página PDF com um ID de objeto do Office.`;
}

const INITIAL_SYSTEM_PROMPT = SYSTEM_PROMPT + `\n\nPara a leitura inicial, retorne JSON no formato: {"analysis":{"documentType":"word|powerpoint","title":"","executiveSummary":"","purpose":"","audience":"","strengths":[],"priorityIssues":[],"contentMap":[],"visualDiagnosis":[],"questionsToStart":[],"suggestedActions":[],"confidence":0},"edits":[],"manualChanges":[]}.`;

async function analyzeNewFile(ai: GoogleGenAI, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('Por segurança, o Professor aceita arquivos de até 20 MB por análise.');
  if (!/\.(docx|pptx)$/i.test(file.name)) throw new Error('Envie um arquivo .docx ou .pptx.');

  const inspected = await inspectOfficeDocument(buffer, file.name);
  const pdf = await convertOfficeToPdf(file);
  const uploadedPdf = await uploadPdfToGemini(ai, pdf, file.name);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: createUserContent([
      createPartFromUri(uploadedPdf.uri!, uploadedPdf.mimeType!),
      structurePrompt(inspected.structure),
    ]),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  const parsed = jsonFromModel(response.text || '');
  if (!parsed) throw new Error('O Professor concluiu a leitura, mas a resposta estruturada não pôde ser interpretada.');

  return {
    fileName: file.name,
    mimeType: file.type,
    documentContext: inspected.structure.rawText,
    structure: inspected.structure,
    analysis: parsed,
    pdfFileUri: uploadedPdf.uri,
    pdfFileMimeType: uploadedPdf.mimeType,
  };
}

async function answerQuestion(ai: GoogleGenAI, body: any) {
  if (!body?.question || !body?.pdfFileUri || !body?.structure) {
    throw new Error('Sessão visual incompleta. Reenvie o arquivo para continuar.');
  }

  const prompt = `DOCUMENTO OFFICE JÁ COMPREENDIDO.
Manifesto estrutural:
${JSON.stringify(body.structure, null, 2)}

Diagnóstico anterior:
${JSON.stringify(body.analysis || {}, null, 2)}

Contexto textual:
${String(body.documentContext || '')}

Pergunta do usuário:
${String(body.question)}

Responda usando também o PDF visual. Se houver alteração aplicável automaticamente, preencha "edits". Se a alteração exigir uma capacidade que o patcher não implementa, deixe "edits" vazio e explique em "manualChanges".`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: createUserContent([
      createPartFromUri(body.pdfFileUri, body.pdfFileMimeType || 'application/pdf'),
      prompt,
    ]),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  const parsed = jsonFromModel(response.text || '');
  if (!parsed) return { answer: response.text || 'Não consegui produzir uma resposta.', edits: [], manualChanges: [] };
  return {
    answer: String(parsed.answer || ''),
    edits: Array.isArray(parsed.edits) ? parsed.edits : [],
    manualChanges: Array.isArray(parsed.manualChanges) ? parsed.manualChanges : [],
  };
}

async function applyEdits(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  const editsRaw = form.get('edits');
  if (!(file instanceof File) || typeof editsRaw !== 'string') {
    throw new Error('Arquivo e alterações são obrigatórios.');
  }
  if (!/\.(docx|pptx)$/i.test(file.name)) throw new Error('Somente DOCX e PPTX podem receber alterações.');
  let edits: DocumentEdit[];
  try {
    edits = JSON.parse(editsRaw);
  } catch {
    throw new Error('O plano de alterações não é um JSON válido.');
  }
  if (!Array.isArray(edits) || edits.length > 30) throw new Error('Plano de alterações inválido ou grande demais.');

  const kind = file.name.toLowerCase().endsWith('.pptx') ? 'pptx' : 'docx';
  const result = await applyDocumentEdits(Buffer.from(await file.arrayBuffer()), kind, edits);
  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': kind === 'pptx'
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Professor-${file.name}"`,
      'X-Applied-Edits': String(result.applied.length),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const action = form.get('action');
      if (action === 'apply-edits') return await applyEdits(req);

      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 });
      return NextResponse.json(await analyzeNewFile(new GoogleGenAI({ apiKey }), file));
    }

    const body = await req.json();
    return NextResponse.json(await answerQuestion(new GoogleGenAI({ apiKey }), body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada no Professor de Documentos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
