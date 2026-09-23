import type {
  AvaliacaoResultado,
  QuestionDificuldade,
  SessionAnswerRecord,
  SessionTema,
  TutorProgressEntry,
  TutorQuestion,
  TutorSessionState,
} from './types';

export const DEFAULT_SESSION_META = 8;

const DIFICULDADE_ORDER: QuestionDificuldade[] = ['basica', 'aplicacao', 'detalhamento'];

export function createSessionState(meta = DEFAULT_SESSION_META): TutorSessionState {
  return {
    status: 'idle',
    tema: null,
    currentQuestion: null,
    askedIds: [],
    history: [],
    contextFontes: '',
    errorMessage: null,
    meta,
  };
}

export function startSession(state: TutorSessionState, tema: SessionTema): TutorSessionState {
  return {
    ...createSessionState(state.meta),
    status: 'loading',
    tema,
  };
}

export function setSessionContext(
  state: TutorSessionState,
  contextFontes: string
): TutorSessionState {
  return { ...state, contextFontes };
}

export function setCurrentQuestion(
  state: TutorSessionState,
  question: TutorQuestion
): TutorSessionState {
  return {
    ...state,
    status: 'question',
    currentQuestion: question,
    askedIds: state.askedIds.includes(question.id)
      ? state.askedIds
      : [...state.askedIds, question.id],
    errorMessage: null,
  };
}

export function setSessionError(state: TutorSessionState, message: string): TutorSessionState {
  return { ...state, status: 'error', errorMessage: message };
}

export function setSessionLoading(state: TutorSessionState): TutorSessionState {
  return { ...state, status: 'loading', errorMessage: null };
}

export function setEvaluating(state: TutorSessionState): TutorSessionState {
  return { ...state, status: 'evaluating', errorMessage: null };
}

export function recordAnswer(
  state: TutorSessionState,
  answerText: string,
  avaliacao: AvaliacaoResultado
): TutorSessionState {
  if (!state.currentQuestion) return state;

  const q = state.currentQuestion;
  const record: SessionAnswerRecord = {
    questionId: q.id,
    dificuldade: q.dificuldade,
    answerText,
    avaliacao,
    topic: q.subassunto || q.assunto || state.tema?.tema || 'geral',
  };

  const history = [...state.history, record];
  const done = history.length >= state.meta;

  return {
    ...state,
    status: done ? 'done' : 'feedback',
    history,
  };
}

export function nextQuestionPending(state: TutorSessionState): TutorSessionState {
  return { ...state, status: 'loading', currentQuestion: null };
}

export function finishSession(state: TutorSessionState): TutorSessionState {
  return { ...state, status: 'done', currentQuestion: null };
}

/**
 * Escolhe a próxima dificuldade com base no status geral da última avaliação.
 */
export function nextDificuldade(
  current: QuestionDificuldade,
  statusGeral: AvaliacaoResultado['statusGeral']
): QuestionDificuldade {
  const idx = DIFICULDADE_ORDER.indexOf(current);
  if (statusGeral === 'dominou') {
    return DIFICULDADE_ORDER[Math.min(idx + 1, DIFICULDADE_ORDER.length - 1)];
  }
  if (statusGeral === 'revisar') {
    return DIFICULDADE_ORDER[Math.max(idx - 1, 0)];
  }
  return current;
}

/**
 * Monta a query de recuperação da próxima questão:
 * - omissões/erros da última avaliação viram foco de busca
 * - mantém a dificuldade sugerida pelo adaptativo
 */
export function buildNextQuery(
  state: TutorSessionState,
  lastAvaliacao?: AvaliacaoResultado
): {
  query: string;
  dificuldade?: QuestionDificuldade;
  preferWeakness: boolean;
} {
  const tema = state.tema;
  const base = [tema?.tema, tema?.subtema].filter(Boolean).join(' — ') || 'agronomia';

  if (!lastAvaliacao || lastAvaliacao.statusGeral === 'dominou') {
    const last = state.history[state.history.length - 1];
    const dificuldade = last
      ? nextDificuldade(last.dificuldade, lastAvaliacao?.statusGeral ?? 'parcial')
      : 'basica';
    return { query: base, dificuldade, preferWeakness: false };
  }

  const foco = [
    ...(lastAvaliacao.omissoes || []),
    ...(lastAvaliacao.errosConceituais || []),
  ].slice(0, 3);

  const last = state.history[state.history.length - 1];
  const dificuldade = last
    ? nextDificuldade(last.dificuldade, lastAvaliacao.statusGeral)
    : 'basica';

  if (foco.length > 0) {
    return {
      query: `${base} ${foco.join(' ')}`,
      dificuldade,
      preferWeakness: true,
    };
  }

  return { query: base, dificuldade, preferWeakness: false };
}

/**
 * Filtra e ordena candidatas: prioriza foco de fraqueza, dificuldade alvo
 * e evita repetição (excludeIds já vem do caller, mas garante aqui).
 */
export function pickNextQuestion(
  candidates: TutorQuestion[],
  state: TutorSessionState,
  opts: { dificuldade?: QuestionDificuldade; preferWeakness?: boolean; weaknessTerms?: string[] }
): TutorQuestion | null {
  const asked = new Set(state.askedIds);
  const fresh = candidates.filter((q) => !asked.has(q.id));
  if (fresh.length === 0) return null;

  const weaknessTerms = (opts.weaknessTerms || [])
    .map((w) => w.toLowerCase())
    .filter(Boolean);

  const scored = fresh.map((q) => {
    let score = q.similarity ?? 0.5;

    if (opts.dificuldade) {
      if (q.dificuldade === opts.dificuldade) score += 0.2;
      else {
        const a = DIFICULDADE_ORDER.indexOf(q.dificuldade);
        const b = DIFICULDADE_ORDER.indexOf(opts.dificuldade);
        score -= Math.abs(a - b) * 0.08;
      }
    }

    if (opts.preferWeakness && weaknessTerms.length > 0) {
      const text = `${q.enunciado} ${q.assunto} ${q.subassunto || ''} ${q.explicacao || ''}`.toLowerCase();
      for (const term of weaknessTerms) {
        if (text.includes(term)) score += 0.35;
      }
    }

    return { q, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].q;
}

export function sessionSummary(state: TutorSessionState, progress?: TutorProgressEntry | null) {
  const answered = state.history.length;
  const consolidados = state.history.filter((h) => h.avaliacao.statusGeral === 'dominou').length;
  const parciais = state.history.filter((h) => h.avaliacao.statusGeral === 'parcial').length;
  const revisar = state.history.filter((h) => h.avaliacao.statusGeral === 'revisar').length;
  const percent = state.meta > 0 ? Math.round((answered / state.meta) * 100) : 0;

  return {
    answered,
    meta: state.meta,
    percent,
    consolidados,
    parciais,
    revisar,
    mastery: progress?.masteryEstimate ?? null,
    weaknesses: progress?.weaknesses ?? [],
    strengths: progress?.strengths ?? [],
  };
}
