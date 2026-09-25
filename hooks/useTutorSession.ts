'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  beginSocraticAttempt,
  buildNextQuery,
  createSessionState,
  finishSession,
  metaForModo,
  nextQuestionPending,
  pickNextQuestion,
  recordAnswer,
  registerSocraticHint,
  revealSocraticAnswer,
  setCurrentQuestion,
  setEvaluating,
  setSessionContext,
  setSessionError,
  setSessionLoading,
  startSession,
} from '@/lib/tutor/session';
import type {
  AvaliacaoResultado,
  ResearchQuestionsResponse,
  SessionTema,
  TutorErrorsResponse,
  TutorModo,
  TutorQuestion,
  TutorSessionState,
} from '@/lib/tutor/types';
import { useTutorProgress } from './useTutorProgress';

const FOCUS_LIMIT = 6;

export function useTutorSession() {
  const [state, setState] = useState<TutorSessionState>(() => createSessionState());
  const [researchInfo, setResearchInfo] = useState<ResearchQuestionsResponse | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [lastAvaliacao, setLastAvaliacao] = useState<AvaliacaoResultado | null>(null);
  const [errorQueueCount, setErrorQueueCount] = useState(0);
  const lastAvaliacaoRef = useRef<AvaliacaoResultado | null>(null);
  const poolRef = useRef<TutorQuestion[]>([]);
  const stateRef = useRef(state);
  const documentsContextRef = useRef<string>('');
  const progress = useTutorProgress();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshErrorQueue = useCallback(async () => {
    const userId = progress.cloudUserId;
    if (!userId) {
      setErrorQueueCount(0);
      return;
    }
    try {
      const res = await fetch(`/api/tutor/errors?userId=${encodeURIComponent(userId)}&limit=1`);
      if (!res.ok) return;
      const data = (await res.json()) as TutorErrorsResponse;
      setErrorQueueCount(data.attempts?.length ?? 0);
    } catch {
      // fila indisponível
    }
  }, [progress.cloudUserId]);

  const fetchContextFontes = useCallback(async (tema: SessionTema): Promise<string> => {
    const query = [tema.tema, tema.subtema].filter(Boolean).join(' ');
    try {
      const res = await fetch('/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      const sources = (data.sources || []) as Array<{
        title?: string;
        abstract?: string;
        bestExcerpt?: string;
        abntCitation?: string;
      }>;
      if (sources.length === 0) return '';
      return sources
        .slice(0, 8)
        .map((s, i) =>
          [
            `[Fonte ${i + 1}] ${s.abntCitation || s.title || ''}`,
            s.bestExcerpt ? `Trecho: ${s.bestExcerpt}` : '',
            s.abstract ? `Resumo: ${s.abstract.slice(0, 400)}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n');
    } catch {
      return '';
    }
  }, []);

  /** Digest dos PDFs enviados — fonte primária para avaliação e pesquisa de questões. */
  const fetchDocumentsContext = useCallback(async (): Promise<string> => {
    const userId = progress.cloudUserId;
    try {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`/api/tutor/documents/query${qs}`);
      if (!res.ok) return '';
      const data = (await res.json()) as { context?: string };
      return data.context || '';
    } catch {
      return '';
    }
  }, [progress.cloudUserId]);

  const research = useCallback(
    async (tema: SessionTema, documentContext?: string): Promise<TutorQuestion[]> => {
      setIsResearching(true);
      try {
        const res = await fetch('/api/tutor/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tema: tema.tema,
            subtema: tema.subtema,
            documentContext: documentContext || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as ResearchQuestionsResponse;
        setResearchInfo(data);
        return data.questions || [];
      } finally {
        setIsResearching(false);
      }
    },
    []
  );

  const fetchErrorQueue = useCallback(
    async (): Promise<TutorQuestion[]> => {
      const userId = progress.cloudUserId;
      if (!userId) return [];
      try {
        const res = await fetch(
          `/api/tutor/errors?userId=${encodeURIComponent(userId)}&limit=8`
        );
        if (!res.ok) return [];
        const data = (await res.json()) as TutorErrorsResponse;
        setErrorQueueCount(data.attempts?.length ?? 0);
        return data.questions || [];
      } catch {
        return [];
      }
    },
    [progress.cloudUserId]
  );

  const loadNextQuestion = useCallback(async (): Promise<TutorSessionState> => {
    let currentState = { ...stateRef.current };
    setState(setSessionLoading(currentState));
    currentState = { ...currentState, status: 'loading', errorMessage: null };
    stateRef.current = currentState;

    if (!currentState.tema && currentState.modo !== 'conversar') return currentState;

    let pool = poolRef.current;
    const next = buildNextQuery(currentState, lastAvaliacaoRef.current || undefined);
    const weaknessTerms = lastAvaliacaoRef.current
      ? [
          ...(lastAvaliacaoRef.current.omissoes || []),
          ...(lastAvaliacaoRef.current.errosConceituais || []),
        ]
      : [];
    const allowRepeat = currentState.modo === 'revisar_erros';

    if (pool.length === 0) {
      try {
        if (allowRepeat) {
          pool = await fetchErrorQueue();
        }
        if (pool.length === 0 && currentState.tema) {
          pool = await research(currentState.tema, documentsContextRef.current || undefined);
        }
        poolRef.current = pool;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao carregar questões.';
        const errored = setSessionError(currentState, msg);
        setState(errored);
        return errored;
      }
    }

    let candidate = pickNextQuestion(pool, currentState, {
      dificuldade: next.dificuldade,
      preferWeakness: next.preferWeakness,
      weaknessTerms,
      allowRepeat,
    });

    if (!candidate) {
      try {
        const res = await fetch('/api/tutor/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: next.query,
            assunto: currentState.tema?.tema || 'agronomia',
            dificuldade: next.dificuldade,
            excludeIds: currentState.askedIds,
            limit: FOCUS_LIMIT,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const remote = (data.questions || []) as TutorQuestion[];
          candidate = pickNextQuestion(remote, currentState, {
            dificuldade: next.dificuldade,
            preferWeakness: next.preferWeakness,
            weaknessTerms,
            allowRepeat,
          });
        }
      } catch {
        // cai no erro abaixo
      }
    }

    if (!candidate) {
      const done = {
        ...setSessionError(
          currentState,
          currentState.modo === 'revisar_erros'
            ? 'Nenhum erro pendente para revisar. Resolva novas questões ou escolha outro modo.'
            : 'Não há mais questões para este tema. Pesquise novamente ou escolha outro tema.'
        ),
        status: 'done' as const,
      };
      setState(done);
      return done;
    }

    const withQuestion = setCurrentQuestion(currentState, candidate);
    setState(withQuestion);
    return withQuestion;
  }, [research, fetchErrorQueue]);

  const beginSession = useCallback(
    async (
      tema: SessionTema,
      modo: TutorModo = stateRef.current.modo || 'sessao'
    ): Promise<{ success: boolean; question?: string; message: string }> => {
      const meta = metaForModo(modo, stateRef.current.meta);
      let nextState = startSession(
        { ...stateRef.current, meta, modo },
        tema,
        modo
      );
      setState(nextState);
      stateRef.current = nextState;
      poolRef.current = [];
      lastAvaliacaoRef.current = null;
      setLastAvaliacao(null);

      try {
        if (modo === 'conversar') {
          const [contextFontes, docsContext] = await Promise.all([
            fetchContextFontes(tema),
            fetchDocumentsContext(),
          ]);
          documentsContextRef.current = docsContext;
          const combined = [docsContext, contextFontes].filter(Boolean).join('\n\n');
          nextState = { ...setSessionContext(nextState, combined), status: 'conversando' };
          setState(nextState);
          stateRef.current = nextState;
          return {
            success: true,
            message:
              'Modo conversar ativo. Fale sobre o tema — se quiser questões, peça "me pergunte sobre isso".',
          };
        }

        if (modo === 'revisar_erros') {
          const [contextFontes, queue, docsContext] = await Promise.all([
            fetchContextFontes(tema),
            fetchErrorQueue(),
            fetchDocumentsContext(),
          ]);
          documentsContextRef.current = docsContext;
          nextState = setSessionContext(
            nextState,
            [docsContext, contextFontes].filter(Boolean).join('\n\n')
          );
          stateRef.current = nextState;
          poolRef.current = queue;

          if (queue.length === 0) {
            // fallback: pesquisa normal
            const questions = await research(tema, docsContext || undefined);
            poolRef.current = questions;
            if (questions.length === 0) {
              const errored = setSessionError(
                nextState,
                'Nenhum erro pendente e nenhuma questão encontrada.'
              );
              setState(errored);
              stateRef.current = errored;
              return { success: false, message: errored.errorMessage || 'Sem questões.' };
            }
          }
        } else {
          const docsContext = await fetchDocumentsContext();
          documentsContextRef.current = docsContext;
          const [contextFontes, questions] = await Promise.all([
            fetchContextFontes(tema),
            research(tema, docsContext || undefined),
          ]);
          nextState = setSessionContext(
            nextState,
            [docsContext, contextFontes].filter(Boolean).join('\n\n')
          );
          stateRef.current = nextState;
          poolRef.current = questions;

          if (questions.length === 0) {
            const errored = setSessionError(
              nextState,
              'Nenhuma questão encontrada. Verifique o Supabase ou tente outro tema.'
            );
            setState(errored);
            stateRef.current = errored;
            return { success: false, message: errored.errorMessage || 'Sem questões.' };
          }
        }

        const finalState = await loadNextQuestion();
        const q = finalState.currentQuestion;
        return {
          success: !!q,
          question: q?.enunciado,
          message: q
            ? `Sessão iniciada. Questão: ${q.enunciado}`
            : finalState.errorMessage || 'Não foi possível carregar a questão.',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao iniciar a sessão.';
        const errored = setSessionError(nextState, msg);
        setState(errored);
        stateRef.current = errored;
        return { success: false, message: msg };
      }
    },
    [fetchContextFontes, research, loadNextQuestion, fetchErrorQueue, fetchDocumentsContext]
  );

  const submitAnswer = useCallback(
    async (answerText: string): Promise<AvaliacaoResultado | null> => {
      const currentState = stateRef.current;
      const question = currentState.currentQuestion;
      if (!question || !currentState.tema) return null;

      const trimmed = answerText.trim();
      if (!trimmed) return null;

      const evaluating = setEvaluating(currentState);
      setState(evaluating);
      stateRef.current = evaluating;

      try {
        const res = await fetch('/api/tutor/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enunciado: question.enunciado,
            respostaAluno: trimmed,
            gabarito: question.gabarito,
            explicacao: question.explicacao,
            contextoFontes: currentState.contextFontes,
            dificuldade: question.dificuldade,
            modo: currentState.modo,
            tentativa: currentState.socratic.tentativa,
            pistaAnterior: lastAvaliacaoRef.current?.pista ?? null,
            contextoDocumentos: documentsContextRef.current || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { avaliacao: AvaliacaoResultado };
        const avaliacao = data.avaliacao;
        lastAvaliacaoRef.current = avaliacao;
        setLastAvaliacao(avaliacao);

        const isSocratic = currentState.modo === 'socratico';
        const tentativa = currentState.socratic.tentativa;
        const canRetry = isSocratic && tentativa < 3 && avaliacao.statusGeral !== 'dominou';

        if (canRetry) {
          // Não conta para meta ainda: mantém status feedback com pista
          const after = beginSocraticAttempt({
            ...evaluating,
            status: 'feedback',
          });
          setState(after);
          stateRef.current = after;
          // grava attempt intermediário apenas se 3ª falhar depois — evita mastery negativo cedo
          return avaliacao;
        }

        const topic = question.subassunto || question.assunto;
        const ready =
          isSocratic && !avaliacao.statusGeral
            ? evaluating
            : evaluating;
        const finalState = isSocratic ? revealSocraticAnswer(ready) : ready;
        const after = recordAnswer(finalState, trimmed, avaliacao);
        setState(after);
        stateRef.current = after;

        void progress.recordAttempt({
          questionId: question.id,
          assunto: question.assunto,
          subassunto: question.subassunto,
          topic,
          answerText: trimmed,
          evaluation: avaliacao,
          dificuldade: question.dificuldade,
          modo: currentState.modo,
        });

        return avaliacao;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao avaliar a resposta.';
        const errored = setSessionError(evaluating, msg);
        setState(errored);
        stateRef.current = errored;
        return null;
      }
    },
    [progress]
  );

  /** Modo socrático: aluno pede dica ou "não sei". */
  const requestHint = useCallback(async (): Promise<{
    success: boolean;
    pista?: string | null;
    gabarito?: string | null;
    message: string;
  }> => {
    const currentState = stateRef.current;
    if (currentState.modo !== 'socratico' || !currentState.currentQuestion) {
      return { success: false, message: 'Dica disponível só no modo socrático.' };
    }

    const q = currentState.currentQuestion;
    const tentativa = currentState.socratic.tentativa;

    if (tentativa >= 3 || currentState.socratic.revealed) {
      const revealed = revealSocraticAnswer({
        ...registerSocraticHint(currentState),
        status: 'feedback',
      });
      setState(revealed);
      stateRef.current = revealed;
      return {
        success: true,
        pista: null,
        gabarito: q.gabarito,
        message: q.gabarito
          ? `Resposta esperada: ${q.gabarito}. ${q.explicacao || ''}`
          : q.explicacao || 'Sem gabarito fechado — veja a explicação.',
      };
    }

    const hinted = registerSocraticHint(beginSocraticAttempt(currentState));
    // usa pista da última avaliação se houver; senão pede via evaluate vazio? melhor: usa formulacao.dica
    const pista =
      lastAvaliacaoRef.current?.pista ||
      lastAvaliacaoRef.current?.dimensoes.formulacao.dica ||
      `Pense no conceito central de ${q.assunto}${q.subassunto ? ` — ${q.subassunto}` : ''}.`;

    const withHint = { ...hinted, status: 'feedback' as const };
    setState(withHint);
    stateRef.current = withHint;
    setLastAvaliacao((prev) =>
      prev
        ? { ...prev, pista }
        : prev
    );

    return {
      success: true,
      pista,
      gabarito: null,
      message: pista,
    };
  }, []);

  /** Força registro final (3ª tentativa / "não sei" com gabarito). */
  const forceRecordCurrent = useCallback(async (): Promise<AvaliacaoResultado | null> => {
    const currentState = stateRef.current;
    if (!currentState.currentQuestion || !lastAvaliacaoRef.current) return null;
    const revealed = revealSocraticAnswer(currentState);
    const after = recordAnswer(
      revealed,
      '(sem nova resposta — revelado pelo tutor)',
      lastAvaliacaoRef.current
    );
    setState(after);
    stateRef.current = after;

    void progress.recordAttempt({
      questionId: currentState.currentQuestion.id,
      assunto: currentState.currentQuestion.assunto,
      subassunto: currentState.currentQuestion.subassunto,
      topic:
        currentState.currentQuestion.subassunto ||
        currentState.currentQuestion.assunto ||
        'geral',
      answerText: '(revelado)',
      evaluation: lastAvaliacaoRef.current,
      dificuldade: currentState.currentQuestion.dificuldade,
      modo: currentState.modo,
    });
    return lastAvaliacaoRef.current;
  }, [progress]);

  /** Volta para a caixa de resposta na mesma questão (retry socrático). */
  const retryAttempt = useCallback(() => {
    const current = stateRef.current;
    if (current.modo !== 'socratico' || !current.currentQuestion) return;
    const next = {
      ...current,
      status: 'question' as const,
      errorMessage: null,
    };
    setState(next);
    stateRef.current = next;
    setLastAvaliacao(null);
    lastAvaliacaoRef.current = null;
  }, []);

  const advance = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const pending = nextQuestionPending(stateRef.current);
    setState(pending);
    stateRef.current = pending;
    const next = await loadNextQuestion();
    return {
      success: !!next.currentQuestion,
      message: next.currentQuestion
        ? `Próxima questão: ${next.currentQuestion.enunciado}`
        : next.errorMessage || 'Fim das questões.',
    };
  }, [loadNextQuestion]);

  const end = useCallback((): { success: boolean; message: string } => {
    const finished = finishSession(stateRef.current);
    setState(finished);
    stateRef.current = finished;
    const h = finished.history;
    const consolidados = h.filter((x) => x.avaliacao.statusGeral === 'dominou').length;
    return {
      success: true,
      message: `Sessão encerrada com ${h.length} questões. ${consolidados} consolidadas.`,
    };
  }, []);

  const reset = useCallback(() => {
    lastAvaliacaoRef.current = null;
    setLastAvaliacao(null);
    poolRef.current = [];
    documentsContextRef.current = '';
    setResearchInfo(null);
    const modo = stateRef.current.modo;
    const fresh = createSessionState(metaForModo(modo), modo);
    setState(fresh);
    stateRef.current = fresh;
    void refreshErrorQueue();
  }, [refreshErrorQueue]);

  const getQuestionText = useCallback((): {
    success: boolean;
    question?: string;
    message: string;
  } => {
    const q = stateRef.current.currentQuestion;
    if (!q) return { success: false, message: 'Nenhuma questão ativa. Inicie uma sessão.' };
    return { success: true, question: q.enunciado, message: q.enunciado };
  }, []);

  // Carrega contagem da fila de erros fora do effect (evita setState em effect)
  const ensureErrorQueueCount = useCallback(() => {
    void refreshErrorQueue();
  }, [refreshErrorQueue]);

  const submitForVoice = useCallback(
    async (answerText: string) => {
      const avaliacao = await submitAnswer(answerText);
      if (!avaliacao) {
        return {
          success: false as const,
          message: stateRef.current.errorMessage || 'Não consegui avaliar a resposta.',
        };
      }
      const s = stateRef.current.socratic;
      return {
        success: true as const,
        statusGeral: avaliacao.statusGeral,
        feedbackOral: avaliacao.feedbackOral,
        avaliacao,
        pista: avaliacao.pista ?? null,
        tentativa: s.tentativa,
        message: `${avaliacao.statusGeral}. ${avaliacao.feedbackOral}${
          avaliacao.pista ? ` Pista: ${avaliacao.pista}` : ''
        }`,
      };
    },
    [submitAnswer]
  );

  const summary = useMemo(() => {
    const topic = state.tema
      ? [state.tema.tema, state.tema.subtema].filter(Boolean).join(' — ')
      : null;
    const topicProgress = topic ? progress.getTopicProgress(topic) : null;
    const answered = state.history.length;
    const consolidados = state.history.filter((h) => h.avaliacao.statusGeral === 'dominou').length;
    const revisar = state.history.filter((h) => h.avaliacao.statusGeral === 'revisar').length;
    const parciais = state.history.filter((h) => h.avaliacao.statusGeral === 'parcial').length;
    return {
      answered,
      meta: state.meta,
      percent: state.meta > 0 ? Math.round((answered / state.meta) * 100) : 0,
      consolidados,
      parciais,
      revisar,
      topic,
      topicProgress,
      weaknessCount: topicProgress?.weaknesses.length ?? 0,
      modo: state.modo,
      socratic: state.socratic,
      errorQueueCount,
    };
  }, [state, progress, errorQueueCount]);

  return {
    state,
    summary,
    researchInfo,
    isResearching,
    progress,
    lastAvaliacao,
    errorQueueCount,
    beginSession,
    submitAnswer,
    submitForVoice,
    requestHint,
    forceRecordCurrent,
    retryAttempt,
    advance,
    end,
    reset,
    getQuestionText,
    refreshErrorQueue,
    ensureErrorQueueCount,
  };
}
