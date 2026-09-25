'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  GraduationCap,
  Loader2,
  Lightbulb,
  MessageCircle,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
} from 'lucide-react';
import { useTutorSession } from '@/hooks/useTutorSession';
import { useTutorLiveAgent, type TutorLiveBridgeContext } from '@/hooks/useTutorLiveAgent';
import TemaSelector from './TemaSelector';
import SessionHUD from './SessionHUD';
import QuestionCard from './QuestionCard';
import AnswerBox from './AnswerBox';
import FeedbackPanel from './FeedbackPanel';
import ProgressPanel from './ProgressPanel';
import ResearchPanel from './ResearchPanel';
import DocumentUploader from './DocumentUploader';
import ReviewStudio from './ReviewStudio';
import SaveProgressToggle from '@/components/auth/SaveProgressToggle';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AvaliacaoResultado, SessionTema, TutorModo } from '@/lib/tutor/types';

interface TutorInteligenteProps {
  isDark?: boolean;
}

const MODO_LABELS: Record<TutorModo, string> = {
  sessao: 'Sessão adaptativa',
  socratico: 'Modo Socrático',
  revisar_erros: 'Revisar erros',
  rapida: 'Revisão rápida',
  conversar: 'Conversar',
};

const MODO_CHIPS: Array<{ id: TutorModo; label: string; icon: React.ReactNode }> = [
  { id: 'sessao', label: 'Sessão', icon: <Sparkles className="size-3" /> },
  { id: 'socratico', label: 'Socrático', icon: <Lightbulb className="size-3" /> },
  { id: 'revisar_erros', label: 'Revisar erros', icon: <AlertCircle className="size-3" /> },
  { id: 'rapida', label: 'Rápida', icon: <Timer className="size-3" /> },
  { id: 'conversar', label: 'Conversar', icon: <MessageCircle className="size-3" /> },
];

