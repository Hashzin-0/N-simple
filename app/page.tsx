'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import {
  Calculator,
  RotateCcw,
  CheckCircle2,
  Percent,
  Printer,
  Sprout,
  Mic,
} from 'lucide-react';
import LoadingSkeleton3D from '@/components/LoadingSkeleton3D';
import Input3D from '@/components/Input3D';
import Select3D from '@/components/Select3D';
import { CssGooeyStack } from '@/components/godui/css-gooey-stack';
import { useGeminiLiveAgent } from '@/hooks/useGeminiLiveAgent';
import { useTheme } from '@/components/ThemeProvider';
import { useAnimationLock } from '@/lib/useAnimationLock';
import { computeCalculations } from '@/lib/calculations';
import ExtracaoTotalCard from '@/components/metrics/ExtracaoTotalCard';
import NecessidadeLiquidaCard from '@/components/metrics/NecessidadeLiquidaCard';
import DoseRecomendadaCard from '@/components/metrics/DoseRecomendadaCard';
import SecondaryCreditsCard from '@/components/metrics/SecondaryCreditsCard';
import ParcelamentoSection from '@/components/metrics/ParcelamentoSection';
import BalancoSection from '@/components/metrics/BalancoSection';
import DetailedMathPanel from '@/components/metrics/DetailedMathPanel';
import { ABNTReference } from '@/lib/abnt/types';
import { type Preset } from '@/lib/types';
import BibliografiaAutoDetectCard from '@/components/metrics/BibliografiaAutoDetectCard';
import GooeyTabPanel, { type TabId } from '@/components/GooeyTabPanel';
import { ScrollStack } from '@/components/godui/scroll-stack';
import { ElasticText } from '@/components/godui/elastic-text';
import PresetMultiButton from '@/components/godui/preset-multi-button';

// Lazy-loaded heavy components (Three.js, complex calculators)
const VoiceAssistantHUD = dynamic(() => import('@/components/VoiceAssistantHUD'), { ssr: false });
const DarkMode3DToggle = dynamic(() => import('@/components/DarkMode3DToggle'), { ssr: false });
const SectionNavGooey = dynamic(() => import('@/components/SectionNavGooey'), { ssr: false });
const CornYieldCalculator = dynamic(() => import('@/components/CornYieldCalculator'), { ssr: false });
const ITRCalculator = dynamic(() => import('@/components/ITRCalculator'), { ssr: false });
const AbntReferenceFormatter = dynamic(() => import('@/components/AbntReferenceFormatter'), { ssr: false });

const PRESETS: Preset[] = [
  {
    id: 'alta_produtividade',
    name: 'Alta Produtividade',
    description: 'Milho irrigado com alta tecnologia, produtividade superior a 160 sc/ha.',
    yieldGoal: 180,
    nRequirementPerBag: 1.45,
    mosNContribution: 45,
    soyNContribution: 25,
    efficiency: 0.85,
    baseDose: 35,
    baseDose2: 0,
    v4v6Percent: 55,
    v4v6Percent2: 0,
    v8v10Percent: 20,
    v8v10Percent2: 0,
  },
  {
    id: 'produtividade_media',
    name: 'Produtividade Média',
    description: 'Milho de sequeiro com manejo padrão, produtividade entre 100-140 sc/ha.',
    yieldGoal: 120,
    nRequirementPerBag: 1.35,
    mosNContribution: 35,
    soyNContribution: 20,
    efficiency: 0.80,
    baseDose: 30,
    baseDose2: 0,
    v4v6Percent: 50,
    v4v6Percent2: 0,
    v8v10Percent: 25,
    v8v10Percent2: 0,
  },
  {
    id: 'baixa_produtividade',
    name: 'Baixa Produtividade',
    description: 'Milho com limitações hídricas ou solo pobre, produtividade abaixo de 100 sc/ha.',
    yieldGoal: 80,
    nRequirementPerBag: 1.25,
    mosNContribution: 25,
    soyNContribution: 15,
    efficiency: 0.75,
    baseDose: 25,
    baseDose2: 0,
    v4v6Percent: 45,
    v4v6Percent2: 0,
    v8v10Percent: 30,
    v8v10Percent2: 0,
  },
];

