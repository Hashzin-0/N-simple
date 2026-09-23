'use client';

import React from 'react';
import type { AvaliacaoResultado, DimensaoAvaliacao, StatusGeral } from '@/lib/tutor/types';

interface FeedbackPanelProps {
  avaliacao: AvaliacaoResultado;
}

const STATUS_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  correto: {
    dot: 'bg-[#2E6F40] dark:bg-[#86efac]',
    label: 'Correto',
    text: 'text-[#2E6F40] dark:text-[#86efac]',
  },
  parcial: {
    dot: 'bg-[#D4A373] dark:bg-[#E0A96D]',
    label: 'Parcial',
    text: 'text-[#C19262] dark:text-[#E0A96D]',
  },
  errado: {
    dot: 'bg-red-500',
    label: 'Precisa revisar',
    text: 'text-red-600 dark:text-red-400',
  },
  nao_avaliado: {
    dot: 'bg-[#8C897E]',
    label: 'Não avaliado',
    text: 'text-[#8C897E]',
  },
};

const GERAL_META: Record<StatusGeral, { emoji: string; label: string; className: string }> = {
  dominou: {
    emoji: '🟢',
    label: 'Dominou',
    className: 'bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#86efac]/10 dark:text-[#86efac] border-[#2E6F40]/20',
  },
  parcial: {
    emoji: '🟡',
    label: 'Parcial',
    className: 'bg-[#D4A373]/10 text-[#C19262] dark:bg-[#E0A96D]/10 dark:text-[#E0A96D] border-[#D4A373]/30',
  },
  revisar: {
    emoji: '🔴',
    label: 'Precisa revisar',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
};

function DimensaoRow({ title, dim }: { title: string; dim: DimensaoAvaliacao }) {
  const style = STATUS_STYLE[dim.status] || STATUS_STYLE.nao_avaliado;
  return (
    <div className="flex gap-2.5 items-start">
      <span className={`mt-1.5 size-2 rounded-full shrink-0 ${style.dot}`} aria-hidden />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC]">{title}</span>
          <span className={`text-[10px] font-medium ${style.text}`}>{style.label}</span>
        </div>
        {dim.comentario && (
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] leading-relaxed mt-0.5">
            {dim.comentario}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FeedbackPanel({ avaliacao }: FeedbackPanelProps) {
  const geral = GERAL_META[avaliacao.statusGeral] || GERAL_META.parcial;
  const f = avaliacao.dimensoes.formulacao;

  return (
    <div
      id="tutor_feedback"
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">
          Feedback do tutor
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${geral.className}`}
        >
          <span aria-hidden>{geral.emoji}</span>
          {geral.label}
        </span>
      </div>

      <div className="space-y-3">
        <DimensaoRow title="Conteúdo" dim={avaliacao.dimensoes.conteudo} />
        <DimensaoRow title="Completude" dim={avaliacao.dimensoes.completude} />
        <DimensaoRow title="Coerência" dim={avaliacao.dimensoes.coerencia} />
      </div>

      {(avaliacao.omissoes.length > 0 || avaliacao.errosConceituais.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {avaliacao.omissoes.length > 0 && (
            <div className="rounded-xl p-3 bg-[#D4A373]/10 border border-[#D4A373]/25">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#C19262] dark:text-[#E0A96D] mb-1.5">
                🟡 Poderia melhorar
              </p>
              <ul className="space-y-1">
                {avaliacao.omissoes.map((o, i) => (
                  <li key={i} className="text-xs text-[#242A20] dark:text-[#F3F1EC]">
                    • {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {avaliacao.errosConceituais.length > 0 && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5">
                🔴 Erros conceituais
              </p>
              <ul className="space-y-1">
                {avaliacao.errosConceituais.map((e, i) => (
                  <li key={i} className="text-xs text-[#242A20] dark:text-[#F3F1EC]">
                    • {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {avaliacao.conceitosCorretos.length > 0 && (
        <div className="rounded-xl p-3 bg-[#2E6F40]/5 border border-[#2E6F40]/15">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E6F40] dark:text-[#9CB386] mb-1.5">
            🟢 Conceitos corretos
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {avaliacao.conceitosCorretos.map((c, i) => (
              <li
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(f.depois || f.dica) && (
        <div className="rounded-xl p-3 bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#9CB386]">
            💬 Como melhorar sua resposta
          </p>
          {f.antes && f.depois && (
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-[#8C897E] dark:text-[#9EA399]">Em vez de: </span>
                <span className="italic text-[#5A5A40] dark:text-[#9EA399] line-through decoration-red-400/60">
                  “{f.antes}”
                </span>
              </div>
              <div>
                <span className="text-[#8C897E] dark:text-[#9EA399]">Diga: </span>
                <span className="text-[#242A20] dark:text-[#F3F1EC] font-medium">
                  “{f.depois}”
                </span>
              </div>
            </div>
          )}
          {!f.depois && f.dica && (
            <p className="text-xs text-[#242A20] dark:text-[#F3F1EC]">{f.dica}</p>
          )}
          {f.depois && f.dica && (
            <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399]">{f.dica}</p>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-[#5A5A40] dark:text-[#9EA399] italic border-l-2 border-[#2E6F40]/40 pl-3">
        {avaliacao.feedbackOral}
      </p>
    </div>
  );
}
