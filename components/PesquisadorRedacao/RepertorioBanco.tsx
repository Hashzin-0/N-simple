'use client';

import React, { useState, useCallback } from 'react';
import { Check, ExternalLink, AlertTriangle } from 'lucide-react';
import type { RepertorioItem, RepertorioTipo } from './types';

interface RepertorioBancoProps {
  repertorio: RepertorioItem[];
  selecionados: Set<string>;
  onToggle: (id: string) => void;
  modoConstruir?: boolean;
}

const TIPO_LABELS: Record<RepertorioTipo, { label: string; emoji: string }> = {
  conceito: { label: 'Conceito', emoji: '📘' },
  dado: { label: 'Dado', emoji: '📊' },
  autor: { label: 'Autor', emoji: '👤' },
  fato_historico: { label: 'Fato Histórico', emoji: '📜' },
  exemplo: { label: 'Exemplo', emoji: '💡' },
  argumento: { label: 'Argumento', emoji: '⚡' },
  contraponto: { label: 'Contraponto', emoji: '🔄' },
  causa: { label: 'Causa', emoji: '🔍' },
  consequencia: { label: 'Consequência', emoji: '📈' },
};

export default function RepertorioBanco({ repertorio, selecionados, onToggle, modoConstruir }: RepertorioBancoProps) {
  const [filtro, setFiltro] = useState<RepertorioTipo | 'todos'>('todos');

  const filtrados = filtro === 'todos'
    ? repertorio
    : repertorio.filter(r => r.tipo === filtro);

  const contagemPorTipo = repertorio.reduce((acc, r) => {
    acc[r.tipo] = (acc[r.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">
          Repertório Disponível
        </h3>
        <span className="text-xs text-[#8C897E] dark:text-[#9EA399]">
          {repertorio.length} itens
          {modoConstruir && selecionados.size > 0 && ` · ${selecionados.size} selecionados`}
        </span>
      </div>

      {/* Filtros por tipo */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFiltro('todos')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            filtro === 'todos'
              ? 'bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A]'
              : 'bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399] hover:bg-[#E5E2D9] dark:hover:bg-[#3A4235]'
          }`}
        >
          Todos ({repertorio.length})
        </button>
        {Object.entries(TIPO_LABELS).map(([tipo, { label, emoji }]) => {
          const count = contagemPorTipo[tipo] || 0;
          if (count === 0) return null;
          return (
            <button
              key={tipo}
              onClick={() => setFiltro(tipo as RepertorioTipo)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filtro === tipo
                  ? 'bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A]'
                  : 'bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399] hover:bg-[#E5E2D9] dark:hover:bg-[#3A4235]'
              }`}
            >
              {emoji} {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista de itens */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filtrados.map((item) => {
          const { label, emoji } = TIPO_LABELS[item.tipo];
          const isSelected = selecionados.has(item.id);

          return (
            <div
              key={item.id}
              onClick={() => modoConstruir && onToggle(item.id)}
              className={`p-3 rounded-xl border transition-all ${
                modoConstruir ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'border-[#2E6F40] dark:border-[#9CB386] bg-[#2E6F40]/5 dark:bg-[#9CB386]/10'
                  : 'border-[#E5E2D9] dark:border-[#3A4235] bg-white dark:bg-[#1C201A] hover:border-[#2E6F40]/50 dark:hover:border-[#9CB386]/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{emoji}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#8C897E] dark:text-[#9EA399]">
                      {label}
                    </span>
                    {item.verificacao.status === 'verified' && (
                      <Check className="size-3 text-[#2E6F40] dark:text-[#9CB386]" />
                    )}
                    {item.verificacao.status === 'needs_review' && (
                      <AlertTriangle className="size-3 text-[#D4A373]" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#242A20] dark:text-[#F3F1EC] mb-1">
                    {item.titulo}
                  </p>
                  <p className="text-xs text-[#8C897E] dark:text-[#9EA399] line-clamp-2">
                    {item.conteudo}
                  </p>
                  {item.aplicacoes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.aplicacoes.slice(0, 3).map((app, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399]">
                          {app}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.fonteTitulo && (
                    <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399] flex items-center gap-0.5 max-w-[120px] truncate">
                      <ExternalLink className="size-2.5 shrink-0" />
                      {item.fonteTitulo}
                    </span>
                  )}
                  {isSelected && (
                    <div className="size-5 rounded-full bg-[#2E6F40] dark:bg-[#9CB386] flex items-center justify-center">
                      <Check className="size-3 text-white dark:text-[#1C201A]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
