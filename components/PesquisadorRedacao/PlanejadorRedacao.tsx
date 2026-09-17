'use client';

import React from 'react';
import { Layers, Plus, Minus } from 'lucide-react';
import type { RedacaoEstrutura } from './types';

interface PlanejadorRedacaoProps {
  estrutura: RedacaoEstrutura | null;
  onGerar?: () => void;
  isLoading?: boolean;
}

export default function PlanejadorRedacao({ estrutura, onGerar, isLoading }: PlanejadorRedacaoProps) {
  if (!estrutura) {
    return (
      <div id="redacao_estrutura" className="space-y-4">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <Layers className="size-4" />
          Estrutura da Redação
        </h3>
        <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
          A estrutura será gerada após a pesquisa de fontes.
        </p>
      </div>
    );
  }

  const numDesenvolvimentos = estrutura.desenvolvimentos.length;

  return (
    <div id="redacao_estrutura" className="space-y-4">
      <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
        <Layers className="size-4" />
        Estrutura da Redação
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399] font-normal">
          {numDesenvolvimentos + 2} parágrafos
        </span>
      </h3>

      <div className="space-y-2">
        {/* Introdução */}
        <div className="p-3 rounded-xl bg-[#2E6F40]/5 dark:bg-[#9CB386]/10 border border-[#2E6F40]/20 dark:border-[#9CB386]/20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E6F40] dark:text-[#9CB386]">
              Introdução
            </span>
          </div>
          <p className="text-xs text-[#242A20] dark:text-[#F3F1EC] line-clamp-2">
            {estrutura.introducao.tese}
          </p>
          {estrutura.introducao.argumentos.length > 0 && (
            <div className="mt-1.5 flex gap-1.5">
              {estrutura.introducao.argumentos.map((arg, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2E6F40]/10 dark:bg-[#9CB386]/15 text-[#2E6F40] dark:text-[#9CB386]">
                  Arg {String.fromCharCode(65 + i)}: {arg}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Desenvolvimentos */}
        {estrutura.desenvolvimentos.map((dev) => (
          <div key={dev.numero} className="p-3 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4A373]">
                Desenvolvimento {dev.numero}
              </span>
            </div>
            <p className="text-xs font-medium text-[#242A20] dark:text-[#F3F1EC] mb-1">
              {dev.topicoFrasal}
            </p>
            <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] line-clamp-2">
              {dev.explicacao}
            </p>
            {dev.repertorio.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {dev.repertorio.slice(0, 2).map((r, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4A373]/10 text-[#D4A373]">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Conclusão */}
        <div className="p-3 rounded-xl bg-[#2E6F40]/5 dark:bg-[#9CB386]/10 border border-[#2E6F40]/20 dark:border-[#9CB386]/20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E6F40] dark:text-[#9CB386]">
              Conclusão
            </span>
          </div>
          <p className="text-xs text-[#242A20] dark:text-[#F3F1EC] line-clamp-2">
            {estrutura.conclusao.conteudo}
          </p>
        </div>
      </div>

      {onGerar && (
        <button
          onClick={onGerar}
          disabled={isLoading}
          className="w-full px-4 py-3 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] font-medium text-sm hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Gerando...' : 'Gerar Redação'}
        </button>
      )}
    </div>
  );
}
