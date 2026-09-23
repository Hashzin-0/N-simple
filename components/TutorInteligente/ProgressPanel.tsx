'use client';

import React from 'react';
import { BarChart3, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import type { TutorProgressEntry } from '@/lib/tutor/types';

interface ProgressPanelProps {
  entries: TutorProgressEntry[];
}

function masteryColor(pct: number): string {
  if (pct >= 75) return 'bg-[#2E6F40] dark:bg-[#86efac]';
  if (pct >= 50) return 'bg-[#D4A373] dark:bg-[#E0A96D]';
  return 'bg-red-500';
}

export default function ProgressPanel({ entries }: ProgressPanelProps) {
  return (
    <div
      id="tutor_progress"
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <BarChart3 className="size-4 text-[#2E6F40] dark:text-[#9CB386]" />
          Desempenho por tema
        </h3>
        <span className="text-[11px] text-[#8C897E] dark:text-[#9EA399]">
          {entries.length} tema{entries.length === 1 ? '' : 's'}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-[#8C897E] dark:text-[#9EA399] text-center py-6">
          Nenhuma sessão registrada ainda. Inicie uma revisão para acompanhar seu domínio.
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => {
            const pct = Math.round((entry.masteryEstimate || 0) * 100);
            return (
              <li key={entry.topic} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#242A20] dark:text-[#F3F1EC] truncate">
                    {entry.topic}
                  </span>
                  <span className="text-xs font-bold text-[#5A5A40] dark:text-[#9CB386] shrink-0">
                    {pct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#F3F1EC] dark:bg-[#2C3328] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${masteryColor(pct)}`}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Domínio de ${entry.topic}`}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {entry.strengths.slice(0, 3).map((s, i) => (
                    <span
                      key={`s-${i}`}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]"
                    >
                      <CheckCircle2 className="size-2.5" />
                      {s}
                    </span>
                  ))}
                  {entry.weaknesses.slice(0, 3).map((w, i) => (
                    <span
                      key={`w-${i}`}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400"
                    >
                      <AlertCircle className="size-2.5" />
                      {w}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#8C897E] dark:text-[#9EA399]">
                  <TrendingUp className="size-3" />
                  {entry.attempts} tentativa{entry.attempts === 1 ? '' : 's'}
                  {entry.lastReview && (
                    <span>· {new Date(entry.lastReview).toLocaleDateString('pt-BR')}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl p-3 bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235]">
        <p className="text-[11px] text-[#5A5A40] dark:text-[#9EA399] leading-relaxed">
          Não é uma nota absoluta: o domínio estimado combina acertos, parciais e revisões ao
          longo do tempo — como uma monitoria oral contínua.
        </p>
      </div>
    </div>
  );
}
