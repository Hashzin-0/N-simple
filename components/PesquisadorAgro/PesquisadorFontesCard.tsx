'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { SCRAPERS_METADATA } from '@/lib/scrapers/metadata';
import { usePersistedState } from '@/hooks/usePersistedState';
import { resolveImageUrl } from '@/lib/imageResolver';
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
  Clock,
} from 'lucide-react';
import { ScientificSource, SourceType } from './types';
import { computeTrigonometricSimilarity } from './trigonometry';
import { deduplicateSources } from '@/lib/scrapers/dedup';

interface PesquisadorFontesCardProps {
  currentTheme: string;
  onThemeChange: (newTheme: string) => void;
  onSendToAutomaticResearcher: (theme: string) => void;
  onSourcesLoaded?: (sources: ScientificSource[]) => void;
  isDark: boolean;
}

interface ScoredSource extends ScientificSource {
  trigonometricSimilarity: ReturnType<typeof computeTrigonometricSimilarity>;
  bm25Score: number;
  combinedScore: number;
}

const STOP_WORDS_BM25 = new Set([
  'que', 'com', 'para', 'por', 'uma', 'dos', 'das', 'nas', 'nos', 'sobre',
  'como', 'pelo', 'pela', 'entre', 'mais', 'este', 'esta', 'esse', 'essa',
  'qual', 'quais', 'onde', 'quando', 'muito', 'cada', 'seus', 'suas', 'isso',
  'vantagens', 'desvantagens',
]);

function tokenizeBM25(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS_BM25.has(t));
}

