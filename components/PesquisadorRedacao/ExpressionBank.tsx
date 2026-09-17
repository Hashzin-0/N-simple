'use client';

import React, { useState } from 'react';
import { Check, BookOpen } from 'lucide-react';
import type { ExpressionGroup, ExpressionCategoria } from './types';

interface ExpressionBankProps {
  expressoes: ExpressionGroup[];
  selecionadas: Map<ExpressionCategoria, Set<number>>;
  onToggle: (categoria: ExpressionCategoria, index: number) => void;
  modoConstruir?: boolean;
}

const CATEGORIA_LABELS: Record<ExpressionCategoria, { label: string; emoji: string }> = {
  contextualizacao: { label: 'Contextualização', emoji: '🌍' },
  problema: { label: 'Problema', emoji: '⚠️' },
  argumento: { label: 'Argumento', emoji: '⚡' },
  contraposicao: { label: 'Contraposição', emoji: '🔄' },
  conclusao: { label: 'Conclusão', emoji: '🏁' },
};

export default function ExpressionBank({ expressoes, selecionadas, onToggle, modoConstruir }: ExpressionBankProps) {
  const [expandida, setExpandida] = useState<ExpressionCategoria | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <BookOpen className="size-4" />
          Expressões e Conectivos
        </h3>
        {modoConstruir && (
          <span className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            {[...selecionadas.values()].reduce((acc, s) => acc + s.size, 0)} selecionadas
          </span>
        )}
      </div>

      <div className="space-y-2">
        {expressoes.map((grupo) => {
          const { label, emoji } = CATEGORIA_LABELS[grupo.categoria];
          const isExpandida = expandida === grupo.categoria;
          const selecionadasNesta = selecionadas.get(grupo.categoria) || new Set();

          return (
            <div
              key={grupo.categoria}
              className="rounded-xl border border-[#E5E2D9] dark:border-[#3A4235] overflow-hidden"
            >
              <button
                onClick={() => setExpandida(isExpandida ? null : grupo.categoria)}
                className="w-full px-4 py-3 flex items-center justify-between bg-[#F3F1EC] dark:bg-[#2C3328] hover:bg-[#E5E2D9] dark:hover:bg-[#3A4235] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{emoji}</span>
                  <span className="text-sm font-medium text-[#242A20] dark:text-[#F3F1EC]">
                    {label}
                  </span>
                  {selecionadasNesta.size > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] font-medium">
                      {selecionadasNesta.size}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#8C897E] dark:text-[#9EA399] italic">
                  {grupo.funcao}
                </span>
              </button>

              {isExpandida && (
                <div className="px-4 py-3 space-y-1.5 bg-white dark:bg-[#1C201A]">
                  <p className="text-xs text-[#8C897E] dark:text-[#9EA399] mb-2 italic">
                    Função: {grupo.funcao}
                  </p>
                  {grupo.opcoes.map((opcao, idx) => {
                    const isSelected = selecionadasNesta.has(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => modoConstruir && onToggle(grupo.categoria, idx)}
                        className={`px-3 py-2 rounded-lg text-sm transition-all ${
                          modoConstruir ? 'cursor-pointer' : ''
                        } ${
                          isSelected
                            ? 'bg-[#2E6F40]/10 dark:bg-[#9CB386]/15 border border-[#2E6F40] dark:border-[#9CB386] text-[#242A20] dark:text-[#F3F1EC]'
                            : 'bg-[#F3F1EC] dark:bg-[#2C3328] border border-transparent text-[#242A20] dark:text-[#F3F1EC] hover:border-[#2E6F40]/30 dark:hover:border-[#9CB386]/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="italic">&ldquo;{opcao}&rdquo;</span>
                          {isSelected && (
                            <Check className="size-3.5 text-[#2E6F40] dark:text-[#9CB386] shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
