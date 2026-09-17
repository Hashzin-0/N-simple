'use client';

import React, { useState, useCallback, useRef } from 'react';
import { PenTool, RotateCcw, Wand2, Hammer } from 'lucide-react';
import { useRedacaoState } from '@/hooks/useRedacaoState';
import TemaInput from './TemaInput';
import RepertorioBanco from './RepertorioBanco';
import ExpressionBank from './ExpressionBank';
import PlanejadorRedacao from './PlanejadorRedacao';
import RedacaoGerada from './RedacaoGerada';
import ValidadorPanel from './ValidadorPanel';
import ModoConstruir from './ModoConstruir';
import ModoAutomatico from './ModoAutomatico';
import type { RedacaoResearchContext, RedacaoEstrutura, ExpressionCategoria } from './types';

interface PesquisadorRedacaoProps {
  isDark?: boolean;
}

export default function PesquisadorRedacao({ isDark }: PesquisadorRedacaoProps) {
  const {
    state,
    setTema,
    setModo,
    setPasso,
    setContext,
    setEstrutura,
    updateSecao,
    setRedacao,
    setValidacao,
    setLoading,
    setError,
    reset,
  } = useRedacaoState();

  const [progresso, setProgresso] = useState<{ etapa: string; mensagem: string }[]>([]);
  const [selecionadosRepertorio, setSelecionadosRepertorio] = useState<Set<string>>(new Set());
  const [selecionadasExpressoes, setSelecionadasExpressoes] = useState<Map<ExpressionCategoria, Set<number>>>(new Map());
  const [isRevalidating, setIsRevalidating] = useState(false);

  const handlePesquisar = useCallback(async (tema: string) => {
    setTema(tema);
    setLoading(true);
    setPasso('pesquisa');
    setProgresso([]);

    try {
      const response = await fetch('/api/gemini/redacao-pesquisa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema }),
      });

      if (!response.ok) throw new Error('Falha na pesquisa');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Sem stream de resposta');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const { event, data } = JSON.parse(line.slice(6));

              if (event === 'progress') {
                setProgresso(prev => [...prev, { etapa: data.etapa, mensagem: data.mensagem }]);
              }

              if (event === 'complete') {
                const ctx: RedacaoResearchContext = data.context;
                setContext(ctx);
                setPasso('repertorio');
              }

              if (event === 'error') {
                setError(data.message);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [setTema, setLoading, setPasso, setContext, setError]);

  const handleGerarAutomatico = useCallback(async () => {
    if (!state.context) return;

    setLoading(true);
    setPasso('redacao');
    setProgresso([]);

    try {
      const response = await fetch('/api/gemini/redacao-gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: state.context,
          modo: 'automatico',
        }),
      });

      if (!response.ok) throw new Error('Falha na geração');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Sem stream de resposta');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const { event, data } = JSON.parse(line.slice(6));

              if (event === 'progress') {
                setProgresso(prev => [...prev, { etapa: data.etapa, mensagem: data.mensagem }]);
              }

              if (event === 'chunk') {
                fullText += data.text;
                setRedacao(fullText);
              }

              if (event === 'structure_ready') {
                setEstrutura(data.estrutura);
              }

              if (event === 'validacao_pronta') {
                setValidacao(data.validacao);
              }

              if (event === 'error') {
                setError(data.message);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [state.context, setLoading, setPasso, setRedacao, setEstrutura, setValidacao, setError]);

  const handleGerarConstruir = useCallback(async (estrutura: RedacaoEstrutura) => {
    if (!state.context) return;

    setLoading(true);
    setPasso('redacao');

    try {
      const response = await fetch('/api/gemini/redacao-gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: state.context,
          modo: 'construir',
          estrutura,
        }),
      });

      if (!response.ok) throw new Error('Falha na geração');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Sem stream de resposta');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const { event, data } = JSON.parse(line.slice(6));

              if (event === 'chunk') {
                fullText += data.text;
                setRedacao(fullText);
              }

              if (event === 'validacao_pronta') {
                setValidacao(data.validacao);
              }

              if (event === 'error') {
                setError(data.message);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [state.context, setLoading, setPasso, setRedacao, setValidacao, setError]);

  const handleRevalidar = useCallback(async () => {
    if (!state.redacao || !state.tema) return;

    setIsRevalidating(true);
    try {
      const response = await fetch('/api/gemini/redacao-validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redacao: state.redacao,
          tema: state.tema,
          fontes: state.context?.fontes || [],
          topics: state.context?.metadata.sourceSnapshot.split('|') || [],
        }),
      });

      if (!response.ok) throw new Error('Falha na revalidação');

      const { validacao } = await response.json();
      setValidacao(validacao);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na revalidação');
    } finally {
      setIsRevalidating(false);
    }
  }, [state.redacao, state.tema, state.context, setValidacao, setError]);

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

  const handleReset = useCallback(() => {
    reset();
    setSelecionadosRepertorio(new Set());
    setSelecionadasExpressoes(new Map());
    setProgresso([]);
  }, [reset]);

  return (
    <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl shadow-sm border border-[#E5E2D9] dark:border-[#2C3328] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div id="redacao_tema" className="flex items-center gap-2">
          <PenTool className="size-5 text-[#2E6F40] dark:text-[#9CB386]" />
          <h2 className="text-lg font-bold text-[#242A20] dark:text-[#F3F1EC]">
            Pesquisador de Redação
          </h2>
        </div>
        {state.passo !== 'tema' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#8C897E] dark:text-[#9EA399] hover:bg-[#F3F1EC] dark:hover:bg-[#2C3328] transition-colors"
          >
            <RotateCcw className="size-3" />
            Recomeçar
          </button>
        )}
      </div>

      {/* Tema Input */}
      <TemaInput
        onPesquisar={handlePesquisar}
        isLoading={state.isLoading && state.passo === 'pesquisa'}
        temaInicial={state.tema}
      />

      {/* Seleção de modo */}
      {state.passo === 'repertorio' && state.context && (
        <div className="space-y-6">
          {/* Repertório */}
          <div id="redacao_repertorio">
            <RepertorioBanco
              repertorio={state.context.repertorio}
              selecionados={selecionadosRepertorio}
              onToggle={handleToggleRepertorio}
            />
          </div>

          {/* Expressões */}
          <div id="redacao_expressoes">
            <ExpressionBank
              expressoes={state.context.expressoes}
              selecionadas={selecionadasExpressoes}
              onToggle={handleToggleExpressao}
            />
          </div>

          {/* Escolha do modo */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setModo('automatico');
                handleGerarAutomatico();
              }}
              disabled={state.isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] font-medium text-sm hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-50 transition-colors"
            >
              <Wand2 className="size-4" />
              Automático
            </button>
            <button
              onClick={() => setModo('construir')}
              disabled={state.isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#F3F1EC] dark:bg-[#2C3328] text-[#242A20] dark:text-[#F3F1EC] font-medium text-sm border border-[#E5E2D9] dark:border-[#3A4235] hover:bg-[#E5E2D9] dark:hover:bg-[#3A4235] disabled:opacity-50 transition-colors"
            >
              <Hammer className="size-4" />
              Construir
            </button>
          </div>

          {/* Modo automático com progresso */}
          {state.modo === 'automatico' && state.isLoading && (
            <ModoAutomatico
              onStart={handleGerarAutomatico}
              isActive={state.isLoading}
              progresso={progresso}
              error={state.error}
            />
          )}
        </div>
      )}

      {/* Modo construir */}
      {state.modo === 'construir' && state.passo === 'repertorio' && state.context && (
        <ModoConstruir
          context={state.context}
          onGerar={handleGerarConstruir}
          isLoading={state.isLoading}
        />
      )}

      {/* Estrutura (após geração) */}
      {state.estrutura && (
        <PlanejadorRedacao estrutura={state.estrutura} />
      )}

      {/* Redação gerada */}
      {state.redacao && (
        <RedacaoGerada
          redacao={state.redacao}
          editable={state.modo === 'construir'}
          onUpdateSecao={(chave, valor) => updateSecao(chave as keyof typeof state.redacaoSecoes, valor)}
        />
      )}

      {/* Validador */}
      {state.validacao && (
        <ValidadorPanel
          validacao={state.validacao}
          onRevalidar={handleRevalidar}
          isRevalidating={isRevalidating}
        />
      )}

      {/* Erro global */}
      {state.error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-400">{state.error}</p>
        </div>
      )}
    </div>
  );
}