function computeBM25(documents: string[], queryTokens: string[], k1 = 1.3, b = 0.75): number[] {
  if (documents.length === 0 || queryTokens.length === 0) return documents.map(() => 0);

  const docTokenCounts = documents.map((doc) => {
    const counts: Record<string, number> = {};
    const words = doc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    for (const w of words) {
      if (w.length > 2) counts[w] = (counts[w] || 0) + 1;
    }
    return counts;
  });

  const docLengths = docTokenCounts.map((counts) => Object.values(counts).reduce((a, b) => a + b, 0));
  const avgDl = docLengths.reduce((a, b) => a + b, 0) / docLengths.length || 1;

  // IDF for each query token
  const idf = queryTokens.map((term) => {
    const n = docTokenCounts.filter((counts) => (counts[term] || 0) > 0).length;
    return Math.log((documents.length - n + 0.5) / (n + 0.5) + 1);
  });

  return documents.map((_, docIdx) => {
    const counts = docTokenCounts[docIdx];
    const dl = docLengths[docIdx];
    let score = 0;
    for (let i = 0; i < queryTokens.length; i++) {
      const tf = counts[queryTokens[i]] || 0;
      score += (idf[i] * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * dl) / avgDl));
    }
    return score;
  });
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
  onSourcesLoaded,
}: PesquisadorFontesCardProps) {
  const [searchTerm, setSearchTerm] = usePersistedState<string>('pesq_fontes_search', '');
  const [prevTheme, setPrevTheme] = useState(currentTheme);
  const [selectedType, setSelectedType] = usePersistedState<string>('pesq_fontes_type', 'todos');
  const [selectedPortal, setSelectedPortal] = usePersistedState<string>('pesq_fontes_portal', 'todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchingLive, setSearchingLive] = useState(false);
  const [dynamicSources, setDynamicSources] = useState<ScientificSource[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [scraperProgress, setScraperProgress] = useState<Record<string, { status: 'pending' | 'loading' | 'complete' | 'error'; count?: number; message?: string }>>({});
  const [searchOptions, setSearchOptions] = useState<{ maxPerSource?: Record<string, number>; language?: 'pt-br' | 'pt-br-en' }>({ language: 'pt-br' });
  const [showScraperConfig, setShowScraperConfig] = useState(false);
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});
  const sourceCardsRef = useRef<HTMLDivElement>(null);
  const resultsHeaderRef = useRef<HTMLDivElement>(null);

  // Sync state during render when prop changes
  if (currentTheme !== prevTheme) {
    setPrevTheme(currentTheme);
    setSearchTerm(currentTheme);
  }

  // Sources from real web scraping (via API)
  const allAvailableSources = useMemo(() => {
    return dynamicSources;
  }, [dynamicSources]);

  // Resolve images for sources that don't have imageUrl or need OG/favicon fallback
  useEffect(() => {
    const toResolve = allAvailableSources.filter(
      (src) => !resolvedImages[src.id] && !src.imageUrl
    );
    if (toResolve.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        toResolve.map(async (src) => {
          const url = await resolveImageUrl(src.directUrl, src.doi);
          return { id: src.id, url };
        })
      );
      if (cancelled) return;
      const updates: Record<string, string> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.url) {
          updates[r.value.id] = r.value.url;
        }
      }
      if (Object.keys(updates).length > 0) {
        setResolvedImages((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [allAvailableSources, resolvedImages]);

  // Notify parent when sources change
  useEffect(() => {
    if (onSourcesLoaded && dynamicSources.length > 0) {
      onSourcesLoaded(dynamicSources);
    }
  }, [dynamicSources, onSourcesLoaded]);

  // Quando não há filtro local digitado, usa o score REAL já calculado
  // pelo motor semântico no servidor (lib/semantic/relevanceEngine.ts).
  // A heurística local (computeTrigonometricSimilarity) só entra em jogo
  // para reordenar instantaneamente a lista quando o usuário digita um
  // termo de refinamento aqui no card — nunca para substituir o score real.
  const scoredSources: ScoredSource[] = useMemo(() => {
    const query = searchTerm.trim();
    if (!query || allAvailableSources.length === 0) {
      return allAvailableSources.map((src) => ({
        ...src,
        trigonometricSimilarity: src.trigonometricSimilarity ?? {
          cosTheta: 0,
          angleDegrees: 90,
          percentage: 0,
          alignmentQuality: 'Moderada' as const,
        },
        bm25Score: 0,
        combinedScore: (src.trigonometricSimilarity?.percentage ?? 0) / 100,
      })) as ScoredSource[];
    }

    // Build text corpus for BM25
    const sourceTexts = allAvailableSources.map((src) =>
      [src.title, src.abstract || '', (src.keywords || []).join(' ')].join(' ')
    );

    // Tokenize query for BM25
    const queryTokens = tokenizeBM25(query);

    // BM25 scores
    let bm25Raw: number[] = [];
    if (queryTokens.length > 0 && sourceTexts.length > 0) {
      bm25Raw = computeBM25(sourceTexts, queryTokens);
    }

    // Normalize BM25 to 0-1
    const maxBM25 = Math.max(...bm25Raw, 0.001);
    const bm25Norm = bm25Raw.map((s) => Math.min(1, s / maxBM25));

    return allAvailableSources.map((src, idx) => {
      // Prioriza o score REAL calculado pelo motor semântico no servidor
      // (embeddings de texto completo). A heurística local (TF ponderado)
      // só é usada como sinal secundário de keyword-boost, ou como
      // fallback para fontes antigas em cache que não passaram pelo motor.
      const realTrig = src.trigonometricSimilarity;
      const trig = realTrig ?? computeTrigonometricSimilarity(query, src);
      const trigVal = trig?.cosTheta ?? 0;
      const bm25Val = bm25Norm[idx] || 0;

      return {
        ...src,
        trigonometricSimilarity: trig,
        bm25Score: bm25Val,
        combinedScore: Math.max(trigVal, bm25Val * 0.6),
      };
    }) as ScoredSource[];
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
      const hasDecentScore = (src.combinedScore ?? 0) >= 0.20 ||
        (src.trigonometricSimilarity?.cosTheta ?? 0) >= 0.20;

      return inTitle || inAbstract || inKeywords || inAuthors || inPub || wordMatch || hasDecentScore;
    });

    // Ordenação decrescente pelo score combinado (max trig, bm25)
    return filtered.sort(
      (a, b) =>
        (b.combinedScore ?? 0) -
        (a.combinedScore ?? 0)
    );
  }, [scoredSources, searchTerm, selectedType, selectedPortal]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSources.length / ITEMS_PER_PAGE);
  const paginatedSources = filteredSources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Track previous filters to reset page
  const [prevFilters, setPrevFilters] = useState({ searchTerm, selectedType, selectedPortal });
  
  if (
    prevFilters.searchTerm !== searchTerm ||
    prevFilters.selectedType !== selectedType ||
    prevFilters.selectedPortal !== selectedPortal
  ) {
    setPrevFilters({ searchTerm, selectedType, selectedPortal });
    setCurrentPage(1);
  }

  const executeLiveSearch = useCallback(async (query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setSearchingLive(true);
    setDynamicSources([]);
    setScraperProgress({});

    try {
      const res = await fetch('/api/gemini/pesquisador-fontes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery, options: searchOptions, stream: true }),
      });

      if (!res.ok) {
        throw new Error('Search failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

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

              if (event === 'scraper_start') {
                setScraperProgress(prev => ({
                  ...prev,
                  [data.name]: { status: 'loading' }
                }));
              } else if (event === 'scraper_complete') {
                setScraperProgress(prev => ({
                  ...prev,
                  [data.name]: { status: 'complete', count: data.count }
                }));
                if (data.results && data.results.length > 0) {
                  setDynamicSources(prev => deduplicateSources([...prev, ...data.results]));
                }
              } else if (event === 'scraper_error') {
                setScraperProgress(prev => ({
                  ...prev,
                  [data.name]: { status: 'error' }
                }));
              } else if (event === 'processing_start') {
                setScraperProgress(prev => ({
                  ...prev,
                  _processing: { status: 'loading', message: data.message }
                }));
              } else if (event === 'processing_complete') {
                setScraperProgress(prev => {
                  const next = { ...prev };
                  delete next._processing;
                  return next;
                });
              } else if (event === 'complete' && data.sources) {
                setDynamicSources(data.sources);
                if (data.indexingStats) {
                  console.info('[PesquisadorFontes] indexingStats:', data.indexingStats);
                }
                if (Array.isArray(data.errors) && data.errors.length > 0) {
                  console.warn('[PesquisadorFontes] erros da pesquisa:', data.errors);
                }
              } else if (event === 'error') {
                console.error('[PesquisadorFontes] erro no stream:', data?.message);
                setScraperProgress(prev => {
                  const next = { ...prev };
                  delete next._processing;
                  return next;
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      console.warn('Live portal search error, relying on local curated sources:', err);
    } finally {
      setSearchingLive(false);
    }
  }, [searchOptions]);

  // Run live search on mount and when theme changes externally
  const executeLiveSearchRef = useRef(executeLiveSearch);
  useEffect(() => {
    executeLiveSearchRef.current = executeLiveSearch;
  });
  useEffect(() => {
    if (currentTheme) {
      executeLiveSearchRef.current(currentTheme);
    }
  }, [currentTheme]);

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
                  Semantic Scholar • SciELO • Embrapa • CAPES • BDTD • YouTube
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
                Pesquisa unificada em todos os repositórios oficiais e canais técnicos do YouTube com classificação por <strong>Similaridade Trigonométrica (cos θ)</strong> + <strong>BM25</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH INPUT BAR */}
        <form onSubmit={handleSearchSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-3.5 h-4.5 w-4.5 text-[#8C897E] dark:text-[#9EA399] pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: Gessagem e Subsolo, vantagens e desvantagens | Agroecologia | Cooperativa x Associativa..."
                className="w-full pl-10 pr-3 py-3 bg-[#FAF8F5] dark:bg-[#121511] text-[#3D3D3D] dark:text-[#E8E6DF] placeholder-[#8C897E] dark:placeholder-[#7A8072] rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] text-sm sm:text-base font-medium transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => setSearchOptions(prev => ({
                ...prev,
                language: prev.language === 'pt-br' ? 'pt-br-en' : 'pt-br',
              }))}
              className={`shrink-0 px-3 py-3 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                searchOptions.language === 'pt-br-en'
                  ? 'bg-[#2E6F40]/10 dark:bg-[#9CB386]/15 text-[#2E6F40] dark:text-[#9CB386] border-[#2E6F40]/30 dark:border-[#9CB386]/30'
                  : 'bg-[#FAF8F5] dark:bg-[#121511] text-[#5A5A40] dark:text-[#E8E6DF] border-[#E5E2D9] dark:border-[#2C3328]'
              }`}
              title={searchOptions.language === 'pt-br-en' ? 'Buscando em PT-BR + EN-US' : 'Buscando apenas em PT-BR'}
            >
              {searchOptions.language === 'pt-br-en' ? 'PT + EN' : 'PT-BR'}
            </button>
            <button
              type="submit"
              disabled={searchingLive}
              className="shrink-0 px-4 sm:px-5 py-3 bg-[#2E6F40] hover:bg-[#255833] disabled:bg-[#2E6F40]/50 text-white rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              {searchingLive ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Buscando...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Pesquisar</span>
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
                { id: 'Embrapa', label: 'Embrapa' },
                { id: 'SciELO', label: 'SciELO' },
                { id: 'CAPES', label: 'Portal CAPES' },
                { id: 'BDTD', label: 'BDTD (Teses)' },
                { id: 'YouTube', label: 'YouTube Técnico' },
                { id: 'CNPEM', label: 'CNPEM' },
                { id: 'INPA', label: 'INPA' },
                { id: 'IPEA', label: 'IPEA' },
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

        {/* SEARCH OPTIONS */}
        <div className="pt-2 border-t border-[#F0EDE5] dark:border-[#2C3328] space-y-3">
          {/* Max Results per Source */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8C897E] dark:text-[#9EA399]">
                Resultados por fonte (máx. permitido):
              </span>
              <button
                type="button"
                onClick={() => setShowScraperConfig(!showScraperConfig)}
                className="text-[10px] text-[#2E6F40] dark:text-[#9CB386] hover:underline cursor-pointer"
              >
                {showScraperConfig ? 'Ocultar' : 'Configurar'}
              </button>
            </div>
            {showScraperConfig && (
              <div className="space-y-2">
                {SCRAPERS_METADATA.map((scraper) => {
                  const currentValue = searchOptions.maxPerSource?.[scraper.name] ?? scraper.max;
                  return (
                    <div
                      key={scraper.name}
                      className="text-[10px] bg-[#FAF8F5] dark:bg-[#121511] p-2.5 rounded-xl border border-[#E5E2D9] dark:border-[#2C3328] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#5A5A40] dark:text-[#E8E6DF] truncate">
                          {scraper.name}
                        </span>
                        <span className="text-[#2E6F40] dark:text-[#9CB386] font-bold tabular-nums">
                          {currentValue}<span className="font-normal text-[#8C897E] dark:text-[#9EA399]">/{scraper.maxAllowed}</span>
                        </span>
                      </div>
                      <label className="flex flex-col">
                        <span className="text-[9px] text-[#8C897E] dark:text-[#9EA399] uppercase">Mínimo: 3</span>
                        <input
                          type="range"
                          min={3}
                          max={scraper.maxAllowed}
                          value={currentValue}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            setSearchOptions(prev => ({
                              ...prev,
                              maxPerSource: {
                                ...prev.maxPerSource,
                                [scraper.name]: value,
                              },
                            }));
                          }}
                          className="flex-1 h-1 accent-[#2E6F40] dark:accent-[#9CB386]"
                        />
                        <span className="text-[9px] text-[#8C897E] dark:text-[#9EA399]">Máx: {scraper.maxAllowed}</span>
                      </label>
                      <p className="text-[9px] text-[#8C897E] dark:text-[#9EA399] leading-tight">
                        {scraper.limitations}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scraper Progress */}
          {searchingLive && Object.keys(scraperProgress).length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[#8C897E] dark:text-[#9EA399]">
                Progresso da busca:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(scraperProgress).map(([name, status]) => (
                  <div
                    key={name}
                    className={`text-[10px] px-2 py-1.5 rounded-lg border ${
                      name === '_processing'
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 col-span-full'
                        : status.status === 'complete'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : status.status === 'loading'
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                        : status.status === 'error'
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className="font-medium">{name === '_processing' ? '🧠 Processamento Semântico' : name}</span>
                    {status.status === 'loading' && <span className="ml-1 animate-pulse">...</span>}
                    {status.status === 'complete' && status.count !== undefined && (
                      <span className="ml-1">({status.count})</span>
                    )}
                    {status.status === 'error' && <span className="ml-1">Erro</span>}
                    {name === '_processing' && status.message && (
                      <span className="ml-1 opacity-75">— {status.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESULTS LIST */}
      <div className="space-y-4">
        <div ref={resultsHeaderRef} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <p className="text-xs sm:text-sm font-semibold text-[#5A5A40] dark:text-[#E8E6DF] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#2E6F40] dark:text-[#9CB386]" />
            <span>Fontes localizadas para &ldquo;{searchTerm || 'Agropecuária'}&rdquo;:</span>
            <span className="text-xs font-normal text-[#8C897E] dark:text-[#9EA399]">
              ({filteredSources.length} fontes ordenadas por relevância combinada)
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
            <div ref={sourceCardsRef} className="grid grid-cols-1 gap-4">
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

                        {/* Video Duration (YouTube only) */}
                        {isYouTube && source.videoDuration && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {source.videoDuration}
                          </span>
                        )}

                        {/* TRIGONOMETRIC + BM25 SCORE BADGE */}
                        {trig && (
                          <span
                            className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1"
                            title={`Trigonométrica: cos(θ) = ${trig.cosTheta} | BM25: ${(source.bm25Score ?? 0).toFixed(2)} | Combinado: ${(source.combinedScore ?? 0).toFixed(2)}`}
                          >
                            <Compass className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              cos θ = <strong>{trig.cosTheta.toFixed(2)}</strong>
                            </span>
                            <span className="text-emerald-500 dark:text-emerald-400">|</span>
                            <span>
                              BM25 = <strong>{(source.bm25Score ?? 0).toFixed(2)}</strong>
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

                  {/* SOURCE IMAGE / THUMBNAIL */}
                  {(source.imageUrl || resolvedImages[source.id]) && (
                    <div className="relative overflow-hidden rounded-2xl border border-[#F0EDE5] dark:border-[#242A20] bg-[#FAF8F5] dark:bg-[#121511]">
                      <Image
                        src={source.imageUrl || resolvedImages[source.id]}
                        alt={source.title}
                        width={600}
                        height={338}
                        unoptimized
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

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
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    resultsHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
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
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    resultsHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
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
