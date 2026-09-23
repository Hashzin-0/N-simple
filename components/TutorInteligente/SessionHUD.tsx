'use client';

import React from 'react';
import { Layers, Sparkles, AlertTriangle, BookOpenCheck } from 'lucide-react';

interface SessionHUDProps {
  percent: number;
  answered: number;
  meta: number;
  consolidados: number;
  parciais: number;
  revisar: number;
  topic?: string | null;
}

export default function SessionHUD({
  percent,
  answered,
  meta,
  consolidados,
  parciais,
  revisar,
  topic,
}: SessionHUDProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      id="tutor_session"
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <Layers className="size-4 text-[#2E6F40] dark:text-[#9CB386]" />
          Progresso da sessão
        </h3>
        {topic && (
          <span className="text-[11px] text-[#8C897E] dark:text-[#9EA399]">{topic}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[#5A5A40] dark:text-[#9EA399]">
          <span>{answered} de {meta} questões</span>
          <span className="font-semibold text-[#242A20] dark:text-[#F3F1EC]">{clamped}%</span>
        </div>
        <div className="h-3 rounded-full bg-[#F3F1EC] dark:bg-[#2C3328] overflow-hidden border border-[#E5E2D9] dark:border-[#3A4235]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2E6F40] to-[#9CB386] transition-all duration-500"
            style={{ width: `${clamped}%` }}
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da sessão de revisão"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-2.5 bg-[#2E6F40]/5 border border-[#2E6F40]/15 text-center">
          <BookOpenCheck className="size-3.5 mx-auto text-[#2E6F40] dark:text-[#9CB386] mb-1" />
          <p className="text-lg font-bold text-[#2E6F40] dark:text-[#9CB386] leading-none">
            {consolidados}
          </p>
          <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] mt-1">Consolidados</p>
        </div>
        <div className="rounded-xl p-2.5 bg-[#D4A373]/10 border border-[#D4A373]/25 text-center">
          <Sparkles className="size-3.5 mx-auto text-[#C19262] dark:text-[#E0A96D] mb-1" />
          <p className="text-lg font-bold text-[#C19262] dark:text-[#E0A96D] leading-none">
            {parciais}
          </p>
          <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] mt-1">Parciais</p>
        </div>
        <div className="rounded-xl p-2.5 bg-red-500/5 border border-red-500/20 text-center">
          <AlertTriangle className="size-3.5 mx-auto text-red-500 mb-1" />
          <p className="text-lg font-bold text-red-600 dark:text-red-400 leading-none">{revisar}</p>
          <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] mt-1">Para revisar</p>
        </div>
      </div>
    </div>
  );
}
