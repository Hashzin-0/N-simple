import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai';
import { inspectOfficeDocument, type DocumentStructure } from '@/lib/professorDocumentos';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = process.env.PROFESSOR_GEMINI_MODEL || 'gemini-3.8-flash';

const SYSTEM_PROMPT = `Você é o Professor IA de Documentos Acadêmicos do N-simple.
Sua função é atuar como orientador acadêmico e consultor de comunicação científica para documentos Word e apresentações PowerPoint.

Princípios:
- Primeiro compreenda o arquivo inteiro; não responda com base em uma única frase, slide ou ocorrência.
- Diferencie fatos do arquivo, inferências e recomendações.
- Não invente dados, referências, resultados, imagens ou requisitos institucionais.
- Ao encontrar possível erro factual, classifique como "confirmar", "provável" ou "evidente" e explique a evidência.
- Considere propósito, público, disciplina, nível acadêmico, argumento, evidências, coerência, organização, linguagem, visualização de dados, imagens, acessibilidade e apresentação oral.
- Para PowerPoint, trate cada slide como unidade de comunicação, mas também avalie a narrativa do conjunto.
- Para Word, avalie macroestrutura, progressão argumentativa, parágrafos, tabelas/figuras, citações, referências e clareza.
- Recomendações de imagens devem ser específicas ao conceito: diga o que a imagem deve mostrar, por que ajuda, qual tipo de fonte é apropriada e onde deve ser creditada.
- Recomendações de animação devem ser funcionais, não decorativas. Priorize animações simples, progressivas e acessíveis.
- Não transforme slides em texto corrido. A apresentação deve apoiar a fala e destacar ideias, dados e relações.
- Faça perguntas de diagnóstico somente quando a resposta depender de uma informação que não esteja no arquivo.

Rubrica de diagnóstico:
1. Objetivo e público.
2. Estrutura e narrativa.
3. Conteúdo e rigor acadêmico.
4. Evidências e referências.
5. Clareza linguística.
6. Design visual e hierarquia.
7. Dados, figuras e imagens.
8. Acessibilidade.
9. Estratégia de apresentação.
10. Coerência entre texto, visual e fala.

Use práticas de avaliação acadêmica: tese/pergunta central, objetivos, método, evidência, interpretação, limitações, implicações, conclusão e "por que isso importa?". Para apresentações, verifique se cada slide tem uma ideia principal e se a sequência constrói entendimento.`;

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

async function waitForFile(ai: GoogleGenAI, name: string) {
  let file = await ai.files.get({ name });
  for (let i = 0; i < 30 && file.state === 'PROCESSING'; i++) {
    await new Promise(r => setTimeout(r, 2000));
    file = await ai.files.get({ name });
  }
  if (file.state === 'FAILED') throw new Error('O Gemini não conseguiu processar o arquivo.');
  return file;
}

function structurePrompt(s: DocumentStructure) {
  return `MAPA ESTRUTURAL EXTRAÍDO LOCALMENTE:
Tipo: ${s.kind}
Título detectado: ${s.title}
Unidades: ${s.slides || s.paragraphs}
Tabelas: ${s.tables}
Imagens incorporadas: ${s.images.length}
Animações detectadas: ${s.animations}
Transições detectadas: ${s.transitions}
Notas detectadas: ${s.notes}

TEXTO ESTRUTURAL:
${s.rawText}

Analise o arquivo completo e devolva JSON com:
{
  "documentType": "word" | "powerpoint",
  "title": string,
  "executiveSummary": string,
  "purpose": string,
  "audience": string,
  "strengths": string[],
  "priorityIssues": [{"severity":"alta"|"media"|"baixa","unit":string,"issue":string,"why":string,"recommendation":string}],
  "contentMap": [{"unit":string,"mainIdea":string,"role":"contexto"|"problema"|"metodo"|"evidencia"|"analise"|"conclusao"|"referencia"|"outro"}],
  "visualDiagnosis": [{"unit":string,"status":"forte"|"adequar"|"critico","reason":string}],
  "questionsToStart": string[],
  "suggestedActions": string[],
  "confidence": number
}
`;
}

async function analyzeNewFile(ai: GoogleGenAI, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('Por segurança, o Professor aceita arquivos de até 20 MB por análise.');
  if (!/\.(docx|pptx)$/i.test(file.name)) throw new Error('Envie um arquivo .docx ou .pptx.');

  const inspected = await inspectOfficeDocument(buffer, file.name);
  const uploaded = await ai.files.upload({
    file: new Blob([buffer], { type: file.type || 'application/octet-stream' }),
    config: { mimeType: file.type || 'application/octet-stream', displayName: file.name },
  });
  if (!uploaded.name) throw new Error('Falha ao registrar o arquivo no Gemini.');
  const processed = await waitForFile(ai, uploaded.name);

  const visualParts = inspected.assets
    .filter(a => a.base64 && a.mimeType.startsWith('image/'))
    .slice(0, 40)
    .map(a => ({ inlineData: { mimeType: a.mimeType, data: a.base64! } }));

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: createUserContent([
      createPartFromUri(processed.uri!, processed.mimeType || file.type),
      { text: structurePrompt(inspected.structure) },
      ...visualParts,
    ]),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  const analysis = jsonFromModel(response.text || '');
  if (!analysis) throw new Error('O Professor concluiu a leitura, mas a resposta estruturada não pôde ser interpretada.');
  return {
    fileName: file.name,
    mimeType: file.type,
    geminiFileUri: processed.uri,
    geminiFileMimeType: processed.mimeType || file.type,
    structure: inspected.structure,
    analysis,
  };
}

async function answerQuestion(ai: GoogleGenAI, body: any) {
  if (!body?.question || !body?.geminiFileUri || !body?.geminiFileMimeType) {
    throw new Error('Sessão de documento incompleta.');
  }
  const context = JSON.stringify(body.analysis || {});
  const prompt = `DOCUMENTO JÁ COMPREENDIDO.
Contexto estruturado do diagnóstico:
${context}

Pergunta do usuário:
${String(body.question)}

Responda como professor/orientador acadêmico. Primeiro dê uma resposta objetiva. Depois, quando útil, organize em "Por quê", "Como fazer no arquivo" e "Exemplo". Se recomendar uma imagem, especifique assunto, composição, finalidade, fonte recomendada e crédito. Se recomendar uma animação, indique objeto, ordem, gatilho e duração aproximada, evitando efeitos decorativos. Se corrigir conteúdo, mostre "antes → depois" e explique a justificativa. Não invente informações ausentes.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: createUserContent([
      createPartFromUri(body.geminiFileUri, body.geminiFileMimeType),
      prompt,
    ]),
    config: { systemInstruction: SYSTEM_PROMPT },
  });
  return { answer: response.text || 'Não consegui produzir uma resposta para essa pergunta.' };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 });
      return NextResponse.json(await analyzeNewFile(ai, file));
    }

    const body = await req.json();
    return NextResponse.json(await answerQuestion(ai, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada no Professor de Documentos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
