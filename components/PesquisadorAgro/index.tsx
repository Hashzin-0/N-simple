'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import PesquisadorFontesCard, { type FontesSearchProgress } from './PesquisadorFontesCard';
import PortaisConfiaveisSection from './PortaisConfiaveisSection';
import PesquisadorAutomaticoSection from './PesquisadorAutomaticoSection';
import { ScientificSource } from './types';
import { useEvidenceMemory } from '@/hooks/useEvidenceMemory';

export interface PesqSourcesReport {
  tema: string;
  total: number;
  sources: Array<{ titulo: string; portal: string; ano: number | null }>;
}

export interface PesqArticleReport {
  titulo: string;
  tema: string;
  resumo: string;
  referencias: string[];
}

interface PesquisadorAgroProps {
  isDark?: boolean;
  /** Pedido de busca de fontes (voz); seq monotônico evita re-execução. */
  pendingSearch?: { seq: number; theme: string } | null;
  /** Pedido de geração de artigo ABNT (voz). */
  pendingArticle?: { seq: number; theme?: string; mode?: 'padrao' | 'aprofundado' } | null;
  /** Reporta as fontes encontradas na última busca (para a voz ler). */
  onSourcesReport?: (report: PesqSourcesReport) => void;
  /** Reporta o artigo ABNT gerado (para a voz ler/copiar). */
  onArticleReport?: (report: PesqArticleReport) => void;
  /** Espelha o progresso da busca (portal a portal) para o header da voz. */
  onSearchProgress?: (progress: FontesSearchProgress) => void;
}

export default function PesquisadorAgro({
  isDark = false,
  pendingSearch,
  pendingArticle,
  onSourcesReport,
  onArticleReport,
  onSearchProgress,
}: PesquisadorAgroProps) {
  const [currentTheme, setCurrentTheme] = useState<string>('');
  const { cachedSources, saveSources } = useEvidenceMemory();

  // Mantém refs atualizadas para callbacks não estabilizados
  const onSourcesReportRef = useRef(onSourcesReport);
  useEffect(() => {
    onSourcesReportRef.current = onSourcesReport;
  }, [onSourcesReport]);
  const onArticleReportRef = useRef(onArticleReport);
  useEffect(() => {
    onArticleReportRef.current = onArticleReport;
  }, [onArticleReport]);

  const handleSourcesLoaded = useCallback(
    async (sources: ScientificSource[]) => {
      if (currentTheme) {
        // Persiste só no localStorage. A indexação Supabase + re-entendimento
        // semântico já acontecem no servidor, dentro de searchSources
        // (orquestrador usado pelo stream de pesquisador-fontes e pelo artigo).
        // A chamada antiga a indexEvidence re-entendia as mesmas fontes e
        // estourava o orçamento RPM de embeddings.
        saveSources(currentTheme, sources);
      }
      onSourcesReportRef.current?.({
        tema: currentTheme,
        total: sources.length,
        sources: sources.slice(0, 25).map((s) => ({
          titulo: s.title,
          portal: s.sourceName,
          ano: typeof s.year === 'number' ? s.year : null,
        })),
      });
    },
    [currentTheme, saveSources]
  );

  const handleSendToAutomatic = (newTheme: string) => {
    setCurrentTheme(newTheme);
    const autoSection = document.getElementById('pesquisador_automatico');
    if (autoSection) {
      autoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleArticleReport = useCallback(
    (report: PesqArticleReport) => {
      onArticleReportRef.current?.(report);
    },
    []
  );

  return (
    <div className="w-full space-y-8 max-w-7xl mx-auto">
      {/* 1. ANTES DA SESSÃO: PESQUISADOR DE FONTES & ARTIGOS CIENTÍFICOS */}
      <PesquisadorFontesCard
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        onSendToAutomaticResearcher={handleSendToAutomatic}
        onSourcesLoaded={handleSourcesLoaded}
        pendingSearch={pendingSearch ?? null}
        onSearchProgress={onSearchProgress}
        isDark={isDark}
      />

      {/* 2. SESSÃO: PORTAIS & ACERVOS CONFIÁVEIS (Semantic Scholar, SciELO, Embrapa, etc.) */}
      <PortaisConfiaveisSection
        currentTheme={currentTheme}
        isDark={isDark}
      />

      {/* 3. APÓS OS SITES CONFIÁVEIS: PESQUISADOR AUTOMÁTICO (CRUZAMENTO DE 3+ FONTES, PRÁTICAS OBSOLETAS E ARTIGO ABNT) */}
      <PesquisadorAutomaticoSection
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        existingSources={cachedSources?.sources}
        existingTheme={cachedSources?.theme}
        pendingRun={pendingArticle ?? null}
        onArticleReport={handleArticleReport}
        isDark={isDark}
      />
    </div>
  );
}
