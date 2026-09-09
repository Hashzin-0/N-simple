'use client';

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  FileText,
  Copy,
  Check,
  Printer,
  Download,
  BookOpen,
  RefreshCw,
  Award,
  Layers,
  CheckCircle2,
  ExternalLink,
  ArrowRightLeft,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { ScientificArticleABNT } from './types';
import { DEFAULT_INITIAL_ARTICLE } from './portalsData';

const DEFAULT_RESEARCH_TOPICS: string[] = [
  'Definição e Características Fundamentais',
  'Vantagens Agronômicas, Produtivas e Econômicas',
  'Desvantagens, Riscos Operacionais e Limitações Práticas',
  'Análise Comparativa Direta (Práticas Tradicionais vs. Contemporâneas)',
];

interface PesquisadorAutomaticoSectionProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  isDark: boolean;
}

export default function PesquisadorAutomaticoSection({
  currentTheme,
  onThemeChange,
}: PesquisadorAutomaticoSectionProps) {
  const [themeInput, setThemeInput] = useState(currentTheme || 'Gessagem e Subsolo: Vantagens e Desvantagens');
  const [prevTheme, setPrevTheme] = useState(currentTheme);
  const [userLinksInput, setUserLinksInput] = useState<string>('');
  const [topics, setTopics] = useState<string[]>(DEFAULT_RESEARCH_TOPICS);
  const [newTopicInput, setNewTopicInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [article, setArticle] = useState<ScientificArticleABNT | null>(() => DEFAULT_INITIAL_ARTICLE);
  const [copied, setCopied] = useState(false);
  const [copiedRefs, setCopiedRefs] = useState(false);
  const [viewMode, setViewMode] = useState<'abnt_sheet' | 'cards'>('abnt_sheet');
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const toggleTopicSources = (topicNumber: string) => {
    setCollapsedTopics((prev) => ({
      ...prev,
      [topicNumber]: !prev[topicNumber],
    }));
  };

  const handleAddTopic = () => {
    const trimmed = newTopicInput.trim();
    if (!trimmed) return;
    if (!topics.includes(trimmed)) {
      setTopics((prev) => [...prev, trimmed]);
    }
    setNewTopicInput('');
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    setTopics((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleResetTopics = () => {
    setTopics(DEFAULT_RESEARCH_TOPICS);
  };

  const getSourceSearchUrl = (f: { title: string; repository?: string; authors?: string }) => {
    const cleanTitle = (f.title || '').replace(/^\[\d+\]\s*/, '').trim();
    const repo = (f.repository || '').toLowerCase();
    if (repo.includes('scielo')) {
      return `https://search.scielo.org/?q=${encodeURIComponent(cleanTitle)}`;
    }
    if (repo.includes('embrapa')) {
      return `https://www.embrapa.br/busca-de-publicacoes/-/busca/${encodeURIComponent(cleanTitle)}`;
    }
    if (repo.includes('capes') || repo.includes('periódicos')) {
      return `https://www.periodicos.capes.gov.br/?option=com_psearch&task=search&q=${encodeURIComponent(cleanTitle)}`;
    }
    if (repo.includes('bdtd') || repo.includes('teses')) {
      return `https://bdtd.ibict.br/vufind/Search/Results?lookfor=${encodeURIComponent(cleanTitle)}`;
    }
    if (repo.includes('youtube')) {
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle)}`;
    }
    return `https://scholar.google.com.br/scholar?q=${encodeURIComponent(`"${cleanTitle}"`)}`;
  };

  // Sync with prop when changed from parent
  if (currentTheme && currentTheme !== prevTheme) {
    setPrevTheme(currentTheme);
    setThemeInput(currentTheme);
  }

  const handleRunResearch = React.useCallback(async (targetTheme?: string) => {
    const themeToUse = (targetTheme || themeInput).trim();
    if (!themeToUse) return;

    const parsedLinks = userLinksInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const activeTopics = topics
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setLoading(true);
    if (parsedLinks.length > 0) {
      setLoadingStep(`Lendo e analisando ${parsedLinks.length} link(s)/PDF(s) do usuário e extraindo tópicos...`);
    } else {
      setLoadingStep('Levantando fontes científicas nos portais (mínimo 3 a 10 por tópico)...');
    }

    const stepTimer1 = setTimeout(() => {
      setLoadingStep('Estruturando características, vantagens, desvantagens e tópicos personalizados...');
    }, 1400);

    const stepTimer2 = setTimeout(() => {
      setLoadingStep('Formatando o artigo nas normas da ABNT NBR 6022, NBR 6028 e NBR 6023...');
    }, 2800);

    try {
      const res = await fetch('/api/gemini/pesquisador-artigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: themeToUse,
          userLinks: parsedLinks,
          customTopics: activeTopics,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao processar pesquisa automática');
      }

      const data: ScientificArticleABNT = await res.json();
      setArticle(data);
      onThemeChange(themeToUse);
    } catch (error) {
      console.error('Error calling pesquisador automatico:', error);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(false);
      setLoadingStep('');
    }
  }, [themeInput, userLinksInput, topics, onThemeChange]);

  const handleCopyABNT = () => {
    if (!article) return;

    const fullText = `${article.title}
${article.subtitle ? `${article.subtitle}\n` : ''}
${article.titleEn}

${article.authors.map((a) => `${a.name} (${a.titulation} - ${a.affiliation}${a.email ? ` - ${a.email}` : ''})`).join('\n')}

RESUMO
${article.resumo}

Palavras-chave: ${article.palavrasChave.join('; ')}.

ABSTRACT
${article.abstractEn}

Keywords: ${article.keywordsEn.join('; ')}.

1 INTRODUÇÃO
${article.introducao}

2 METODOLOGIA DE REVISÃO SISTEMÁTICA
${article.metodologia}

3 DESENVOLVIMENTO E ANÁLISE DOS TÓPICOS
${article.topicosDesenvolvimento
  .map(
    (t) =>
      `${t.number} ${t.title}\n\n${t.content}\n\nFontes Consultadas neste Tópico (${t.fontesConsultadas.length} fontes):\n${t.fontesConsultadas
        .map((f, idx) => `  [${idx + 1}] ${f.citationABNT} (${f.repository}) - Contribuição: ${f.contribution}`)
        .join('\n')}`
  )
  .join('\n\n')}

${
  article.analiseComparativaDireta && article.analiseComparativaDireta.length > 0
    ? `ANÁLISE COMPARATIVA DIRETA: PRÁTICAS TRADICIONAIS SUPERADAS VS. RECOMENDAÇÕES CONTEMPORÂNEAS\n${article.analiseComparativaDireta
        .map(
          (c, idx) =>
            `Item ${idx + 1}: ${c.parametroComparado}\n- Prática Tradicional Superada: ${c.praticaSuperadaOuTradicional}\n- Prática Contemporânea Recomendada: ${c.praticaContemporaneaRecomendada}\n- Impacto Agroecológico e Econômico: ${c.impactoAgroeconomico}\n- Evidências Científicas: ${c.evidenciaCientifica}`
        )
        .join('\n\n')}\n\n`
    : ''
}4 CONSIDERAÇÕES FINAIS
${article.consideracoesFinais}

REFERÊNCIAS
${article.referenciasABNT.join('\n\n')}
`;

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadTxt = () => {
    if (!article) return;
    const fullText = printableAreaRef.current?.innerText || '';
    const blob = new Blob([fullText], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Artigo_Cientifico_ABNT_${article.theme.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section id="pesquisador_automatico" className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#2E6F40]/15 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386] border border-[#2E6F40]/25 shrink-0">
              <Sparkles className="h-6 w-6 text-[#2E6F40] dark:text-[#9CB386]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E8E7DF]">
                  Pesquisador Automático de Artigos Científicos
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386]">
                  Normas ABNT NBR 6022
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
                Levantamento bibliográfico aprofundado com mínimo de 3 a 10 fontes científicas por tópico, comparação direta entre práticas agronômicas e formatação acadêmica integral.
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH & GENERATION INPUT */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              placeholder="Digite o tema desejado (ex: Gessagem e Subsolo, vantagens e desvantagens | Agroecologia | Cooperativa x Associativa...)"
              className="flex-1 px-4 py-3 bg-[#FAF8F5] dark:bg-[#121511] text-[#3D3D3D] dark:text-[#E8E6DF] placeholder-[#8C897E] dark:placeholder-[#7A8072] rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] text-sm font-medium"
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => handleRunResearch(themeInput)}
              disabled={loading}
              className={`px-6 py-3 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer shrink-0 ${
                loading
                  ? 'bg-[#2E6F40]/50 text-white cursor-not-allowed'
                  : 'bg-[#2E6F40] hover:bg-[#255833] text-white'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Elaborando Artigo ABNT...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-[#D4A373]" />
                  <span>Elaborar Artigo Científico ABNT</span>
                </>
              )}
            </button>
          </div>

          {/* QUICK TOPIC BUTTONS */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[#8C897E] dark:text-[#9EA399] font-medium text-[11px]">Temas sugeridos:</span>
            {[
              'Gessagem e Subsolo, vantagens e desvantagens',
              'Agroecologia e Manejo Sustentável',
              'Cooperativa x Associativa',
              'Fixação Biológica de Nitrogênio e Bioinsumos',
              'Plantio Direto e Descontinuação da Aração',
            ].map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => {
                  setThemeInput(topic);
                  handleRunResearch(topic);
                }}
                disabled={loading}
                className="px-2.5 py-1 bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] text-[#5A5A40] dark:text-[#C5D9B0] rounded-xl border border-[#E5E2D9] dark:border-[#2C3328] text-[11px] font-medium transition-colors cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>

          {/* CUSTOM SOURCES & CUSTOMIZABLE TOPICS SECTION */}
          <div className="pt-2 border-t border-[#E5E2D9] dark:border-[#2C3328] space-y-4">
            {/* FIELD 1: USER LINKS / PDFS INPUT */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-[#121511] border border-[#E5E2D9] dark:border-[#242A20] space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#2E6F40]/10 dark:bg-[#9CB386]/15 text-[#2E6F40] dark:text-[#9CB386]">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      Adicionar Links ou PDFs de Artigos
                    </span>
                    <span className="text-[10px] font-semibold text-[#8C897E] dark:text-[#9EA399] ml-2 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                      Leitura e Pesquisa Direta
                    </span>
                  </div>
                </div>

                {userLinksInput.trim().length > 0 && (
                  <span className="text-[11px] font-medium text-[#2E6F40] dark:text-[#9CB386] flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {userLinksInput.split('\n').filter((l) => l.trim().length > 0).length} link(s) / documento(s) anexado(s)
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
                Cole links ou URLs de artigos e PDFs que você já encontrou na internet, mas não quer ter o trabalho de ler manualmente. O pesquisador automático fará a leitura e síntese focada nesses documentos específicos.
              </p>

              <textarea
                rows={2}
                value={userLinksInput}
                onChange={(e) => setUserLinksInput(e.target.value)}
                placeholder={`Cole links/URLs de artigos ou PDFs (um por linha)... Ex:\nhttps://www.scielo.br/j/rcs/a/exemplo_artigo.pdf\nhttps://ainfo.cnptia.embrapa.br/digital/bitstream/item/12345/1/publicacao.pdf`}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1C201A] text-[#3D3D3D] dark:text-[#E8E6DF] placeholder-[#8C897E] dark:placeholder-[#7A8072] rounded-xl border border-[#E5E2D9] dark:border-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] text-xs font-mono resize-y"
                disabled={loading}
              />
            </div>

            {/* FIELD 2: CUSTOMIZABLE TOPICS TO BE RESEARCHED */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-[#121511] border border-[#E5E2D9] dark:border-[#242A20] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#2E6F40]/10 dark:bg-[#9CB386]/15 text-[#2E6F40] dark:text-[#9CB386]">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      Tópicos a Serem Pesquisados
                    </span>
                    <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399] ml-2 font-medium">
                      (para os links e para a pesquisa nativa)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetTopics}
                  className="text-[11px] font-semibold text-[#8C897E] hover:text-[#2E6F40] dark:text-[#9EA399] dark:hover:text-[#9CB386] flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                  title="Restaurar lista de tópicos padrão"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restaurar tópicos padrão</span>
                </button>
              </div>

              <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
                Estes tópicos estruturam a investigação científica e as seções de desenvolvimento do artigo. Você pode remover tópicos, adicionar novos de seu interesse ou restaurar os padrões.
              </p>

              {/* LIST OF ACTIVE TOPICS */}
              <div className="flex flex-wrap gap-2 pt-1">
                {topics.map((top, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#2C3328] rounded-xl text-xs font-medium text-[#3D3D3D] dark:text-[#E8E6DF] shadow-xs group"
                  >
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386]">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[240px] sm:max-w-none">{top}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(idx)}
                      className="text-[#8C897E] hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title="Remover tópico"
                      aria-label={`Remover tópico ${top}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* INPUT TO ADD NEW TOPIC */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newTopicInput}
                  onChange={(e) => setNewTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopic();
                    }
                  }}
                  placeholder="Adicionar novo tópico a ser pesquisado (ex: Viabilidade econômica, Impacto no sistema radicular...)"
                  className="flex-1 px-3.5 py-2 bg-white dark:bg-[#1C201A] text-[#3D3D3D] dark:text-[#E8E6DF] placeholder-[#8C897E] dark:placeholder-[#7A8072] rounded-xl border border-[#E5E2D9] dark:border-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#2E6F40] dark:focus:ring-[#9CB386] text-xs font-medium"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  disabled={!newTopicInput.trim() || loading}
                  className="px-3.5 py-2 bg-[#2E6F40] hover:bg-[#255833] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* LOADING PROGRESS BANNER */}
        {loading && (
          <div className="p-4 rounded-2xl bg-[#2E6F40]/10 dark:bg-[#9CB386]/10 border border-[#2E6F40]/20 dark:border-[#9CB386]/20 space-y-2 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2E6F40] dark:text-[#9CB386]">
              <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
              <span>{loadingStep || 'Processando levantamento bibliográfico nas bases de dados...'}</span>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#2E6F40] dark:bg-[#9CB386] h-full rounded-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
            </div>
          </div>
        )}
      </div>

      {/* ARTICLE RESULT CONTAINER */}
      {article && !loading && (
        <div className="space-y-6">
          {/* ARTICLE ACTION TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1C201A] p-4 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#8C897E] dark:text-[#9EA399]">Modo de Visualização:</span>
              <div className="flex rounded-xl bg-[#FAF8F5] dark:bg-[#121511] p-1 border border-[#E5E2D9] dark:border-[#2C3328]">
                <button
                  type="button"
                  onClick={() => setViewMode('abnt_sheet')}
                  className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    viewMode === 'abnt_sheet'
                      ? 'bg-[#2E6F40] text-white shadow-sm'
                      : 'text-[#5A5A40] dark:text-[#A6A395] hover:text-[#242A20]'
                  }`}
                >
                  Formato ABNT Oficial
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-[#2E6F40] text-white shadow-sm'
                      : 'text-[#5A5A40] dark:text-[#A6A395] hover:text-[#242A20]'
                  }`}
                >
                  Cards Interativos
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleCopyABNT}
                className="px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] text-[#5A5A40] dark:text-[#E8E6DF] rounded-xl text-xs font-semibold border border-[#E5E2D9] dark:border-[#2C3328] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Artigo Copiado!' : 'Copiar Texto Completo'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] text-[#5A5A40] dark:text-[#E8E6DF] rounded-xl text-xs font-semibold border border-[#E5E2D9] dark:border-[#2C3328] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar .TXT</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] text-[#5A5A40] dark:text-[#E8E6DF] rounded-xl text-xs font-semibold border border-[#E5E2D9] dark:border-[#2C3328] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* VIEW MODE A: ABNT SHEET (STRICT NBR 6022) */}
          {viewMode === 'abnt_sheet' ? (
            <div
              ref={printableAreaRef}
              className="bg-white dark:bg-[#1C201A] p-6 sm:p-12 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-md font-serif text-[#242A20] dark:text-[#E8E7DF] space-y-8 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none"
            >
              {/* ARTICLE HEADER / METADATA */}
              <div className="space-y-4 border-b border-[#E5E2D9] dark:border-[#2C3328] pb-6 text-center">
                <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-[#2E6F40] dark:text-[#9CB386]">
                  Artigo Técnico-Científico — ABNT NBR 6022
                </span>

                <h1 className="text-xl sm:text-2xl font-bold uppercase leading-tight tracking-tight">
                  {article.title}
                </h1>

                {article.subtitle && (
                  <h2 className="text-sm sm:text-base font-normal italic text-[#5A5A40] dark:text-[#A6A395]">
                    {article.subtitle}
                  </h2>
                )}

                <p className="text-xs font-medium uppercase tracking-wide text-[#737373] dark:text-[#A3A3A3] pt-1">
                  {article.titleEn}
                </p>

                {/* AUTHORS */}
                <div className="pt-3 space-y-1.5 text-xs text-[#5A5A40] dark:text-[#C5D9B0] font-sans">
                  {article.authors.map((auth, idx) => (
                    <p key={idx}>
                      <strong>{auth.name}</strong> — {auth.titulation}, {auth.affiliation}
                      {auth.email && <span className="italic"> ({auth.email})</span>}
                    </p>
                  ))}
                  <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] pt-1">
                    Artigo elaborado em: {article.generatedAt}
                  </p>
                </div>
              </div>

              {/* RESUMO & PALAVRAS-CHAVE (NBR 6028) */}
              <div className="p-5 sm:p-6 bg-[#FAF8F5] dark:bg-[#121511] rounded-2xl border border-[#E5E2D9] dark:border-[#242A20] space-y-3 font-sans text-xs sm:text-sm">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#2E6F40] dark:text-[#9CB386] mb-1">
                    Resumo
                  </h3>
                  <p className="leading-relaxed text-justify text-[#3D3D3D] dark:text-[#D5D3CC]">
                    {article.resumo}
                  </p>
                </div>
                <div>
                  <strong className="text-xs text-[#242A20] dark:text-[#F3F1EC]">Palavras-chave: </strong>
                  <span className="text-[#5A5A40] dark:text-[#A6A395]">{article.palavrasChave.join('; ')}.</span>
                </div>
              </div>

              {/* ABSTRACT & KEYWORDS (ENGLISH) */}
              <div className="p-5 sm:p-6 bg-[#FAF8F5] dark:bg-[#121511] rounded-2xl border border-[#E5E2D9] dark:border-[#242A20] space-y-3 font-sans text-xs sm:text-sm">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#737373] dark:text-[#A3A3A3] mb-1">
                    Abstract
                  </h3>
                  <p className="leading-relaxed text-justify italic text-[#3D3D3D] dark:text-[#D5D3CC]">
                    {article.abstractEn}
                  </p>
                </div>
                <div>
                  <strong className="text-xs text-[#242A20] dark:text-[#F3F1EC]">Keywords: </strong>
                  <span className="text-[#5A5A40] dark:text-[#A6A395] italic">{article.keywordsEn.join('; ')}.</span>
                </div>
              </div>

              {/* 1 INTRODUÇÃO */}
              <div className="space-y-3 pt-2">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide border-b border-[#F0EDE5] dark:border-[#2C3328] pb-1.5">
                  1 Introdução
                </h3>
                <div className="text-xs sm:text-sm leading-relaxed text-justify space-y-3 text-[#3D3D3D] dark:text-[#D5D3CC]">
                  {article.introducao.split('\n\n').map((p, i) => (
                    <p key={i} className="indent-6">{p}</p>
                  ))}
                </div>
              </div>

              {/* 2 METODOLOGIA */}
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide border-b border-[#F0EDE5] dark:border-[#2C3328] pb-1.5">
                  2 Metodologia
                </h3>
                <div className="text-xs sm:text-sm leading-relaxed text-justify space-y-3 text-[#3D3D3D] dark:text-[#D5D3CC]">
                  {article.metodologia.split('\n\n').map((p, i) => (
                    <p key={i} className="indent-6">{p}</p>
                  ))}
                </div>
              </div>

              {/* 3 DESENVOLVIMENTO E TÓPICOS ESTRUTURADOS */}
              <div className="space-y-6">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide border-b border-[#F0EDE5] dark:border-[#2C3328] pb-1.5">
                  3 Desenvolvimento e Discussão dos Resultados
                </h3>

                {article.topicosDesenvolvimento.map((topic) => (
                  <div key={topic.number} className="space-y-3">
                    <h4 className="text-sm sm:text-base font-bold text-[#2E6F40] dark:text-[#9CB386]">
                      {topic.number} {topic.title}
                    </h4>

                    <div className="text-xs sm:text-sm leading-relaxed text-justify space-y-3 text-[#3D3D3D] dark:text-[#D5D3CC]">
                      {topic.content.split('\n\n').map((p, i) => (
                        <p key={i} className="indent-6">{p}</p>
                      ))}
                    </div>

                    {/* FONTES ESPECÍFICAS DESTE TÓPICO (MÍNIMO 3, MÁXIMO 10) - COLAPSÁVEL */}
                    {topic.fontesConsultadas && topic.fontesConsultadas.length > 0 && (() => {
                      const isCollapsed = !!collapsedTopics[topic.number];
                      return (
                        <div className="mt-3 bg-[#FAF8F5] dark:bg-[#121511] rounded-2xl border border-[#F0EDE5] dark:border-[#242A20] font-sans overflow-hidden transition-all">
                          <button
                            type="button"
                            onClick={() => toggleTopicSources(topic.number)}
                            className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                          >
                            <span className="text-[11px] sm:text-xs font-bold text-[#5A5A40] dark:text-[#C5D9B0] flex items-center gap-1.5 uppercase tracking-wider">
                              <BookOpen className="h-3.5 w-3.5 text-[#2E6F40] dark:text-[#9CB386] shrink-0" />
                              <span>Fontes Científicas do Tópico {topic.number}</span>
                              <span className="text-[10px] font-normal text-[#8C897E] dark:text-[#9EA399] lowercase hidden sm:inline">
                                ({topic.fontesConsultadas.length} referências analisadas)
                              </span>
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2E6F40] dark:text-[#9CB386] shrink-0">
                              <span>{isCollapsed ? 'Expandir fontes' : 'Recolher fontes'}</span>
                              {isCollapsed ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronUp className="h-4 w-4" />
                              )}
                            </div>
                          </button>

                          {!isCollapsed && (
                            <div className="p-3 sm:p-3.5 pt-0 space-y-2 border-t border-[#F0EDE5] dark:border-[#242A20]/80">
                              <div className="space-y-2 pt-2">
                                {topic.fontesConsultadas.map((f, fIdx) => (
                                  <div
                                    key={fIdx}
                                    className="text-[11px] p-2.5 sm:p-3 rounded-xl bg-white dark:bg-[#1A1F18] border border-[#E5E2D9] dark:border-[#2C3328] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                                  >
                                    <div className="space-y-0.5 flex-1">
                                      <div className="flex items-baseline gap-1.5">
                                        <span className="font-mono text-[10px] font-bold text-[#2E6F40] dark:text-[#9CB386] shrink-0">
                                          [{fIdx + 1}]
                                        </span>
                                        <span className="font-semibold text-[#242A20] dark:text-[#F3F1EC]">
                                          {f.title}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[#5A5A40] dark:text-[#A6A395] pl-4">
                                        {f.authors} ({f.year}) — <span className="italic">{f.contribution}</span>
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-4 sm:pl-0">
                                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386]">
                                        {f.repository}
                                      </span>
                                      <a
                                        href={getSourceSearchUrl(f)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E6F40] hover:text-[#1E4D2B] dark:text-[#9CB386] dark:hover:text-[#C5D9B0] bg-[#2E6F40]/10 hover:bg-[#2E6F40]/20 dark:bg-[#9CB386]/15 dark:hover:bg-[#9CB386]/25 px-2.5 py-1 rounded-lg transition-all active:scale-95 group/arrow cursor-pointer"
                                        title={`Acessar publicação "${f.title}" (${f.repository})`}
                                      >
                                        <span>Acessar fonte</span>
                                        <span className="text-sm font-bold transition-transform group-hover/arrow:translate-x-0.5">→</span>
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              {/* ANÁLISE COMPARATIVA DIRETA (INTEGRADA NO ARTIGO) */}
              {article.analiseComparativaDireta && article.analiseComparativaDireta.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm sm:text-base font-bold text-[#2E6F40] dark:text-[#9CB386] flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Quadro Comparativo Direto: Práticas Tradicionais Superadas vs. Abordagens Contemporâneas
                  </h4>
                  <p className="text-xs text-[#5A5A40] dark:text-[#A6A395] font-sans">
                    Comparação direta fundamentada em evidências científicas comprovando a superioridade agronômica das práticas contemporâneas em substituição às abordagens tradicionais ineficazes:
                  </p>

                  <div className="overflow-x-auto font-sans">
                    <table className="w-full text-left text-xs border border-[#E5E2D9] dark:border-[#2C3328] rounded-xl overflow-hidden">
                      <thead className="bg-[#FAF8F5] dark:bg-[#121511] text-[#242A20] dark:text-[#F3F1EC] border-b border-[#E5E2D9] dark:border-[#2C3328]">
                        <tr>
                          <th className="p-2.5 font-bold">Parâmetro Avaliado</th>
                          <th className="p-2.5 font-bold text-amber-800 dark:text-amber-300">Prática Tradicional Superada</th>
                          <th className="p-2.5 font-bold text-emerald-800 dark:text-emerald-300">Prática Contemporânea Recomendada</th>
                          <th className="p-2.5 font-bold">Impacto Produtivo & Risco</th>
                          <th className="p-2.5 font-bold">Evidência Científica</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2D9] dark:divide-[#2C3328]">
                        {article.analiseComparativaDireta.map((item, idx) => (
                          <tr key={idx} className="hover:bg-black/2 dark:hover:bg-white/2">
                            <td className="p-2.5 font-semibold text-[#242A20] dark:text-[#F3F1EC]">
                              {item.parametroComparado}
                            </td>
                            <td className="p-2.5 text-amber-900 dark:text-amber-200/90 bg-amber-50/40 dark:bg-amber-950/10">
                              {item.praticaSuperadaOuTradicional}
                            </td>
                            <td className="p-2.5 text-emerald-900 dark:text-emerald-200/90 bg-emerald-50/40 dark:bg-emerald-950/10 font-medium">
                              {item.praticaContemporaneaRecomendada}
                            </td>
                            <td className="p-2.5 text-[#5A5A40] dark:text-[#C5D9B0]">
                              {item.impactoAgroeconomico}
                            </td>
                            <td className="p-2.5 text-[10px] text-[#8C897E] dark:text-[#9EA399] font-mono">
                              {item.evidenciaCientifica}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4 CONSIDERAÇÕES FINAIS */}
              <div className="space-y-3 pt-2">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide border-b border-[#F0EDE5] dark:border-[#2C3328] pb-1.5">
                  4 Considerações Finais
                </h3>
                <div className="text-xs sm:text-sm leading-relaxed text-justify space-y-3 text-[#3D3D3D] dark:text-[#D5D3CC]">
                  {article.consideracoesFinais.split('\n\n').map((p, i) => (
                    <p key={i} className="indent-6">{p}</p>
                  ))}
                </div>
              </div>

              {/* REFERÊNCIAS BIBLIOGRÁFICAS (NBR 6023) */}
              <div className="space-y-3 pt-4 border-t border-[#E5E2D9] dark:border-[#2C3328]">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide">
                  Referências
                </h3>
                <div className="space-y-2.5 text-xs text-[#3D3D3D] dark:text-[#C5D9B0] font-sans">
                  {article.referenciasABNT.map((ref, idx) => (
                    <p key={idx} className="pl-4 -indent-4 leading-normal">
                      {ref}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* VIEW MODE B: INTERACTIVE CARDS */
            <div className="space-y-4">
              {/* METRIC HEADER */}
              <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]">
                  Síntese de Artigo Científico
                </span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-[#242A20] dark:text-[#F3F1EC]">
                  {article.title}
                </h2>
                <p className="text-xs text-[#5A5A40] dark:text-[#C5D9B0]">
                  {article.resumo}
                </p>
              </div>

              {/* TOPICS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {article.topicosDesenvolvimento.map((topic) => (
                  <div
                    key={topic.number}
                    className="bg-white dark:bg-[#1C201A] p-5 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-[#FAF8F5] dark:bg-[#242A20] text-[#2E6F40] dark:text-[#9CB386]">
                          {topic.number}
                        </span>
                        <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399]">
                          {topic.fontesConsultadas.length} fontes citadas
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-[#242A20] dark:text-[#F3F1EC]">
                        {topic.title}
                      </h3>
                      <p className="text-xs text-[#5A5A40] dark:text-[#C5D9B0] leading-relaxed line-clamp-6">
                        {topic.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#F0EDE5] dark:border-[#2C3328] space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#8C897E] dark:text-[#9EA399]">
                        Fontes em destaque:
                      </span>
                      <ul className="text-[10px] text-[#5A5A40] dark:text-[#C5D9B0] space-y-1">
                        {topic.fontesConsultadas.slice(0, 3).map((f, i) => (
                          <li key={i} className="flex items-center justify-between gap-1">
                            <span className="truncate flex-1">
                              • {f.title} ({f.repository})
                            </span>
                            <a
                              href={getSourceSearchUrl(f)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#2E6F40] dark:text-[#9CB386] hover:underline font-bold shrink-0 ml-1 inline-flex items-center gap-0.5"
                              title="Acessar fonte"
                            >
                              <span>→</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {/* DIRECT COMPARISON MATRIX */}
              {article.analiseComparativaDireta && article.analiseComparativaDireta.length > 0 && (
                <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-[#2E6F40] dark:text-[#9CB386]" />
                    <h3 className="text-base font-bold text-[#242A20] dark:text-[#F3F1EC]">
                      Comparação Direta: Práticas Tradicionais vs. Recomendações Contemporâneas
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {article.analiseComparativaDireta.map((comp, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-[#121511] border border-[#E5E2D9] dark:border-[#242A20] space-y-2 text-xs"
                      >
                        <span className="font-bold text-[#242A20] dark:text-[#F3F1EC] text-xs">
                          {comp.parametroComparado}
                        </span>

                        <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200/90 space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                            Prática Tradicional Superada:
                          </span>
                          <p>{comp.praticaSuperadaOuTradicional}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200/90 space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">
                            Prática Contemporânea Recomendada:
                          </span>
                          <p className="font-medium">{comp.praticaContemporaneaRecomendada}</p>
                        </div>

                        <p className="text-[11px] text-[#5A5A40] dark:text-[#C5D9B0] pt-1">
                          <strong>Impacto: </strong>{comp.impactoAgroeconomico}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REFERÊNCIAS BIBLIOGRÁFICAS (NBR 6023) NO MODO CARDS INTERATIVOS */}
              {article.referenciasABNT && article.referenciasABNT.length > 0 && (
                <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/20 dark:text-[#9CB386]">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-[#242A20] dark:text-[#F3F1EC]">
                          Referências Bibliográficas
                        </h3>
                        <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
                          Normas ABNT NBR 6023 ({article.referenciasABNT.length} publicações acadêmicas citadas no estudo)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(article.referenciasABNT.join('\n\n'));
                        setCopiedRefs(true);
                        setTimeout(() => setCopiedRefs(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-[#242A20] hover:bg-[#F0EDE5] dark:hover:bg-[#2C3328] border border-[#E5E2D9] dark:border-[#2C3328] text-xs font-semibold text-[#5A5A40] dark:text-[#E8E6DF] flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
                    >
                      {copiedRefs ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar Referências</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {article.referenciasABNT.map((ref, idx) => {
                      const cleanSearch = ref.replace(/^[A-Z\s,]+;\s*/, '').slice(0, 120);
                      const scholarUrl = `https://scholar.google.com.br/scholar?q=${encodeURIComponent(cleanSearch)}`;

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-[#FAF8F5] dark:bg-[#121511] border border-[#F0EDE5] dark:border-[#242A20] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1">
                            <span className="font-mono text-[10px] text-[#8C897E] dark:text-[#9EA399] font-bold">
                              [{idx + 1}]
                            </span>
                            <p className="text-[#3D3D3D] dark:text-[#D5D3CC] leading-relaxed">
                              {ref}
                            </p>
                          </div>

                          <a
                            href={scholarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E6F40] hover:text-[#1E4D2B] dark:text-[#9CB386] dark:hover:text-[#C5D9B0] bg-[#2E6F40]/10 hover:bg-[#2E6F40]/20 dark:bg-[#9CB386]/15 dark:hover:bg-[#9CB386]/25 px-2.5 py-1.5 rounded-xl transition-all shrink-0 self-start sm:self-center active:scale-95 group/refLink cursor-pointer"
                            title="Acessar publicação no Google Acadêmico"
                          >
                            <span>Acessar fonte</span>
                            <span className="text-sm font-bold transition-transform group-hover/refLink:translate-x-0.5">→</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
