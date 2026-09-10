'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  Search,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  Filter,
  Sparkles,
  ArrowUpRight,
  GraduationCap,
  Video,
  ThumbsUp,
  AlertOctagon,
  Compass,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ScientificSource, SourceType } from './types';
import { computeTrigonometricSimilarity } from './trigonometry';

interface PesquisadorFontesCardProps {
  currentTheme: string;
  onThemeChange: (newTheme: string) => void;
  onSendToAutomaticResearcher: (theme: string) => void;
  isDark: boolean;
}

const TYPE_LABELS: Record<SourceType, string> = {
  artigo_periodico: 'Artigo de Periódico',
  boletim_tecnico: 'Boletim Técnico Embrapa',
  ensaio_cientifico: 'Ensaio Científico',
  tese_dissertacao: 'Tese / Dissertação',
  livro_manual: 'Livro / Manual',
  video_tecnico: 'Vídeo Técnico / Palestra',
};

const SUGGESTIONS = [
  'Gessagem e Subsolo, vantagens e desvantagens',
  'Agroecologia e Manejo Sustentável',
  'Cooperativa x Associativa',
  'Fixação Biológica de Nitrogênio',
  'Plantio Direto e Descontinuação da Aração',
  'Manejo Integrado de Pragas',
];

const ITEMS_PER_PAGE = 10;