export default function Home() {
  const { isDark } = useTheme();
  const { withLock } = useAnimationLock(400);
  const [isLoading, setIsLoading] = useState(true);

  // Input states
  const [yieldGoal, setYieldGoal] = useState<number>(0);
  const [nRequirementPerBag, setNRequirementPerBag] = useState<number>(0);
  const [mosNContribution, setMosNContribution] = useState<number>(0);
  const [soyNContribution, setSoyNContribution] = useState<number>(0);
  const [efficiency, setEfficiency] = useState<number>(0);
  
  // Custom interactive split parameters
  const [baseDose, setBaseDose] = useState<number>(0);
  const [baseDose2, setBaseDose2] = useState<number>(0); // 0 = single value mode
  const [v4v6Percent, setV4v6Percent] = useState<number>(0);
  const [v4v6Percent2, setV4v6Percent2] = useState<number>(0); // 0 = single value mode
  const [v8v10Percent, setV8v10Percent] = useState<number>(0);
  const [v8v10Percent2, setV8v10Percent2] = useState<number>(0); // 0 = single value mode
  
  // Toggle for 1 vs 2 values per application
  const [baseDoseMode, setBaseDoseMode] = useState<'single' | 'range'>('single');
  
  // Split base configuration: dose with losses (Dose de N a aplicar) or net requirement (Necessidade Líquida)
  const [splitBase, setSplitBase] = useState<'dose_perdas' | 'necessidade_liquida'>('dose_perdas');

  // Active scenario preset
  const [activePreset, setActivePreset] = useState<string>('personalizado');
  
  // Animation state for filling fields when loading presets (single boolean to prevent re-render thrashing)
  const [isFillingPreset, setIsFillingPreset] = useState(false);
  const fillingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('nitrogen');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [bibliographyRef, setBibliographyRef] = useState<ABNTReference | null>(null);


  // Handle preset loading — batch state updates with startTransition (instant, no lag)
  const handleLoadPreset = useCallback((preset: Preset) => {
    if (fillingTimerRef.current) clearTimeout(fillingTimerRef.current);

    setActivePreset(preset.id);
    setIsFillingPreset(true);
    fillingTimerRef.current = setTimeout(() => {
      setIsFillingPreset(false);
    }, 350);

    // Batch all value updates in a single transition (1 render instead of ~23)
    startTransition(() => {
      setYieldGoal(preset.yieldGoal);
      setNRequirementPerBag(preset.nRequirementPerBag);
      setMosNContribution(preset.mosNContribution);
      setSoyNContribution(preset.soyNContribution);
      setEfficiency(preset.efficiency * 100);
      setBaseDose(preset.baseDose);
      setBaseDose2(preset.baseDose2);
      setV4v6Percent(preset.v4v6Percent);
      setV4v6Percent2(preset.v4v6Percent2);
      setV8v10Percent(preset.v8v10Percent);
      setV8v10Percent2(preset.v8v10Percent2);
      setBaseDoseMode(preset.baseDose2 > 0 ? 'range' : 'single');
    });
  }, []);

  // Mark custom if any state changes
  const handleCustomInputChange = useCallback((updater: () => void) => {
    updater();
    setActivePreset('personalizado');
  }, []);

  // Memoized input change handlers — stable references for React.memo
  const setYieldGoalValue = useCallback((v: number) => handleCustomInputChange(() => setYieldGoal(v)), [handleCustomInputChange]);
  const setNRequirementPerBagValue = useCallback((v: number) => handleCustomInputChange(() => setNRequirementPerBag(Math.max(0, v))), [handleCustomInputChange]);
  const setMosNContributionValue = useCallback((v: number) => handleCustomInputChange(() => setMosNContribution(Math.max(0, v))), [handleCustomInputChange]);
  const setSoyNContributionValue = useCallback((v: number) => handleCustomInputChange(() => setSoyNContribution(Math.max(0, v))), [handleCustomInputChange]);
  const setEfficiencyValue = useCallback((v: number) => handleCustomInputChange(() => setEfficiency(v)), [handleCustomInputChange]);
  const setEfficiencyBlur = useCallback((v: number) => handleCustomInputChange(() => setEfficiency(Math.min(100, Math.max(10, v)))), [handleCustomInputChange]);
  const setBaseDoseValue = useCallback((v: number) => handleCustomInputChange(() => setBaseDose(v)), [handleCustomInputChange]);
  const setBaseDose2Value = useCallback((v: number) => handleCustomInputChange(() => setBaseDose2(v)), [handleCustomInputChange]);
  const setV4v6PercentValue = useCallback((v: number) => handleCustomInputChange(() => setV4v6Percent(v)), [handleCustomInputChange]);
  const setV4v6Percent2Value = useCallback((v: number) => handleCustomInputChange(() => setV4v6Percent2(v)), [handleCustomInputChange]);
  const setV8v10PercentValue = useCallback((v: number) => handleCustomInputChange(() => setV8v10Percent(v)), [handleCustomInputChange]);
  const setV8v10Percent2Value = useCallback((v: number) => handleCustomInputChange(() => setV8v10Percent2(v)), [handleCustomInputChange]);
  const setSplitBaseValue = useCallback((v: string) => handleCustomInputChange(() => setSplitBase(v as 'dose_perdas' | 'necessidade_liquida')), [handleCustomInputChange]);

  const handleBaseDoseModeChange = useCallback((v: string) => {
    handleCustomInputChange(() => {
      const newMode = v as 'single' | 'range';
      setBaseDoseMode(newMode);
      if (newMode === 'single') {
        setBaseDose2(0);
        setV4v6Percent2(0);
        setV8v10Percent2(0);
      }
    });
  }, [handleCustomInputChange]);

  // Calculations — memoized to avoid recomputing on unrelated state changes
  const calculations = useMemo(() => computeCalculations({
    yieldGoal,
    nRequirementPerBag,
    mosNContribution,
    soyNContribution,
    efficiency,
    baseDose,
    baseDose2,
    baseDoseMode,
    v4v6Percent,
    v4v6Percent2,
    v8v10Percent,
    v8v10Percent2,
    splitBase,
  }), [yieldGoal, nRequirementPerBag, mosNContribution, soyNContribution, efficiency, baseDose, baseDose2, baseDoseMode, v4v6Percent, v4v6Percent2, v8v10Percent, v8v10Percent2, splitBase]);

  // Handle dynamic layout print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleReset = useCallback(() => {
    startTransition(() => {
      setYieldGoal(0);
      setNRequirementPerBag(0);
      setMosNContribution(0);
      setSoyNContribution(0);
      setEfficiency(0);
      setBaseDose(0);
      setBaseDose2(0);
      setBaseDoseMode('single');
      setV4v6Percent(0);
      setV4v6Percent2(0);
      setV8v10Percent(0);
      setV8v10Percent2(0);
      setActivePreset('personalizado');
    });
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToastDismiss = useCallback(() => setSaveToast(null), []);

  // Gemini Live Voice Agent callbacks — memoized for stable references
  const onSetYieldGoal = useCallback((val: number) => {
    setYieldGoal(val);
    setActivePreset('personalizado');
  }, []);

  const onSetSoilParameters = useCallback(({ mos, soy, efficiency: eff }: { mos?: number; soy?: number; efficiency?: number }) => {
    if (mos !== undefined) setMosNContribution(mos);
    if (soy !== undefined) setSoyNContribution(soy);
    if (eff !== undefined) setEfficiency(eff);
    setActivePreset('personalizado');
  }, []);

  const onSetParceling = useCallback(({ baseDose: b, v4v6Percent: p1, v8v10Percent: p2 }: { baseDose?: number; v4v6Percent?: number; v8v10Percent?: number }) => {
    if (b !== undefined) setBaseDose(b);
    if (p1 !== undefined) setV4v6Percent(p1);
    if (p2 !== undefined) setV8v10Percent(p2);
    setActivePreset('personalizado');
    setActiveTab('nitrogen');
  }, []);

  const onLoadPreset = useCallback((presetId: string) => {
    const p = PRESETS.find((pr) => pr.id === presetId);
    if (p) handleLoadPreset(p);
  }, [handleLoadPreset]);

  const onSetITRParameters = useCallback((params: Record<string, unknown>) => {
    setActivePreset('personalizado');
    setActiveTab('itr');
    const el = document.getElementById('itr_section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    console.log('ITR parameters received:', params);
  }, []);

  const onSetABNTReference = useCallback((ref: Record<string, unknown>) => {
    setActivePreset('personalizado');
    setActiveTab('abnt');
    const el = document.getElementById('abnt_section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    console.log('ABNT reference received:', ref);
  }, []);

  const onSetBibliographyReference = useCallback((ref: ABNTReference) => {
    setBibliographyRef(ref);
    setActivePreset('personalizado');
    setActiveTab('abnt');
    const el = document.getElementById('abnt_section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    console.log('Bibliography reference received:', ref);
  }, []);

  const voiceAgent = useGeminiLiveAgent({
    yieldGoal,
    nRequirementPerBag,
    mosNContribution,
    soyNContribution,
    efficiency,
    baseDose,
    v4v6Percent,
    v8v10Percent,
    splitBase,
    totalExtraction: calculations.totalExtraction,
    liquidNeed: calculations.liquidNeed,
    recommendedDose: calculations.recommendedDose,
    selectedV4V6Val: calculations.v4v6_1_kg,
    selectedV8V10Val: calculations.v8v10_1_kg,
    sumOfSplits: calculations.sumOfSplits,
    onSetYieldGoal,
    onSetSoilParameters,
    onSetParceling,
    onLoadPreset,
    onSetITRParameters,
    onSetABNTReference,
    onSetBibliographyReference,
  });

  // Memoized tab contents to avoid unneeded re-renders when nitrogen parameters update
  const productivityContent = useMemo(
    () => (
      <div className="w-full">
        <ScrollStack baseScale={0.92} peek={12} blur pinTop="4vh">
          <CornYieldCalculator
            isConnected
            onApplyYieldGoal={(scHa) => {
              setYieldGoal(scHa);
              setActivePreset('personalizado');
              setActiveTab('nitrogen');
              setSaveToast(`Meta de ${scHa} sc/ha calculada e aplicada na Adubação Nitrogenada!`);
              setTimeout(() => setSaveToast(null), 4500);
            }}
          />
        </ScrollStack>
      </div>
    ),
    [],
  );

  const itrContent = useMemo(
    () => (
      <div className="w-full">
        <ScrollStack baseScale={0.92} peek={12} blur pinTop="4vh">
          <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl shadow-sm border border-[#E5E2D9] dark:border-[#2C3328]">
            <ITRCalculator isConnected />
          </div>
        </ScrollStack>
      </div>
    ),
    [],
  );

  const abntContent = useMemo(
    () => (
      <div className="w-full">
        <ScrollStack baseScale={0.92} peek={12} blur pinTop="4vh">
          <div className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl shadow-sm border border-[#E5E2D9] dark:border-[#2C3328] space-y-6">
            <AbntReferenceFormatter isConnected />
            <BibliografiaAutoDetectCard
              onReferenceSelected={(ref) => {
                setBibliographyRef(ref);
                setActiveTab("abnt");
              }}
              initialUrl=""
            />
          </div>
        </ScrollStack>
      </div>
    ),
    [],
  );

  return (
    <>
      <LoadingSkeleton3D
        onComplete={() => setIsLoading(false)}
        duration={2500}
      />

      <main
        id="main_container"
        className="min-h-screen bg-[#FDFBF7] dark:bg-[#121511] text-[#3D3D3D] dark:text-[#E8E6DF] antialiased pb-8 font-sans transition-colors duration-300"
        style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.5s ease-in-out' }}
      >
      {/* HERO SECTION - rolls with page */}
      <section className="bg-[#5A5A40] dark:bg-[#1E241B] text-white px-4 sm:px-6 lg:px-8 pt-6 pb-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 dark:bg-white/5 text-white p-2.5 rounded-2xl border border-white/20 dark:border-white/10">
                  <Sprout id="brand_icon" className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 id="app_title" className="text-2xl sm:text-3xl font-serif italic font-bold tracking-tight text-white">
                    Agronômica N-Pro
                  </h1>
                  <p id="app_subtitle" className="text-xs sm:text-sm text-white/90 dark:text-white/80 mt-1 font-medium">
                    Calculadora de Adubação: Milho (Sucessão Soja) & Estimativa de Produtividade
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
              <div className="flex items-center">
                <DarkMode3DToggle />
              </div>

              <button
                id="btn_header_voice_agent"
                onClick={() => {
                  if (voiceAgent.state.isConnected) {
                    voiceAgent.disconnect();
                  } else {
                    voiceAgent.connect();
                  }
                }}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl transition-all text-sm active:scale-95 shadow-md ${
                  voiceAgent.state.isConnected
                    ? 'bg-[#2E6F40] text-white ring-2 ring-white/50'
                    : 'bg-white dark:bg-[#2A3125] text-[#5A5A40] dark:text-[#E8E6DF] hover:bg-[#F9F8F6] dark:hover:bg-[#343D2F]'
                }`}
                title="Conversar por voz com Puck (Gemini Live API)"
              >
                <Mic className={`h-4 w-4 ${voiceAgent.state.isConnected ? 'animate-bounce text-white' : 'text-[#5A5A40] dark:text-[#C5D9B0]'}`} />
                <span>{voiceAgent.state.isConnected ? 'Puck Conectado' : 'Falar com Puck'}</span>
              </button>
              <button
                id="btn_print"
                onClick={handlePrint}
                className="p-2.5 bg-white/10 dark:bg-white/5 hover:bg-white/20 text-white rounded-xl border border-white/20 dark:border-white/10 transition-all active:scale-95"
                title="Imprimir Relatório"
              >
                <Printer className="h-4 w-4 text-white" />
              </button>
              <button
                id="btn_reset"
                onClick={handleReset}
                className="flex items-center justify-center p-2.5 bg-white/10 dark:bg-white/5 hover:bg-white/20 text-white rounded-xl border border-white/20 dark:border-white/10 transition-all active:scale-95"
                title="Resetar para valores padrão"
              >
                <RotateCcw className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* STICKY SECTION NAV - sticks to top when scrolling */}
      <header
        id="app_header"
        className="sticky top-0 z-50 bg-[#5A5A40] dark:bg-[#1E241B] shadow-lg border-b border-[#4A4A30] dark:border-[#2D3528] transition-all"
      >
        {/* Mobile: horizontal nav inside sticky header */}
        <div className="lg:hidden px-4 sm:px-6 py-2">
          <SectionNavGooey activeTab={activeTab} />
        </div>
      </header>

      {/* Desktop: fixed sidebar nav */}
      <aside className="hidden lg:block fixed top-0 left-0 h-screen w-[180px] bg-[#5A5A40] dark:bg-[#1E241B] shadow-lg border-r border-[#4A4A30] dark:border-[#2D3528] p-2 z-40">
        <SectionNavGooey activeTab={activeTab} />
      </aside>

      {/* Main content area - offset for desktop sidebar */}
      <div className="lg:ml-[180px] px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* TOAST NOTIFICATION */}
        <AnimatePresence>
          {saveToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#5A5A40] dark:bg-[#242A20] text-white p-4 rounded-2xl flex items-center gap-3 shadow-md border border-white/10 dark:border-[#353D30]"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                <CheckCircle2 className="h-5 w-5 text-[#D4A373] shrink-0" />
                <span>{saveToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB PANEL — GOOEY TABS WITH ANIMATED TRANSITIONS */}
        <GooeyTabPanel
          activeTab={activeTab}
          onTabChange={handleTabChange}
          nitrogenContent={
            <div className="w-full">
              <ScrollStack baseScale={0.92} peek={12} blur pinTop="4vh">
        {/* INPUT SECTION — scenarios + inputs in one card */}
            <div id="form_section" className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl shadow-sm border border-[#E5E2D9] dark:border-[#2C3328] space-y-5 transition-colors">

              {/* HEADER */}
              <div className="flex items-center gap-3 border-b pb-4 border-[#F0EDE5] dark:border-[#2C3328]">
                <div className="p-3 rounded-2xl bg-[#D4A373]/20 text-[#D4A373] border border-[#D4A373]/30">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E8E7DF]">
                    Calculadora de Nitrogênio
                  </h2>
                  <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
                    Cálculo de dose, extração, necessidade líquida e parcelamento de N para milho.
                  </p>
                </div>
              </div>

              {/* Scenario chips */}
              <PresetMultiButton<Preset>
                id="preset_selector"
                presets={PRESETS}
                activePreset={activePreset}
                onPresetClick={handleLoadPreset}
                isDark={isDark}
              />

              <div className="border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
                <h2 className="text-lg font-bold text-[#5A5A40] dark:text-[#E8E6DF] flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" /> <ElasticText className="text-lg font-bold" mode="auto" startOnView loop={false}>Entrada de Dados</ElasticText>
                </h2>
                <p className="text-xs text-[#8C897E] dark:text-[#9EA399] mt-1">Ajuste os dados de produtividade e histórico do solo</p>
              </div>

              <div className="space-y-5">
                {/* Product Goal */}
                <Input3D
                  id="input_group_yield_goal"
                  label="Produtividade Alvo"
                  unit="sc/ha"
                  value={yieldGoal}
                  onChange={setYieldGoalValue}
                  step={5}
                  min={50}
                  max={250}
                  placeholder="Ex: 160"
                  isDark={isDark}
                  accentColor="#5A5A40"
                  hint="Meta de rendimento em sacas de 60kg por hectare."
                  filling={isFillingPreset}
                />

                {/* N Requirement */}
                <Input3D
                  label="N necessário por saca produzida"
                  unit="kg N/sc"
                  value={nRequirementPerBag}
                  onChange={setNRequirementPerBagValue}
                  step={0.05}
                  min={0.5}
                  max={2.5}
                  placeholder="Ex: 1.35"
                  isDark={isDark}
                  accentColor="#5A5A40"
                  hint="Extração unitária: 1.2 a 1.5 kg N por saca (padrão: 1.35)."
                  filling={isFillingPreset}
                />

                {/* MOS Contribution */}
                <Input3D
                  id="input_group_soil"
                  label="N fornecido pela M.O. (MOS)"
                  unit="kg N/ha"
                  value={mosNContribution}
                  onChange={setMosNContributionValue}
                  step={1}
                  min={0}
                  max={150}
                  placeholder="Ex: 40"
                  isDark={isDark}
                  accentColor="#5A5A40"
                  hint="Mineralização da Matéria Orgânica do Solo."
                  filling={isFillingPreset}
                />

                {/* Soy Credit */}
                <Input3D
                  label="Crédito de N pela Soja (cultura anterior)"
                  unit="kg N/ha"
                  value={soyNContribution}
                  onChange={setSoyNContributionValue}
                  step={1}
                  min={0}
                  max={100}
                  placeholder="Ex: 20"
                  isDark={isDark}
                  accentColor="#5A5A40"
                  hint="Crédito de N da soja: 15 a 30 kg N/ha na sucessão Soja-Milho."
                  filling={isFillingPreset}
                />

                {/* Efficiency rate */}
                <Input3D
                  id="input_group_efficiency"
                  label="Eficiência de Aplicação (%)"
                  unit="%"
                  value={efficiency}
                  onChange={setEfficiencyValue}
                  onBlurCustom={setEfficiencyBlur}
                  step={1}
                  min={10}
                  max={100}
                  placeholder="Ex: 80"
                  isDark={isDark}
                  accentColor="#5A5A40"
                  hint="Eficiência padrão: 80% (fator 0.8). Perdas por volatilização/lixiviação."
                  filling={isFillingPreset}
                />

              </div>

            </div>

        {/* PARCELAMENTO CONFIGURATION — standalone ScrollStack card */}
            <div id="parcelamento_config" className="bg-white dark:bg-[#1C201A] p-6 rounded-3xl shadow-sm border border-[#E5E2D9] dark:border-[#2C3328] space-y-6 transition-colors">
              <div className="border-b border-[#F0EDE5] dark:border-[#2C3328] pb-4">
                <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E8E6DF] uppercase tracking-wider flex items-center gap-2">
                  <Percent className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" /> Configuração do Parcelamento
                </h3>
                <p className="text-xs text-[#8C897E] dark:text-[#9EA399] mt-1">Configure as dosagens reais que deseja validar</p>
              </div>

              <div className="space-y-5">
                {/* Switch split base */}
                <Select3D
                  label="Base para cálculo do parcelamento:"
                  value={splitBase}
                  onChange={setSplitBaseValue}
                  isDark={isDark}
                  accentColor="#D4A373"
                  options={[
                    {
                      value: 'dose_perdas',
                      label: `Dose com Perdas (${calculations.recommendedDose} kg N/ha)`,
                      description: 'Inclui perdas por eficiência',
                    },
                    {
                      value: 'necessidade_liquida',
                      label: `Necessidade Líquida (${calculations.liquidNeed} kg N/ha)`,
                      description: 'Sem correção de perdas',
                    },
                  ]}
                />

                {/* 1st Application — Base/Semeadura (kg N/ha) — Cell Division Animation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      1ª Aplicação (Base / Semeadura)
                    </span>
                    <Select3D
                      value={baseDoseMode}
                      onChange={handleBaseDoseModeChange}
                      isDark={isDark}
                      accentColor="#D4A373"
                      options={[
                        { value: 'single', label: '1 valor' },
                        { value: 'range', label: '2 valores' },
                      ]}
                      className="!inline-flex !w-auto"
                    />
                  </div>

                  <CssGooeyStack collapsed={baseDoseMode === 'single'}>
                    <Input3D
                      label={baseDoseMode === 'range' ? 'Min (kg N/ha)' : 'Valor (kg N/ha)'}
                      labelMorph
                      unit="kg N/ha"
                      value={baseDose}
                      onChange={setBaseDoseValue}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="Ex: 35"
                      isDark={isDark}
                      accentColor="#D4A373"
                      filling={isFillingPreset}
                    />
                    <Input3D
                      label="Max (kg N/ha)"
                      unit="kg N/ha"
                      value={baseDose2}
                      onChange={setBaseDose2Value}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="0"
                      isDark={isDark}
                      accentColor="#D4A373"
                      filling={isFillingPreset}
                    />
                  </CssGooeyStack>

                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] mt-1 leading-relaxed">
                    * Faixa agronômica típica: 30 a 40 kg N/ha.
                  </p>
                </div>

                {/* 2nd Application — V4-V6 (% values) — Cell Division Animation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      2ª Aplicação (V4-V6) — Percentual
                    </span>
                    {baseDoseMode === 'single' ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
                      }`}>
                        1 valor %
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
                      }`}>
                        2 valores %
                      </span>
                    )}
                  </div>

                  <CssGooeyStack collapsed={baseDoseMode === 'single'}>
                    <Input3D
                      label={baseDoseMode === 'single' ? '% do total' : (baseDoseMode === 'range' ? 'Min %' : '% do total')}
                      labelMorph
                      unit="%"
                      value={v4v6Percent}
                      onChange={setV4v6PercentValue}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="Ex: 50"
                      isDark={isDark}
                      accentColor="#5A5A40"
                      filling={isFillingPreset}
                    />
                    <Input3D
                      label="Max %"
                      labelMorph
                      unit="%"
                      value={v4v6Percent2}
                      onChange={setV4v6Percent2Value}
                      step={1}
                      min={0}
                      max={100}
                      placeholder="0"
                      isDark={isDark}
                      accentColor="#5A5A40"
                      filling={isFillingPreset}
                    />
                  </CssGooeyStack>

                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
                    * Faixa agronômica padrão: 50% a 60% do total.
                  </p>
                </div>

                {/* 3rd Application — V8-V10 (% values, auto-calculated) — Cell Division Animation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#3D3D3D] dark:text-[#E8E6DF]">
                      3ª Aplicação (V8-V10) — Percentual
                    </span>
                    {baseDoseMode === 'single' ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#D4A373]' : 'bg-[#F0EDE5] text-[#8D6E63]'
                      }`}>
                        Auto-calculado
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isDark ? 'bg-[#2C3328] text-[#D4A373]' : 'bg-[#F0EDE5] text-[#8D6E63]'
                      }`}>
                        2 valores %
                      </span>
                    )}
                  </div>

                  {baseDoseMode === 'single' ? (
                    <>
                      <div className={`p-4 rounded-xl border text-center ${
                        isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
                      }`}>
                        <span className={`text-[10px] font-bold block mb-1 ${
                          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                        }`}>Auto-calculado para fechar o balanço</span>
                        <span className="text-lg font-bold text-[#8D6E63] dark:text-[#D4A373]">
                          {calculations.v8v10_1_auto}%
                        </span>
                        <span className={`text-xs ml-2 ${
                          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                        }`}>do total</span>
                      </div>
                    </>
                  ) : (
                    <CssGooeyStack collapsed={false}>
                      <Input3D
                        label={baseDoseMode === 'range' ? 'Min %' : '% do total'}
                        labelMorph
                        unit="%"
                        value={v8v10Percent}
                        onChange={setV8v10PercentValue}
                        step={1}
                        min={0}
                        max={100}
                        placeholder="Ex: 20"
                        isDark={isDark}
                        accentColor="#8D6E63"
                        derived={v8v10Percent === 0}
                        hint={v8v10Percent === 0 ? `Auto-calculado: ${calculations.v8v10_1_auto}%` : undefined}
                        filling={isFillingPreset}
                      />
                      <Input3D
                        label="Max %"
                        labelMorph
                        unit="%"
                        value={v8v10Percent2}
                        onChange={setV8v10Percent2Value}
                        step={1}
                        min={0}
                        max={100}
                        placeholder="0"
                        isDark={isDark}
                        accentColor="#8D6E63"
                        derived={v8v10Percent2 === 0 && v4v6Percent2 > 0}
                        hint={v8v10Percent2 === 0 && v4v6Percent2 > 0 ? `Auto-calculado: ${calculations.v8v10_2_auto}%` : undefined}
                        filling={isFillingPreset}
                      />
                    </CssGooeyStack>
                  )}

                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
                    * Se deixar em 0%, o sistema calcula automaticamente para fechar o balanço. Faixa padrão: 20% a 30%.
                  </p>
                </div>
              </div>
            </div>

        {/* RESULTS SECTION — core metrics */}
          <section id="results_section" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ExtracaoTotalCard
                totalExtraction={calculations.totalExtraction}
                yieldGoal={yieldGoal}
                nRequirementPerBag={nRequirementPerBag}
              />
              <NecessidadeLiquidaCard
                liquidNeed={calculations.liquidNeed}
                totalExtraction={calculations.totalExtraction}
                mosNContribution={mosNContribution}
                soyNContribution={soyNContribution}
              />
              <div id="card_dose_total" className="col-span-2 sm:col-span-3">
                <DoseRecomendadaCard
                  recommendedDose={calculations.recommendedDose}
                  liquidNeed={calculations.liquidNeed}
                  efficiency={efficiency}
                />
              </div>
            </div>

            <SecondaryCreditsCard
              totalExtraction={calculations.totalExtraction}
              mosNContribution={mosNContribution}
              soyNContribution={soyNContribution}
            />
          </section>

        {/* PARCELAMENTO SECTION — split schedule */}
          <section id="parcelamento_results" className="space-y-6">
            <ParcelamentoSection
              calculations={calculations}
              splitBase={splitBase}
              v4v6Percent={v4v6Percent}
              v4v6Percent2={v4v6Percent2}
              v8v10Percent={v8v10Percent}
              v8v10Percent2={v8v10Percent2}
              baseDoseMode={baseDoseMode}
            />
          </section>

        {/* BALANCO SECTION — balance validation */}
          <section id="balanco_results" className="space-y-6">
            <BalancoSection calculations={calculations} />
          </section>

        {/* DETAILED FORMULA AND MATHEMATICAL EXPLANATIONS PANEL */}
        <DetailedMathPanel
          calculations={calculations}
          mosNContribution={mosNContribution}
          soyNContribution={soyNContribution}
        />
          </ScrollStack>
            </div>
          }
          productivityContent={productivityContent}
          itrContent={itrContent}
          abntContent={abntContent}
        />

        {/* GEMINI LIVE VOICE ASSISTANT HUD WITH 3D ORB */}
        <VoiceAssistantHUD
          agentState={voiceAgent.state}
          onConnect={voiceAgent.connect}
          onDisconnect={voiceAgent.disconnect}
          onToggleMute={voiceAgent.toggleMute}
        />


        {/* FOOTER */}
        <footer className="p-4 text-center border-t border-[#F0EDE5] dark:border-[#2C3328] text-[10px] text-[#8C897E] dark:text-[#9EA399] bg-[#F9F8F6] dark:bg-[#1C201A] rounded-2xl transition-colors">
          🌿 Desenvolvido para auxílio na tomada de decisão agronômica. Consulte sempre um Engenheiro Agrônomo.
        </footer>

      </div>
    </main>
    </>
  );
}
