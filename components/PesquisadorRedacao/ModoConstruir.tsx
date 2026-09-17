'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import type {
  RedacaoResearchContext,
  RedacaoEstrutura,
  ExpressionCategoria,
} from './types';
import RepertorioBanco from './RepertorioBanco';
import ExpressionBank from './ExpressionBank';

interface ModoConstruirProps {
  context: RedacaoResearchContext;
  onGerar: (estrutura: RedacaoEstrutura) => void;
  isLoading?: boolean;
}

type PassoConstruir = 'contextualizacao' | 'tese' | 'argumento1' | 'argumento2' | 'argumento3' | 'conclusao';

const PASSOS: { chave: PassoConstruir; label: string }[] = [
  { chave: 'contextualizacao', label: 'Contextualização' },
  { chave: 'tese', label: 'Tese' },
  { chave: 'argumento1', label: 'Argumento 1' },
  { chave: 'argumento2', label: 'Argumento 2' },
  { chave: 'argumento3', label: 'Argumento 3 (opcional)' },
  { chave: 'conclusao', label: 'Conclusão' },
];

export default function ModoConstruir({ context, onGerar, isLoading }: ModoConstruirProps) {
  const [passoAtual, setPassoAtual] = useState(0);
  const [selecionadosRepertorio, setSelecionadosRepertorio] = useState<Set<string>>(new Set());
  const [selecionadasExpressoes, setSelecionadasExpressoes] = useState<Map<ExpressionCategoria, Set<number>>>(new Map());
  const [textos, setTextos] = useState<Record<string, string>>({});

  const handleToggleRepertorio = useCallback((id: string) => {
    setSelecionadosRepertorio(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleExpressao = useCallback((categoria: ExpressionCategoria, index: number) => {
    setSelecionadasExpressoes(prev => {
      const next = new Map(prev);
      const current = next.get(categoria) || new Set();
      const nextSet = new Set(current);
      if (nextSet.has(index)) nextSet.delete(index);
      else nextSet.add(index);
      next.set(categoria, nextSet);
      return next;
    });
  }, []);

  const handleTextoChange = useCallback((chave: string, valor: string) => {
    setTextos(prev => ({ ...prev, [chave]: valor }));
  }, []);

  const repertorioSelecionado = useMemo(() =>
    context.repertorio.filter(r => selecionadosRepertorio.has(r.id)),
    [context.repertorio, selecionadosRepertorio]
  );

  const handleGerar = useCallback(() => {
    const estrutura: RedacaoEstrutura = {
      introducao: {
        conteudo: textos.contextualizacao || '',
        tese: textos.tese || '',
        argumentos: [textos.argumento1 || '', textos.argumento2 || ''],
      },
      desenvolvimentos: [
        {
          tipo: 'desenvolvimento',
          numero: 1,
          argumento: textos.argumento1 || '',
          topicoFrasal: '',
          explicacao: '',
          repertorio: repertorioSelecionado.filter(r => r.argumentosRelacionados.some(a => textos.argumento1?.includes(a))).map(r => r.conteudo),
          relacaoComTema: '',
          conclusaoParcial: '',
        },
        {
          tipo: 'desenvolvimento',
          numero: 2,
          argumento: textos.argumento2 || '',
          topicoFrasal: '',
          explicacao: '',
          repertorio: repertorioSelecionado.filter(r => r.argumentosRelacionados.some(a => textos.argumento2?.includes(a))).map(r => r.conteudo),
          relacaoComTema: '',
          conclusaoParcial: '',
        },
      ],
      conclusao: { conteudo: textos.conclusao || '' },
      temTerceiroDesenvolvimento: false,
    };

    onGerar(estrutura);
  }, [textos, repertorioSelecionado, onGerar]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">
        Modo Construir
      </h3>

      {/* Progresso */}
      <div className="flex items-center gap-1">
        {PASSOS.map((p, i) => (
          <React.Fragment key={p.chave}>
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                i < passoAtual
                  ? 'bg-[#2E6F40] dark:bg-[#9CB386]'
                  : i === passoAtual
                    ? 'bg-[#D4A373]'
                    : 'bg-[#E5E2D9] dark:bg-[#3A4235]'
              }`}
            />
            {i < PASSOS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < passoAtual ? 'bg-[#2E6F40] dark:bg-[#9CB386]' : 'bg-[#E5E2D9] dark:bg-[#3A4235]'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="text-xs text-[#8C897E] dark:text-[#9EA399]">
        Passo {passoAtual + 1} de {PASSOS.length}: {PASSOS[passoAtual].label}
      </div>

      {/* Conteúdo do passo */}
      <div className="min-h-[200px]">
        {passoAtual === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
              Escolha uma expressão de contextualização ou escreva sua própria versão:
            </p>
            <ExpressionBank
              expressoes={context.expressoes.filter(e => e.categoria === 'contextualizacao')}
              selecionadas={selecionadasExpressoes}
              onToggle={handleToggleExpressao}
              modoConstruir
            />
            <textarea
              value={textos.contextualizacao || ''}
              onChange={(e) => handleTextoChange('contextualizacao', e.target.value)}
              placeholder="Ou escreva sua contextualização aqui..."
              className="w-full px-3 py-2 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-1 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] resize-none"
              rows={3}
            />
          </div>
        )}

        {passoAtual === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
              Defina a tese central da sua redação:
            </p>
            <textarea
              value={textos.tese || ''}
              onChange={(e) => handleTextoChange('tese', e.target.value)}
              placeholder="Ex.: Diante desses desafios, é necessário..."
              className="w-full px-3 py-2 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-1 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] resize-none"
              rows={2}
            />
          </div>
        )}

        {(passoAtual === 2 || passoAtual === 3) && (
          <div className="space-y-3">
            <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
              Selecione repertório e escreva o argumento {passoAtual === 2 ? '1' : '2'}:
            </p>
            <RepertorioBanco
              repertorio={context.repertorio}
              selecionados={selecionadosRepertorio}
              onToggle={handleToggleRepertorio}
              modoConstruir
            />
            <textarea
              value={textos[`argumento${passoAtual === 2 ? '1' : '2'}`] || ''}
              onChange={(e) => handleTextoChange(`argumento${passoAtual === 2 ? '1' : '2'}`, e.target.value)}
              placeholder={`Descreva o argumento ${passoAtual === 2 ? '1' : '2'}...`}
              className="w-full px-3 py-2 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-1 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] resize-none"
              rows={3}
            />
          </div>
        )}

        {passoAtual === 4 && (
          <div className="space-y-3">
            <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
              O terceiro argumento é opcional. Pule se não houver um terceiro eixo relevante.
            </p>
            <textarea
              value={textos.argumento3 || ''}
              onChange={(e) => handleTextoChange('argumento3', e.target.value)}
              placeholder="Argumento 3 (opcional)..."
              className="w-full px-3 py-2 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-1 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] resize-none"
              rows={3}
            />
          </div>
        )}

        {passoAtual === 5 && (
          <div className="space-y-3">
            <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
              Escolha uma expressão de conclusão ou escreva sua própria:
            </p>
            <ExpressionBank
              expressoes={context.expressoes.filter(e => e.categoria === 'conclusao')}
              selecionadas={selecionadasExpressoes}
              onToggle={handleToggleExpressao}
              modoConstruir
            />
            <textarea
              value={textos.conclusao || ''}
              onChange={(e) => handleTextoChange('conclusao', e.target.value)}
              placeholder="Escreva sua conclusão..."
              className="w-full px-3 py-2 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#3A4235] text-sm text-[#242A20] dark:text-[#F3F1EC] placeholder-[#8C897E] dark:placeholder-[#9EA399] focus:outline-none focus:ring-1 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPassoAtual(p => Math.max(0, p - 1))}
          disabled={passoAtual === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-[#8C897E] dark:text-[#9EA399] hover:bg-[#F3F1EC] dark:hover:bg-[#2C3328] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Anterior
        </button>

        {passoAtual < PASSOS.length - 1 ? (
          <button
            onClick={() => setPassoAtual(p => Math.min(PASSOS.length - 1, p + 1))}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] hover:bg-[#245A33] dark:hover:bg-[#8AB87A] transition-colors"
          >
            Próximo
            <ChevronRight className="size-3.5" />
          </button>
        ) : (
          <button
            onClick={handleGerar}
            disabled={isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-medium bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Gerando...' : 'Gerar Redação'}
            <Check className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
