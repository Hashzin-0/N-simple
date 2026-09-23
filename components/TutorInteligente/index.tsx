'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  GraduationCap,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
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
import type { AvaliacaoResultado, SessionTema } from '@/lib/tutor/types';

interface TutorInteligenteProps {
  isDark?: boolean;
}

export default function TutorInteligente(props: TutorInteligenteProps) {
  void props.isDark;
  const session = useTutorSession();
  const { state, summary, isResearching, progress, lastAvaliacao } = session;
  const [lastFeedback, setLastFeedback] = useState<AvaliacaoResultado | null>(null);

  const currentTema: SessionTema | null = state.tema;

  const liveBridge = useMemo<TutorLiveBridgeContext>(
    () => ({
      startSession: async (tema, subtema) => {
        setLastFeedback(null);
        return session.beginSession({ tema, subtema });
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
        return session.advance();
      },
      endSession: async () => session.end(),
    }),
    [session]
  );

  const tutorAgent = useTutorLiveAgent(liveBridge);

  const handleStart = useCallback(
    (tema: SessionTema) => {
      setLastFeedback(null);
      void session.beginSession(tema);
    },
    [session]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const result = await session.submitAnswer(text);
      if (result) setLastFeedback(result);
    },
    [session]
  );

  const handleAdvance = useCallback(() => {
    setLastFeedback(null);
    void session.advance();
  }, [session]);

  const showTema = state.status === 'idle' || state.status === 'error';
  const showQuestion =
    state.status === 'question' ||
    state.status === 'evaluating' ||
    state.status === 'feedback';
  const showFeedback =
    (state.status === 'feedback' || state.status === 'done') && !!(lastFeedback || lastAvaliacao);

  const voiceStatus = tutorAgent.state.status;

  return (
    <div className="w-full space-y-4">
      {/* Header de modos (MVP: sessão ativa, demais em breve) */}
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
          Sessão adaptativa
        </span>
        {['Conversar', 'Modo Socrático', 'Revisão rápida', 'Revisar erros'].map((modo) => (
          <span
            key={modo}
            className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399] border border-[#E5E2D9] dark:border-[#3A4235] opacity-70"
            title="Em breve"
          >
            {modo} · em breve
          </span>
        ))}
      </div>

      {showTema && (
        <TemaSelector
          onStart={handleStart}
          isStarting={state.status === 'loading' || isResearching}
          disabled={state.status === 'loading'}
        />
      )}

      {state.status === 'loading' && (
        <div className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-6 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-[#2E6F40] dark:text-[#9CB386]" />
          <p className="text-sm text-[#242A20] dark:text-[#F3F1EC] font-medium">
            Preparando sua sessão de revisão…
          </p>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            Consultando memória de fontes, questões no Supabase e montando a próxima pergunta.
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

      {(state.status !== 'idle' || currentTema) && (
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
            <FeedbackPanel avaliacao={(lastFeedback || lastAvaliacao)!} />
          )}

          {state.status === 'feedback' && (
            <button
              type="button"
              id="tutor_next_question"
              onClick={handleAdvance}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5A5A40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-sm font-medium hover:bg-[#454530] dark:hover:bg-[#8AB87A] transition-colors"
            >
              Próxima questão
              <Sparkles className="size-4" />
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
              Sessão concluída!
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

      <ResearchPanel tema={currentTema} />

      <ProgressPanel entries={progress.listProgress()} />
    </div>
  );
}
