'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface ModoAutomaticoProps {
  onStart: () => void;
  isActive: boolean;
  progresso: { etapa: string; mensagem: string }[];
  error?: string | null;
}

const ETAPAS = [
  { chave: 'pesquisa', label: 'Pesquisando fontes científicas' },
  { chave: 'repertorio', label: 'Extraindo repertório' },
  { chave: 'expressoes', label: 'Gerando expressões' },
  { chave: 'estrutura', label: 'Planejando estrutura' },
  { chave: 'redacao', label: 'Redigindo texto' },
  { chave: 'validacao', label: 'Validando redação' },
];

export default function ModoAutomatico({ onStart, isActive, progresso, error }: ModoAutomaticoProps) {
  const progressoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressoRef.current) {
      progressoRef.current.scrollTop = progressoRef.current.scrollHeight;
    }
  }, [progresso]);

  const getEtapaStatus = useCallback((chave: string) => {
    const etapasConcluidas = progresso.filter(p =>
      p.etapa.endsWith('_completa') || p.etapa.endsWith('_completas') || p.etapa === 'done'
    ).map(p => p.etapa.replace('_completa', '').replace('_completas', ''));

    if (etapasConcluidas.includes(chave)) return 'concluido';

    const etapaAtual = progresso[progresso.length - 1];
    if (etapaAtual && etapaAtual.etapa === chave) return 'em_andamento';

    return 'pendente';
  }, [progresso]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">
          Modo Automático
        </h3>
        {!isActive && (
          <button
            onClick={onStart}
            className="px-4 py-2 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-xs font-medium hover:bg-[#245A33] dark:hover:bg-[#8AB87A] transition-colors"
          >
            Iniciar Pesquisa
          </button>
        )}
      </div>

      {isActive && (
        <div className="space-y-2">
          {ETAPAS.map((etapa) => {
            const status = getEtapaStatus(etapa.chave);
            return (
              <div
                key={etapa.chave}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#F3F1EC] dark:bg-[#2C3328]"
              >
                {status === 'concluido' && (
                  <Check className="size-4 text-[#2E6F40] dark:text-[#9CB386] shrink-0" />
                )}
                {status === 'em_andamento' && (
                  <Loader2 className="size-4 text-[#D4A373] animate-spin shrink-0" />
                )}
                {status === 'pendente' && (
                  <div className="size-4 rounded-full border-2 border-[#E5E2D9] dark:border-[#3A4235] shrink-0" />
                )}
                <span className={`text-xs ${
                  status === 'concluido'
                    ? 'text-[#2E6F40] dark:text-[#9CB386]'
                    : status === 'em_andamento'
                      ? 'text-[#242A20] dark:text-[#F3F1EC] font-medium'
                      : 'text-[#8C897E] dark:text-[#9EA399]'
                }`}>
                  {etapa.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
