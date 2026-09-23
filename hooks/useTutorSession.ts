'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildNextQuery,
  createSessionState,
  finishSession,
  nextQuestionPending,
  pickNextQuestion,
  recordAnswer,
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
  const lastAvaliacaoRef = useRef<AvaliacaoResultado | null>(null);
  const poolRef = useRef<TutorQuestion[]>([]);
  const stateRef = useRef(state);
  const progress = useTutorProgress();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const research = useCallback(
    async (tema: SessionTema): Promise<TutorQuestion[]> => {
      setIsResearching(true);
      try {
        const res = await fetch('/api/tutor/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema: tema.tema, subtema: tema.subtema }),
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

  const loadNextQuestion = useCallback(async (): Promise<TutorSessionState> => {
    let currentState = { ...stateRef.current };
    setState(setSessionLoading(currentState));
    currentState = { ...currentState, status: 'loading', errorMessage: null };
    stateRef.current = currentState;

    if (!currentState.tema) return currentState;

    let pool = poolRef.current;
    const next = buildNextQuery(currentState, lastAvaliacaoRef.current || undefined);
    const weaknessTerms = lastAvaliacaoRef.current
      ? [
          ...(lastAvaliacaoRef.current.omissoes || []),
          ...(lastAvaliacaoRef.current.errosConceituais || []),
        ]
      : [];

    if (pool.length === 0) {
      try {
        pool = await research(currentState.tema);
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
    });

    if (!candidate) {
      try {
        const res = await fetch('/api/tutor/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: next.query,
            assunto: currentState.tema.tema,
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
          'Não há mais questões para este tema. Pesquise novamente ou escolha outro tema.'
        ),
        status: 'done' as const,
      };
      setState(done);
      return done;
    }

    const withQuestion = setCurrentQuestion(currentState, candidate);
    setState(withQuestion);
    return withQuestion;
  }, [research]);

  const beginSession = useCallback(
    async (tema: SessionTema): Promise<{ success: boolean; question?: string; message: string }> => {
      let nextState = startSession(stateRef.current, tema);
      setState(nextState);
      stateRef.current = nextState;

      try {
        const [contextFontes, questions] = await Promise.all([
          fetchContextFontes(tema),
          research(tema),
        ]);

        nextState = setSessionContext(nextState, contextFontes);
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
    [fetchContextFontes, research, loadNextQuestion]
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

        const topic = question.subassunto || question.assunto;
        const after = recordAnswer(evaluating, trimmed, avaliacao);
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
    setResearchInfo(null);
    const fresh = createSessionState();
    setState(fresh);
    stateRef.current = fresh;
  }, []);

  const getQuestionText = useCallback((): { success: boolean; question?: string; message: string } => {
    const q = stateRef.current.currentQuestion;
    if (!q) return { success: false, message: 'Nenhuma questão ativa. Inicie uma sessão.' };
    return { success: true, question: q.enunciado, message: q.enunciado };
  }, []);

  const submitForVoice = useCallback(
    async (answerText: string) => {
      const avaliacao = await submitAnswer(answerText);
      if (!avaliacao) {
        return {
          success: false as const,
          message: stateRef.current.errorMessage || 'Não consegui avaliar a resposta.',
        };
      }
      return {
        success: true as const,
        statusGeral: avaliacao.statusGeral,
        feedbackOral: avaliacao.feedbackOral,
        avaliacao,
        message: `${avaliacao.statusGeral}. ${avaliacao.feedbackOral}`,
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
    };
  }, [state, progress]);

  return {
    state,
    summary,
    researchInfo,
    isResearching,
    progress,
    lastAvaliacao,
    beginSession,
    submitAnswer,
    submitForVoice,
    advance,
    end,
    reset,
    getQuestionText,
  };
}
