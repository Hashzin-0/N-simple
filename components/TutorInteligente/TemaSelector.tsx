'use client';

import React, { useState } from 'react';
import { GraduationCap, Loader2, Search } from 'lucide-react';
import type { SessionTema } from '@/lib/tutor/types';

const TEMAS_SUGERIDOS: Array<{ tema: string; subtema?: string }> = [
  { tema: 'Fertilidade do Solo', subtema: 'Calagem' },
  { tema: 'Adubação Nitrogenada' },
  { tema: 'Nutrição de Plantas' },
  { tema: 'Solo', subtema: 'Acidez e Bases' },
  { tema: 'Manejo do Solo' },
  { tema: 'Agronegócio', subtema: 'Sustentabilidade' },
  { tema: 'Ética Profissional', subtema: 'Moral e Ética' },
];

interface TemaSelectorProps {
  disabled?: boolean;
  isStarting?: boolean;
  onStart: (tema: SessionTema) => void;
}

export default function TemaSelector({ disabled, isStarting, onStart }: TemaSelectorProps) {
  const [tema, setTema] = useState('');
  const [subtema, setSubtema] = useState('');

  const canSubmit = tema.trim().length >= 3 && !disabled && !isStarting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onStart({ tema: tema.trim(), subtema: subtema.trim() || undefined });
  };

  return (
    <div
      id="tutor_tema"
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-[#2E6F40] dark:text-[#9CB386]" />
        <div>
          <h2 className="text-base font-semibold text-[#242A20] dark:text-[#F3F1EC]">
            Tutor Inteligente — Revisão Oral
          </h2>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            Questões pesquisadas em fontes acadêmicas · avaliação conceitual em 4 dimensões
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="tutor_tema_input"
              className="block text-xs font-medium text-[#242A20] dark:text-[#F3F1EC]"
            >
              Tema
            </label>
            <input
              id="tutor_tema_input"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex.: Fertilidade do Solo"
              disabled={disabled}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] transition-colors disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="tutor_subtema_input"
              className="block text-xs font-medium text-[#242A20] dark:text-[#F3F1EC]"
            >
              Subtema <span className="text-[#8C897E] font-normal">(opcional)</span>
            </label>
            <input
              id="tutor_subtema_input"
              value={subtema}
              onChange={(e) => setSubtema(e.target.value)}
              placeholder="Ex.: Calagem"
              disabled={disabled}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] transition-colors disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TEMAS_SUGERIDOS.map((s) => (
            <button
              key={`${s.tema}-${s.subtema || ''}`}
              type="button"
              disabled={disabled}
              onClick={() => {
                setTema(s.tema);
                setSubtema(s.subtema || '');
              }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] hover:border-[#2E6F40]/40 hover:text-[#2E6F40] dark:hover:text-[#9CB386] transition-colors disabled:opacity-40"
            >
              {s.tema}
              {s.subtema ? ` · ${s.subtema}` : ''}
            </button>
          ))}
        </div>

        <button
          type="submit"
          id="tutor_start_session"
          disabled={!canSubmit}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-sm font-medium hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isStarting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Pesquisando questões…
            </>
          ) : (
            <>
              <Search className="size-4" />
              Iniciar revisão
            </>
          )}
        </button>
      </form>
    </div>
  );
}
