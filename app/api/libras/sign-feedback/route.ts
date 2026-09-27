import { NextRequest, NextResponse } from 'next/server';
import { generateTextWithFallback } from '@/lib/llm-providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Teto por frame (base64) e por requisição. */
const MAX_FRAME_CHARS = 700_000;
const MAX_FRAMES = 4;
const MAX_BODY_CHARS = MAX_FRAME_CHARS * MAX_FRAMES;

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

interface FeedbackBody {
  alvo?: string | null;
  frames?: string[];
}

interface ParsedFeedback {
  identificacao?: string;
  acerto?: number | null;
  correcoes?: string[];
  elogio?: string;
  mensagem?: string;
}

function buildPrompt(alvo: string | null, frameCount: number): string {
  const alvoLine = alvo
    ? `O sinal-alvo que o aluno tentou fazer é "${alvo}".`
    : 'Não há sinal-alvo: identifique sozinho qual sinal o aluno está fazendo.';
  return `Você é um professor de Língua Brasileira de Sinais (Libras) avaliando um aluno iniciante durante uma prática com a webcam.
Você recebe ${frameCount} quadro(s) sequencial(is) da câmera: mãos, braços, rosto e tronco da pessoa.
${alvoLine}

Analise a configuração das mãos (formato, orientação, ponto de articulação em relação ao corpo), o movimento entre os quadros e a expressão facial.

Responda SOMENTE com um objeto JSON válido (sem markdown, sem cercas de código), no formato:
{
  "identificacao": "nome do sinal identificado ou palpite",
  "acerto": <número de 0 a 100, ou null se não houver alvo>,
  "correcoes": ["correção objetiva e curta", "..."],
  "elogio": "um elogio breve e sincero",
  "mensagem": "fala natural em pt-BR, 1 a 3 frases curtas, pronta para o assistente de voz narrar"
}

Regras:
- Se houver alvo: "acerto" mede o quanto a configuração visível se aproxima do sinal alvo.
- Sem alvo: "acerto" = null e "identificacao" é o melhor palpite (ou "não identifiquei").
- Se as mãos não estiverem visíveis ou a imagem estiver ruim, "acerto" = 0 e explique em "correcoes".
- "correcoes": no máximo 3 itens, práticos e específicos (ex: "mão em formato de L perto da testa", "pule o movimento de abrir e fechar os dedos").
- "mensagem": motivadora e direta, como um professor ao lado do aluno — nada de listas nem jargão.
- Nunca invente detalhes que não aparecem nos quadros.`;
}

function parseJsonLoose(raw: string): ParsedFeedback | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    return obj && typeof obj === 'object' ? (obj as ParsedFeedback) : null;
  } catch {
    return null;
  }
}

function clampList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, 3)
    .map((x) => x.trim());
}

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (frames.length === 0 || frames.length > MAX_FRAMES) {
    return NextResponse.json(
      { ok: false, error: `Envie entre 1 e ${MAX_FRAMES} quadros da câmera.` },
      { status: 400 }
    );
  }
  if (frames.some((f) => typeof f !== 'string' || f.length > MAX_FRAME_CHARS)) {
    return NextResponse.json(
      { ok: false, error: 'Quadro da câmera grande demais.' },
      { status: 413 }
    );
  }
  if (frames.join('').length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { ok: false, error: 'Payload de imagens grande demais.' },
      { status: 413 }
    );
  }

  const parts: { inlineData: { mimeType: string; data: string } }[] = [];
  for (const f of frames) {
    const m = DATA_URL_RE.exec(f);
    if (!m) {
      return NextResponse.json(
        { ok: false, error: 'Formato de imagem inválido (use data:image/jpeg;base64,...).' },
        { status: 400 }
      );
    }
    parts.push({ inlineData: { mimeType: m[1], data: m[2].replace(/\s/g, '') } });
  }

  const alvo = typeof body.alvo === 'string' && body.alvo.trim() ? body.alvo.trim().slice(0, 80) : null;

  try {
    const { text } = await generateTextWithFallback({
      prompt: buildPrompt(alvo, frames.length),
      parts,
    });

    const parsed = parseJsonLoose(text);
    if (!parsed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Não consegui interpretar a avaliação. Tente novamente com mais luz.',
        },
        { status: 502 }
      );
    }

    const acerto =
      typeof parsed.acerto === 'number' && Number.isFinite(parsed.acerto)
        ? Math.max(0, Math.min(100, Math.round(parsed.acerto)))
        : null;

    const identificacao =
      typeof parsed.identificacao === 'string' && parsed.identificacao.trim()
        ? parsed.identificacao.trim().slice(0, 80)
        : undefined;

    const message =
      typeof parsed.mensagem === 'string' && parsed.mensagem.trim()
        ? parsed.mensagem.trim().slice(0, 400)
        : alvo
          ? `Avaliação do sinal "${alvo}" concluída.`
          : 'Avaliação concluída.';

    return NextResponse.json({
      ok: true,
      identificacao,
      acerto: alvo || identificacao ? acerto : null,
      correcoes: clampList(parsed.correcoes),
      elogio:
        typeof parsed.elogio === 'string' && parsed.elogio.trim()
          ? parsed.elogio.trim().slice(0, 200)
          : undefined,
      message,
    });
  } catch (err) {
    console.error('[sign-feedback] LLM error:', err);
    return NextResponse.json(
      { ok: false, error: 'Serviço de visão indisponível no momento. Tente de novo.' },
      { status: 502 }
    );
  }
}