export default function TutorInteligente(props: TutorInteligenteProps) {
  void props.isDark;
  const { user } = useAuth();
  const session = useTutorSession();
  const { state, summary, isResearching, progress, lastAvaliacao, errorQueueCount } = session;
  const [lastFeedback, setLastFeedback] = useState<AvaliacaoResultado | null>(null);
  const [modo, setModo] = useState<TutorModo>(() => {
    if (typeof window === 'undefined') return 'sessao';
    try {
      return (localStorage.getItem('n_calc_tutor_modo') as TutorModo) || 'sessao';
    } catch {
      return 'sessao';
    }
  });
  const [pistaManual, setPistaManual] = useState<string | null>(null);

  const currentTema: SessionTema | null = state.tema;
  const activeModo = state.modo || modo;
  const isSocratic = activeModo === 'socratico' && state.modo === 'socratico';
  const isConversar = activeModo === 'conversar' && state.status === 'conversando';

  const liveBridge = useMemo<TutorLiveBridgeContext>(
    () => ({
      startSession: async (tema, subtema) => {
        setLastFeedback(null);
        setPistaManual(null);
        return session.beginSession({ tema, subtema }, modo);
      },
      getCurrentQuestion: async () => session.getQuestionText(),
      submitAnswer: async (answerText) => {
        const result = await session.submitForVoice(answerText);
        if (result.success && 'avaliacao' in result && result.avaliacao) {
          setLastFeedback(result.avaliacao);
        }
        return result;
      },
      advance: async () => {
        setLastFeedback(null);
        setPistaManual(null);
        return session.advance();
      },
      endSession: async () => session.end(),
      giveHint: async () => session.requestHint(),
      getTema: () =>
        state.tema ? [state.tema.tema, state.tema.subtema].filter(Boolean).join(' — ') : null,
      getUserId: () => user?.id ?? null,
    }),
    [session, modo, state.tema, user?.id]
  );

  const tutorAgent = useTutorLiveAgent(liveBridge, state.modo || modo);

  const selectModo = useCallback(
    (m: TutorModo) => {
      setModo(m);
      try {
        localStorage.setItem('n_calc_tutor_modo', m);
      } catch {
        // ignore
      }
      if (m === 'revisar_erros') session.ensureErrorQueueCount();
    },
    [session]
  );

  const handleStart = useCallback(
    (tema: SessionTema) => {
      setLastFeedback(null);
      setPistaManual(null);
      void session.beginSession(tema, modo);
    },
    [session, modo]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      setPistaManual(null);
      const result = await session.submitAnswer(text);
      if (result) setLastFeedback(result);
    },
    [session]
  );

  const handleAdvance = useCallback(() => {
    setLastFeedback(null);
    setPistaManual(null);
    void session.advance();
  }, [session]);

  const handleHint = useCallback(async () => {
    const result = await session.requestHint();
    if (result.success) {
      setPistaManual(result.pista ?? result.message);
      if (result.gabarito) {
        const av = await session.forceRecordCurrent();
        if (av) setLastFeedback(av);
      }
    }
  }, [session]);

  const handleSkipSocratic = useCallback(async () => {
    const av = await session.forceRecordCurrent();
    if (av) setLastFeedback(av);
    setPistaManual(null);
  }, [session]);

  const handleSocraticRetry = useCallback(() => {
    setLastFeedback(null);
    setPistaManual(null);
    session.retryAttempt();
  }, [session]);

  const showTema =
    (state.status === 'idle' || state.status === 'error') && !isConversar;
  const showQuestion =
    state.status === 'question' ||
    state.status === 'evaluating' ||
    state.status === 'feedback';
  const showFeedback =
    (state.status === 'feedback' || state.status === 'done') &&
    !!(lastFeedback || lastAvaliacao);
  const socraticCanRetry =
    isSocratic &&
    state.status === 'feedback' &&
    state.socratic.tentativa <= 3 &&
    state.socratic.tentativa > 1 &&
    lastFeedback?.statusGeral !== 'dominou' &&
    !state.socratic.revealed;

  const voiceStatus = tutorAgent.state.status;
  const pista = pistaManual || lastFeedback?.pista || lastAvaliacao?.pista || null;

  return (
    <div className="w-full space-y-4">
      <SaveProgressToggle id="tutor_save_progress_toggle" />

      {/* Header de modos */}
      <div
        id="tutor_modes"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] px-4 py-3"
      >
        <GraduationCap className="size-4 text-[#2E6F40] dark:text-[#9CB386]" />
        <span className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC]">
          Tutor de Revisão
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386] font-medium">
          <Sparkles className="size-3" />
          {MODO_LABELS[state.modo || modo]}
        </span>
        {state.status !== 'idle' && errorQueueCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            {errorQueueCount} erro{errorQueueCount === 1 ? '' : 's'} na fila
          </span>
        )}
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {MODO_CHIPS.map(({ id, label, icon }) => {
            const active = modo === id;
            return (
              <button
                key={id}
                type="button"
                id={`tutor_mode_${id}`}
                onClick={() => selectModo(id)}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                  active
                    ? 'bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] border-[#2E6F40] dark:border-[#9CB386]'
                    : 'bg-[#F3F1EC] dark:bg-[#2C3328] text-[#5A5A40] dark:text-[#9EA399] border-[#E5E2D9] dark:border-[#3A4235] hover:border-[#2E6F40]/40'
                }`}
                aria-pressed={active}
              >
                {icon}
                {label}
                {id === 'revisar_erros' && errorQueueCount > 0 && (
                  <span className="ml-0.5 font-bold">{errorQueueCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showTema && (
        <TemaSelector
          onStart={handleStart}
          isStarting={state.status === 'loading' || isResearching}
          disabled={state.status === 'loading'}
        />
      )}

      {state.status === 'conversando' && (
        <div
          id="tutor_conversar"
          className="rounded-3xl border border-[#2E6F40]/25 bg-[#2E6F40]/5 dark:bg-[#9CB386]/10 p-5 space-y-3"
        >
          <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-2">
            <MessageCircle className="size-4 text-[#2E6F40] dark:text-[#9CB386]" />
            Modo conversar
          </p>
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] leading-relaxed">
            Conecte a voz do tutor para dialogar sobre{' '}
            {currentTema ? currentTema.tema : 'agronomia'}. Peça “me pergunte sobre…” para iniciar
            uma sessão de questões pelo áudio.
          </p>
          {state.contextFontes && (
            <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] line-clamp-3">
              Contexto carregado de fontes já pesquisadas.
            </p>
          )}
        </div>
      )}

      {state.status === 'loading' && (
        <div className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-6 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-[#2E6F40] dark:text-[#9CB386]" />
          <p className="text-sm text-[#242A20] dark:text-[#F3F1EC] font-medium">
            Preparando sua sessão de revisão…
          </p>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            {activeModo === 'revisar_erros'
              ? 'Carregando fila de erros e questões pendentes…'
              : 'Consultando memória de fontes, artigos e questões no Supabase…'}
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-3xl border border-red-500/25 bg-red-500/5 p-4 flex gap-2.5">
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-red-700 dark:text-red-400">{state.errorMessage}</p>
            <button
              type="button"
              onClick={session.reset}
              className="text-xs font-medium text-[#2E6F40] dark:text-[#9CB386] underline"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}

      {(state.status !== 'idle' || currentTema) && !isConversar && (
        <SessionHUD
          percent={summary.percent}
          answered={summary.answered}
          meta={summary.meta}
          consolidados={summary.consolidados}
          parciais={summary.parciais}
          revisar={summary.revisar}
          topic={summary.topic}
        />
      )}

      {showQuestion && state.currentQuestion && (
        <div className="space-y-4">
          <QuestionCard
            question={state.currentQuestion}
            questionNumber={summary.answered + 1}
            total={summary.meta}
          />

          {isSocratic && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4A373]/30 bg-[#D4A373]/10 px-4 py-2.5">
              <span className="text-xs font-semibold text-[#C19262] dark:text-[#E0A96D]">
                Tentativa {state.socratic.tentativa} de 3
                {state.socratic.hintsUsed > 0 && ` · ${state.socratic.hintsUsed} dica(s)`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="tutor_hint"
                  onClick={() => void handleHint()}
                  disabled={state.status === 'evaluating'}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] font-medium hover:border-[#D4A373]/50 disabled:opacity-50"
                >
                  Não sei — dica
                </button>
                <button
                  type="button"
                  id="tutor_skip_socratic"
                  onClick={() => void handleSkipSocratic()}
                  disabled={state.status === 'evaluating'}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] font-medium disabled:opacity-50"
                >
                  Pular
                </button>
              </div>
            </div>
          )}

          {pista && showFeedback && (
            <div className="rounded-2xl border border-[#D4A373]/30 bg-[#D4A373]/10 px-4 py-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#C19262] dark:text-[#E0A96D]">
                💡 Pista (tentativa {state.socratic.tentativa}/3)
              </p>
              <p className="text-sm text-[#242A20] dark:text-[#F3F1EC]">{pista}</p>
              {isSocratic && !state.socratic.revealed && (
                <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399]">
                  Tente de novo com a pista — o gabarito só aparece na 3ª tentativa.
                </p>
              )}
            </div>
          )}

          {(state.status === 'question' || state.status === 'evaluating') && (
            <AnswerBox
              key={state.currentQuestion?.id}
              resetKey={state.currentQuestion?.id}
              onSubmit={handleSubmit}
              isEvaluating={state.status === 'evaluating'}
              disabled={state.status === 'evaluating'}
              voiceStatus={
                voiceStatus === 'connecting'
                  ? 'connecting'
                  : voiceStatus === 'listening'
                    ? 'listening'
                    : voiceStatus === 'speaking'
                      ? 'speaking'
                      : voiceStatus === 'error'
                        ? 'error'
                        : 'idle'
              }
              onVoiceToggle={tutorAgent.toggleConnection}
            />
          )}

          {state.status === 'evaluating' && (
            <div className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-[#2E6F40] dark:text-[#9CB386]" />
              <p className="text-xs text-[#5A5A40] dark:text-[#9EA399]">
                Análise semântica da sua resposta em 4 dimensões…
              </p>
            </div>
          )}

          {showFeedback && (lastFeedback || lastAvaliacao) && (
            <FeedbackPanel
              avaliacao={(lastFeedback || lastAvaliacao)!}
              hideReveal={isSocratic && !state.socratic.revealed}
            />
          )}

          {state.status === 'feedback' &&
            (!isSocratic || state.socratic.revealed || !socraticCanRetry) && (
              <button
                type="button"
                id="tutor_next_question"
                onClick={
                  isSocratic && socraticCanRetry
                    ? handleSocraticRetry
                    : handleAdvance
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5A5A40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-sm font-medium hover:bg-[#454530] dark:hover:bg-[#8AB87A] transition-colors"
              >
                {isSocratic && socraticCanRetry ? 'Tentar de novo' : 'Próxima questão'}
                <Sparkles className="size-4" />
              </button>
            )}

          {state.status === 'feedback' && isSocratic && socraticCanRetry && (
            <button
              type="button"
              id="tutor_advance_anyway"
              onClick={handleAdvance}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] text-xs font-medium hover:border-[#2E6F40]/40 transition-colors"
            >
              Avançar mesmo assim
            </button>
          )}
        </div>
      )}

      {state.status === 'done' && (
        <div
          id="tutor_done"
          className="rounded-3xl border border-[#2E6F40]/25 bg-[#2E6F40]/5 dark:bg-[#9CB386]/10 p-5 text-center space-y-3"
        >
          <Trophy className="size-6 mx-auto text-[#2E6F40] dark:text-[#9CB386]" />
          <div>
            <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">
              {activeModo === 'revisar_erros' && summary.answered === 0
                ? 'Nenhum erro pendente'
                : 'Sessão concluída!'}
            </p>
            <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] mt-1">
              {summary.consolidados} consolidada{summary.consolidados === 1 ? '' : 's'} ·{' '}
              {summary.parciais} parcial{summary.parciais === 1 ? '' : 'is'} · {summary.revisar}{' '}
              para revisar
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              id="tutor_restart"
              onClick={() => {
                const tema = currentTema;
                session.reset();
                if (tema) {
                  setTimeout(() => handleStart(tema), 50);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-xs font-medium hover:bg-[#245A33] dark:hover:bg-[#8AB87A] transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Nova sessão
            </button>
            <button
              type="button"
              onClick={session.reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] text-xs font-medium hover:border-[#2E6F40]/40 transition-colors"
            >
              Trocar tema
            </button>
          </div>
        </div>
      )}

      {/* Barra de voz do tutor */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[#5A5A40] dark:text-[#9EA399]">
          {tutorAgent.state.isConnected ? (
            <>
              <Mic className="size-3.5 text-[#2E6F40] dark:text-[#9CB386]" />
              Voz do tutor
              {voiceStatus === 'listening' && ' · ouvindo'}
              {voiceStatus === 'speaking' && ' · falando'}
              {voiceStatus === 'connecting' && ' · conectando'}
              {voiceStatus === 'error' && ' · erro'}
            </>
          ) : (
            <>
              <MicOff className="size-3.5" />
              Voz desconectada — responda por texto ou ative a voz
            </>
          )}
        </div>
        <button
          type="button"
          id="tutor_voice_connect"
          onClick={tutorAgent.toggleConnection}
          disabled={tutorAgent.state.isConnecting}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
            tutorAgent.state.isConnected
              ? 'bg-[#F3F1EC] dark:bg-[#2C3328] text-[#5A5A40] dark:text-[#9EA399] border border-[#E5E2D9] dark:border-[#3A4235]'
              : 'bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A]'
          }`}
        >
          {tutorAgent.state.isConnecting
            ? 'Conectando…'
            : tutorAgent.state.isConnected
              ? 'Desconectar'
              : 'Conectar voz'}
        </button>
      </div>

      {/* Material enviado + Estúdio de revisão */}
      <div className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 sm:p-5 space-y-5">
        <DocumentUploader userId={user?.id ?? null} />
        <ReviewStudio tema={currentTema} userId={user?.id ?? null} />
      </div>

      <ResearchPanel tema={currentTema} />

      <ProgressPanel entries={progress.listProgress()} />
    </div>
  );
}
