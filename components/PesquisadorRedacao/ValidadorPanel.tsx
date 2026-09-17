'use client';

import React, { useState } from 'react';
import { Shield, Check, AlertTriangle, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { ValidacaoResult, ValidacaoItem } from './types';

interface ValidadorPanelProps {
  validacao: ValidacaoResult | null;
  onRevalidar?: () => void;
  isRevalidating?: boolean;
  onVerProblema?: (trecho: string) => void;
}

const CATEGORIA_ICONS: Record<string, React.ReactNode> = {
  estrutura: <Shield className="size-3.5" />,
  coerencia: <Check className="size-3.5" />,
  coesao: <AlertTriangle className="size-3.5" />,
  repertorio: <Check className="size-3.5" />,
  fontes: <X className="size-3.5" />,
};

export default function ValidadorPanel({ validacao, onRevalidar, isRevalidating, onVerProblema }: ValidadorPanelProps) {
  const [expandido, setExpandido] = useState<Set<number>>(new Set());

  if (!validacao) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <Shield className="size-4" />
          Validador
        </h3>
        <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
          A validação será executada automaticamente após a geração.
        </p>
      </div>
    );
  }

  const { resumo, itens } = validacao;

  // Agrupa por categoria
  const categorias = itens.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<string, ValidacaoItem[]>);

  const toggleExpand = (idx: number) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <Shield className="size-4" />
          Validador
        </h3>
        {onRevalidar && (
          <button
            onClick={onRevalidar}
            disabled={isRevalidating}
            className="text-[10px] px-2 py-1 rounded-lg bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399] hover:bg-[#E5E2D9] dark:hover:bg-[#3A4235] disabled:opacity-50 transition-colors"
          >
            {isRevalidating ? 'Re-validando...' : 'Re-validar'}
          </button>
        )}
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328]">
        <div className="flex items-center gap-1.5">
          <Check className="size-3.5 text-[#2E6F40] dark:text-[#9CB386]" />
          <span className="text-xs text-[#2E6F40] dark:text-[#9CB386]">{resumo.ok} ok</span>
        </div>
        {resumo.warnings > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-[#D4A373]" />
            <span className="text-xs text-[#D4A373]">{resumo.warnings} avisos</span>
          </div>
        )}
        {resumo.errors > 0 && (
          <div className="flex items-center gap-1.5">
            <X className="size-3.5 text-red-500" />
            <span className="text-xs text-red-500">{resumo.errors} erros</span>
          </div>
        )}
      </div>

      {/* Itens por categoria */}
      <div className="space-y-1.5">
        {Object.entries(categorias).map(([categoria, items]) => {
          const hasIssues = items.some(i => i.status !== 'ok');
          const errorCount = items.filter(i => i.status === 'error').length;
          const warnCount = items.filter(i => i.status === 'warning').length;

          return (
            <div key={categoria} className="rounded-xl border border-[#E5E2D9] dark:border-[#3A4235] overflow-hidden">
              <button
                onClick={() => toggleExpand(items[0] ? itens.indexOf(items[0]) : 0)}
                className="w-full px-3 py-2 flex items-center justify-between bg-white dark:bg-[#1C201A] hover:bg-[#F3F1EC] dark:hover:bg-[#2C3328] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`${errorCount > 0 ? 'text-red-500' : warnCount > 0 ? 'text-[#D4A373]' : 'text-[#2E6F40] dark:text-[#9CB386]'}`}>
                    {CATEGORIA_ICONS[categoria]}
                  </span>
                  <span className="text-xs font-medium text-[#242A20] dark:text-[#F3F1EC] capitalize">
                    {categoria}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {errorCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                      {errorCount}
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#D4A373]/10 text-[#D4A373] font-medium">
                      {warnCount}
                    </span>
                  )}
                  {!hasIssues && (
                    <Check className="size-3.5 text-[#2E6F40] dark:text-[#9CB386]" />
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Detalhes dos problemas */}
      {itens.filter(i => i.status !== 'ok').length > 0 && (
        <div className="space-y-1.5">
          {itens.filter(i => i.status !== 'ok').map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg text-xs ${
                item.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-[#D4A373]/10 dark:bg-[#D4A373]/5 border border-[#D4A373]/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={`font-medium ${item.status === 'error' ? 'text-red-700 dark:text-red-400' : 'text-[#D4A373]'}`}>
                    {item.explicacao}
                  </p>
                  {item.trecho && (
                    <p className="mt-1 text-[11px] text-[#8C897E] dark:text-[#9EA399] italic">
                      &ldquo;{item.trecho}&rdquo;
                    </p>
                  )}
                  {item.sugestao && (
                    <p className="mt-1 text-[11px] text-[#2E6F40] dark:text-[#9CB386]">
                      Sugestão: {item.sugestao}
                    </p>
                  )}
                </div>
                {item.trecho && onVerProblema && (
                  <button
                    onClick={() => onVerProblema(item.trecho!)}
                    className="text-[10px] px-2 py-1 rounded bg-[#2E6F40]/10 dark:bg-[#9CB386]/10 text-[#2E6F40] dark:text-[#9CB386] hover:bg-[#2E6F40]/20 dark:hover:bg-[#9CB386]/20 transition-colors shrink-0"
                  >
                    Ver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