export default function PesquisadorFontesCard({
  currentTheme,
  onThemeChange,
  onSendToAutomaticResearcher,
}: PesquisadorFontesCardProps) {
  const [searchTerm, setSearchTerm] = usePersistedState<string>('pesq_fontes_search', '');
  const [prevTheme, setPrevTheme] = useState(currentTheme);
  const [selectedType, setSelectedType] = usePersistedState<string>('pesq_fontes_type', 'todos');
  const [selectedPortal, setSelectedPortal] = usePersistedState<string>('pesq_fontes_portal', 'todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchingLive, setSearchingLive] = useState(false);
  const [dynamicSources, setDynamicSources] = useState<ScientificSource[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync state during render when prop changes
  if (currentTheme !== prevTheme) {
    setPrevTheme(currentTheme);
    setSearchTerm(currentTheme);
  }

  // Sources from real web scraping (via API)
  const allAvailableSources = useMemo(() => {
    return dynamicSources;
  }, [dynamicSources]);

  // Compute trigonometric similarity for all available sources based on current query
  const scoredSources = useMemo(() => {
    const query = searchTerm.trim();
    return allAvailableSources.map((src) => {
      const trig = computeTrigonometricSimilarity(query, src);
      return {
        ...src,
        trigonometricSimilarity: trig,
      };
    });
  }, [allAvailableSources, searchTerm]);

  // Filter and sort by trigonometric similarity descending
  const filteredSources = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const filtered = scoredSources.filter((src) => {
      // Type filter
      if (selectedType !== 'todos' && src.sourceType !== selectedType) {
        return false;
      }
      // Portal filter
      if (selectedPortal !== 'todos') {
        if (selectedPortal === 'Google Acadêmico' && src.sourceName !== 'Google Acadêmico') return false;
        if (selectedPortal === 'Embrapa' && src.sourceName !== 'Embrapa') return false;
        if (selectedPortal === 'SciELO' && src.sourceName !== 'SciELO') return false;
        if (selectedPortal === 'CAPES' && src.sourceName !== 'CAPES') return false;
        if (selectedPortal === 'BDTD' && src.sourceName !== 'BDTD') return false;
        if (selectedPortal === 'YouTube' && src.sourceName !== 'YouTube') return false;
      }

      // If user typed a term, check whether it matches text OR has decent trigonometric similarity
      if (!term) return false;
      const inTitle = src.title.toLowerCase().includes(term);
      const inAbstract = src.abstract.toLowerCase().includes(term);
      const inKeywords = src.keywords.some((k) => k.toLowerCase().includes(term));
      const inAuthors = src.authors.toLowerCase().includes(term);
      const inPub = src.publication.toLowerCase().includes(term);
      
      const queryWords = term
        .split(/[\s,]+/)
        .filter((w) => w.length > 2 && !['para', 'como', 'mais', 'sobre', 'onde', 'vantagens', 'desvantagens'].includes(w));
      const wordMatch = queryWords.length > 0 && queryWords.some((w) =>
        src.title.toLowerCase().includes(w) ||
        src.keywords.some((k) => k.toLowerCase().includes(w))
      );
      const hasDecentCosine = (src.trigonometricSimilarity?.cosTheta ?? 0) >= 0.20;

      return inTitle || inAbstract || inKeywords || inAuthors || inPub || wordMatch || hasDecentCosine;
    });

    // Ordenação decrescente pelo cosseno trigonométrico (cos θ)
    return filtered.sort(
      (a, b) =>
        (b.trigonometricSimilarity?.cosTheta ?? 0) -
        (a.trigonometricSimilarity?.cosTheta ?? 0)
    );
  }, [scoredSources, searchTerm, selectedType, selectedPortal]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSources.length / ITEMS_PER_PAGE);
  const paginatedSources = filteredSources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, selectedPortal]);

  const executeLiveSearch = useCallback(async (query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setSearchingLive(true);
    try {
      const res = await fetch('/api/gemini/pesquisador-fontes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sources && Array.isArray(data.sources)) {
          setDynamicSources(data.sources);
        }
      }
    } catch (err) {
      console.warn('Live portal search error, relying on local curated sources:', err);
    } finally {
      setSearchingLive(false);
    }
  }, []);

  // Run live search on mount and when theme changes externally
  useEffect(() => {
    if (currentTheme) {
      executeLiveSearch(currentTheme);
    }
  }, [currentTheme, executeLiveSearch]);

  // Run live search when theme changes externally or on submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onThemeChange(searchTerm.trim());
      executeLiveSearch(searchTerm.trim());
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion);
    onThemeChange(suggestion);
    executeLiveSearch(suggestion);
  };

  const handleCopyCitation = (source: ScientificSource) => {
    navigator.clipboard.writeText(source.abntCitation);
    setCopiedId(source.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div id="pesquisador_fontes" className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#2E6F40]/15 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386] border border-[#2E6F40]/25 shrink-0">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E8E7DF]">
                  Pesquisador de Fontes Científicas
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386]">
                  Google Acadêmico • SciELO • Embrapa • CAPES • BDTD • YouTube
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
                Pesquisa unificada em todos os repositórios oficiais e canais técnicos do YouTube com classificação por <strong>Similaridade Trigonométrica (cos θ)</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH INPUT BAR */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-[#8C897E] dark:text-[#9EA399] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ex: Gessagem e Subsolo, vantagens e desvantagens | Agroecologia | Cooperativa x Associativa..."
              className="w-full pl-12 pr-32 sm:pr-40 py-3.5 bg-[#FAF8F5] dark:bg-[#121511] text-[#3D3D3D] dark:text-[#E8E6DF] placeholder-[#8C897E] dark:placeholder-[#7A8072] rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] text-sm sm:text-base font-medium transition-all"
            />
            <button
              type="submit"
              disabled={searchingLive}
              className="absolute right-2 px-4 sm:px-6 py-2 bg-[#2E6F40] hover:bg-[#255833] disabled:bg-[#2E6F40]/50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              {searchingLive ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Buscando...</span>
                </>
              ) : (
                <>
                  <span>Pesquisar Fontes</span>
                  <ArrowUpRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* THEMATIC SUGGESTION CHIPS */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-[#8C897E] dark:text-[#9EA399] flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[#D4A373]" /> Sugestões de temas e tópicos:
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {SUGGESTIONS.map((sug) => {
              const isActive = searchTerm.toLowerCase() === sug.toLowerCase();
              return (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleSelectSuggestion(sug)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-medium ${
                    isActive
                      ? 'bg-[#2E6F40] text-white border-[#2E6F40] shadow-sm'
                      : 'bg-[#F9F8F6] dark:bg-[#242A20] text-[#5A5A40] dark:text-[#C5D9B0] border-[#E5E2D9] dark:border-[#2C3328] hover:border-[#2E6F40] dark:hover:border-[#9CB386]'
                  }`}
                >
                  {sug}
                </button>
              );
            })}
          </div>
        </div>

        {/* PORTAL & TYPE FILTERS */}
        <div className="pt-2 border-t border-[#F0EDE5] dark:border-[#2C3328] space-y-2">
          {/* Portal Filter */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#8C897E] dark:text-[#9EA399]">
              <Filter className="h-3.5 w-3.5" />
              <span>Filtrar por repositório/portal:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'todos', label: 'Todos os Repositórios' },
                { id: 'Google Acadêmico', label: 'Google Acadêmico' },
                { id: 'Embrapa', label: 'Embrapa' },
                { id: 'SciELO', label: 'SciELO' },
                { id: 'CAPES', label: 'Portal CAPES' },
                { id: 'BDTD', label: 'BDTD (Teses)' },
                { id: 'YouTube', label: 'YouTube Técnico' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPortal(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    selectedPortal === p.id
                      ? 'bg-[#2E6F40] text-white font-semibold'
                      : 'text-[#8C897E] dark:text-[#9EA399] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
            <span className="text-[#8C897E] dark:text-[#9EA399] font-semibold">Tipo de documento:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedType('todos')}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'todos'
                    ? 'bg-[#5A5A40] dark:bg-[#9CB386] text-white dark:text-[#121511] font-semibold'
                    : 'text-[#8C897E] dark:text-[#9EA399] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Todos ({scoredSources.length})
              </button>
              {Object.entries(TYPE_LABELS).map(([typeKey, label]) => {
                const count = scoredSources.filter((s) => s.sourceType === typeKey).length;
                if (count === 0) return null;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setSelectedType(typeKey)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      selectedType === typeKey
                        ? 'bg-[#5A5A40] dark:bg-[#9CB386] text-white dark:text-[#121511] font-semibold'
                        : 'text-[#8C897E] dark:text-[#9EA399] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS LIST */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <p className="text-xs sm:text-sm font-semibold text-[#5A5A40] dark:text-[#E8E6DF] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#2E6F40] dark:text-[#9CB386]" />
            <span>Fontes localizadas para &ldquo;{searchTerm || 'Agropecuária'}&rdquo;:</span>
            <span className="text-xs font-normal text-[#8C897E] dark:text-[#9EA399]">
              ({filteredSources.length} fontes ordenadas por cosseno trigonométrico)
            </span>
          </p>

          {searchTerm && (
            <button
              type="button"
              onClick={() => onSendToAutomaticResearcher(searchTerm)}
              className="text-xs font-semibold text-[#2E6F40] dark:text-[#9CB386] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Gerar Artigo Científico ABNT sobre este tema</span>
            </button>
          )}
        </div>

        {filteredSources.length === 0 ? (
          <div className="bg-white dark:bg-[#1C201A] p-8 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] text-center space-y-3">
            <GraduationCap className="h-10 w-10 text-[#8C897E] dark:text-[#9EA399] mx-auto opacity-50" />
            <h3 className="text-base font-bold text-[#5A5A40] dark:text-[#E8E6DF]">
              Nenhum artigo localizado com os filtros selecionados
            </h3>
            <p className="text-xs text-[#8C897E] dark:text-[#9EA399] max-w-md mx-auto">
              Experimente ajustar os filtros de repositório ou digitar outro termo agronômico. Você também pode enviar este tema diretamente para o <strong>Pesquisador Automático</strong> elaborar o artigo completo.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onSendToAutomaticResearcher(searchTerm)}
                className="px-4 py-2 bg-[#2E6F40] text-white text-xs font-semibold rounded-xl hover:bg-[#255833] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#D4A373]" />
                <span>Elaborar Artigo Científico ABNT</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {paginatedSources.map((source) => {
              const isCopied = copiedId === source.id;
              const isYouTube = source.sourceName === 'YouTube' || source.sourceType === 'video_tecnico';
              const trig = source.trigonometricSimilarity;

              return (
                <div
                  key={source.id}
                  className="bg-white dark:bg-[#1C201A] p-5 sm:p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm hover:border-[#2E6F40]/50 dark:hover:border-[#9CB386]/50 transition-all space-y-3"
                >
                  {/* TOP BADGES & TRIGONOMETRIC SCORE */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Repository Badge */}
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            isYouTube
                              ? 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                              : 'bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]'
                          }`}
                        >
                          {isYouTube && <Video className="h-3 w-3" />}
                          {source.sourceName}
                        </span>

                        {/* Source Type Badge */}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#D4A373]/15 text-[#8D6E63] dark:text-[#D4A373]">
                          {TYPE_LABELS[source.sourceType]}
                        </span>

                        {/* Year */}
                        <span className="text-[11px] font-bold text-[#8C897E] dark:text-[#9EA399]">
                          {source.year}
                        </span>

                        {/* TRIGONOMETRIC SIMILARITY BADGE */}
                        {trig && (
                          <span
                            className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1"
                            title={`Similaridade Trigonométrica vetorial: cos(θ) = ${trig.cosTheta}, Ângulo θ = ${trig.angleDegrees}°, Alinhamento: ${trig.alignmentQuality}`}
                          >
                            <Compass className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              cos θ = <strong>{trig.cosTheta.toFixed(2)}</strong> (θ ≈ {trig.angleDegrees}°)
                            </span>
                            <span className="font-sans text-[10px] font-semibold bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950 px-1.5 py-0.2 rounded-full">
                              {trig.percentage}%
                            </span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-serif font-bold text-[#242A20] dark:text-[#F3F1EC] leading-snug">
                        {source.title}
                      </h3>
                      <p className="text-xs text-[#5A5A40] dark:text-[#C5D9B0] font-medium">
                        {source.authors} • <span className="italic">{source.publication}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyCitation(source)}
                        className={`p-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          isCopied
                            ? 'bg-[#2E6F40] text-white border-[#2E6F40]'
                            : 'bg-[#FAF8F5] dark:bg-[#242A20] text-[#5A5A40] dark:text-[#E8E6DF] border-[#E5E2D9] dark:border-[#2C3328] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        title="Copiar referência nas normas da ABNT NBR 6023"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{isCopied ? 'Copiado!' : 'Citação ABNT'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ABSTRACT / SUMMARY */}
                  <p className="text-xs sm:text-sm text-[#5A5A40] dark:text-[#C5D9B0]/90 leading-relaxed bg-[#FDFBF7] dark:bg-[#121511] p-3.5 rounded-2xl border border-[#F0EDE5] dark:border-[#242A20]">
                    {source.abstract}
                  </p>

                  {/* VANTAGENS & DESVANTAGENS IDENTIFICADAS NESTA FONTE */}
                  {((source.vantagens && source.vantagens.length > 0) || (source.desvantagens && source.desvantagens.length > 0)) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      {source.vantagens && source.vantagens.length > 0 && (
                        <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 space-y-1.5">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                            <ThumbsUp className="h-3.5 w-3.5" /> Vantagens Identificadas:
                          </span>
                          <ul className="space-y-1 text-[#2E6F40] dark:text-[#9CB386] list-disc list-inside text-[11px] leading-relaxed">
                            {source.vantagens.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {source.desvantagens && source.desvantagens.length > 0 && (
                        <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-1.5">
                          <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                            <AlertOctagon className="h-3.5 w-3.5" /> Desvantagens / Limitações Técnicas:
                          </span>
                          <ul className="space-y-1 text-amber-900 dark:text-amber-200/90 list-disc list-inside text-[11px] leading-relaxed">
                            {source.desvantagens.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KEYWORDS */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-[#8C897E] dark:text-[#9EA399]">Palavras-chave:</span>
                    {source.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[#5A5A40] dark:text-[#A6A395]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* ACTION FOOTER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#F0EDE5] dark:border-[#2C3328]">
                    <div className="text-[11px] text-[#8C897E] dark:text-[#9EA399] font-mono truncate max-w-md">
                      ABNT: {source.abntCitation}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={isYouTube ? (source.directUrl || "https://www.youtube.com/watch?v=" + source.id) : source.directUrl || source.searchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                          isYouTube
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-100'
                            : 'bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] text-[#2E6F40] dark:text-[#9CB386] border-[#E5E2D9] dark:border-[#2C3328]'
                        }`}
                      >
                        {isYouTube ? (
                          <>
                            <Video className="h-3 w-3" />
                            <span>Assistir Palestra no YouTube</span>
                          </>
                        ) : (
                          <>
                            <span>Acessar no {source.sourceName}</span>
                            <ExternalLink className="h-3 w-3" />
                          </>
                        )}
                      </a>
                      <button
                        type="button"
                        onClick={() => onSendToAutomaticResearcher(source.title)}
                        className="px-3 py-1.5 bg-[#2E6F40]/10 hover:bg-[#2E6F40]/20 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:hover:bg-[#9CB386]/25 dark:text-[#9CB386] rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Artigo ABNT deste Tema</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-[#1C201A] text-[#5A5A40] dark:text-[#E8E6DF] border-[#E5E2D9] dark:border-[#2C3328] hover:border-[#2E6F40] dark:hover:border-[#9CB386]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#8C897E] dark:text-[#9EA399]">
                    Página
                  </span>
                  <span className="text-xs font-bold text-[#5A5A40] dark:text-[#E8E6DF] bg-[#FAF8F5] dark:bg-[#121511] px-2.5 py-1 rounded-lg border border-[#E5E2D9] dark:border-[#2C3328]">
                    {currentPage} / {totalPages}
                  </span>
                  <span className="text-xs font-medium text-[#8C897E] dark:text-[#9EA399]">
                    ({filteredSources.length} resultado{filteredSources.length !== 1 ? 's' : ''})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-[#1C201A] text-[#5A5A40] dark:text-[#E8E6DF] border-[#E5E2D9] dark:border-[#2C3328] hover:border-[#2E6F40] dark:hover:border-[#9CB386]"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
