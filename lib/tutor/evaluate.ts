import { generateWithFallback } from '@/lib/llm-providers';
import { buildEvaluatePrompt, EvaluateAnswerArgs } from './prompts';
import type { AvaliacaoResultado, DimensaoAvaliacao, DimensaoStatus, FormulacaoAvaliacao, StatusGeral } from './types';

const FALLBACK_DIMENSAO: DimensaoAvaliacao = {
  status: 'nao_avaliado',
  comentario: 'Avaliação indisponível no momento.',
};

const FALLBACK: AvaliacaoResultado = {
  statusGeral: 'parcial',
  dimensoes: {
    conteudo: { ...FALLBACK_DIMENSAO },
    completude: { ...FALLBACK_DIMENSAO },
    coerencia: { ...FALLBACK_DIMENSAO },
    formulacao: {
      antes: '',
      depois: '',
      dica: 'Tente mencionar os conceitos-chave do enunciado com terminologia técnica.',
    },
  },
  conceitosCorretos: [],
  omissoes: [],
  errosConceituais: [],
  feedbackOral: 'Não consegui avaliar completamente. Pode repetir a resposta?',
};

function parseStatus(value: unknown): DimensaoStatus {
  if (value === 'correto' || value === 'parcial' || value === 'errado') return value;
  return 'nao_avaliado';
}

function parseStatusGeral(value: unknown): StatusGeral {
  if (value === 'dominou' || value === 'parcial' || value === 'revisar') return value;
  return 'parcial';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter((v) => v.trim().length > 0);
}

function normalizeAvaliacao(raw: unknown): AvaliacaoResultado | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const dim = (obj.dimensoes ?? {}) as Record<string, unknown>;

  const conteudoRaw = (dim.conteudo ?? {}) as Record<string, unknown>;
  const completudeRaw = (dim.completude ?? {}) as Record<string, unknown>;
  const coerenciaRaw = (dim.coerencia ?? {}) as Record<string, unknown>;
  const formulacaoRaw = (dim.formulacao ?? {}) as Record<string, unknown>;

  const conteudo: DimensaoAvaliacao = {
    status: parseStatus(conteudoRaw.status),
    comentario: String(conteudoRaw.comentario ?? ''),
  };
  const completude: DimensaoAvaliacao = {
    status: parseStatus(completudeRaw.status),
    comentario: String(completudeRaw.comentario ?? ''),
  };
  const coerencia: DimensaoAvaliacao = {
    status: parseStatus(coerenciaRaw.status),
    comentario: String(coerenciaRaw.comentario ?? ''),
  };
  const formulacao: FormulacaoAvaliacao = {
    antes: String(formulacaoRaw.antes ?? ''),
    depois: String(formulacaoRaw.depois ?? ''),
    dica: String(formulacaoRaw.dica ?? ''),
  };

  return {
    statusGeral: parseStatusGeral(obj.statusGeral),
    dimensoes: { conteudo, completude, coerencia, formulacao },
    conceitosCorretos: asStringArray(obj.conceitosCorretos),
    omissoes: asStringArray(obj.omissoes),
    errosConceituais: asStringArray(obj.errosConceituais),
    feedbackOral: String(obj.feedbackOral ?? '').trim() || 'Avaliação concluída.',
  };
}

/**
 * Avaliação semântica de resposta do aluno (voz → transcrição ou texto).
 * Usa LLM com fallback de providers; nunca falha a sessão — devolve
 * resultado parcial se o JSON não puder ser interpretado.
 */
export async function evaluateAnswer(args: EvaluateAnswerArgs): Promise<AvaliacaoResultado> {
  const prompt = buildEvaluatePrompt(args);
  const result = await generateWithFallback({ prompt });

  let fullText = '';
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += value.text;
  }

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      ...FALLBACK,
      feedbackOral: args.respostaAluno.trim()
        ? 'Recebi sua resposta, mas tive dificuldade em avaliar. Pode reformular com mais detalhes?'
        : FALLBACK.feedbackOral,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const normalized = normalizeAvaliacao(parsed);
    if (normalized) return normalized;
  } catch {
    // JSON inválido — cai no fallback
  }

  return FALLBACK;
}
