'use client';

import React, { useState } from 'react';
import { Loader2, Mic, MicOff, Send, MessageSquare } from 'lucide-react';

interface AnswerBoxProps {
  disabled?: boolean;
  isEvaluating?: boolean;
  voiceStatus?: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
  onVoiceToggle?: () => void;
  onSubmit: (text: string) => void;
  resetKey?: string | number;
}

export default function AnswerBox({
  disabled,
  isEvaluating,
  voiceStatus = 'idle',
  onVoiceToggle,
  onSubmit,
  resetKey,
}: AnswerBoxProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled || isEvaluating) return;
    onSubmit(trimmed);
    setText('');
  };

  const voiceActive = voiceStatus === 'listening' || voiceStatus === 'speaking' || voiceStatus === 'connecting';

  return (
    <form
      key={resetKey ?? 'answer'}
      id="tutor_answer"
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="tutor_answer_text"
          className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5"
        >
          <MessageSquare className="size-3.5 text-[#2E6F40] dark:text-[#9CB386]" />
          Sua resposta
        </label>
        {onVoiceToggle && (
          <button
            type="button"
            id="tutor_voice_toggle"
            onClick={onVoiceToggle}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors disabled:opacity-40 ${
              voiceActive
                ? 'bg-[#2E6F40] border-[#2E6F40] text-white dark:bg-[#9CB386] dark:border-[#9CB386] dark:text-[#1C201A]'
                : 'bg-[#F3F1EC] dark:bg-[#2C3328] border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] hover:border-[#2E6F40]/40'
            }`}
            aria-pressed={voiceActive}
          >
            {voiceActive ? (
              <>
                <Mic className="size-3.5" />
                {voiceStatus === 'speaking' ? 'Tutor falando…' : voiceStatus === 'connecting' ? 'Conectando…' : 'Ouvindo…'}
              </>
            ) : (
              <>
                <MicOff className="size-3.5" />
                Falar
              </>
            )}
          </button>
        )}
      </div>

      <textarea
        id="tutor_answer_text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={disabled}
        placeholder="Explique com suas palavras… ou use o microfone"
        className="w-full px-4 py-3 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] resize-none transition-colors disabled:opacity-50"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          id="tutor_submit_answer"
          disabled={disabled || isEvaluating || text.trim().length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-sm font-medium hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isEvaluating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Avaliando…
            </>
          ) : (
            <>
              <Send className="size-4" />
              Enviar resposta
            </>
          )}
        </button>
      </div>
    </form>
  );
}
