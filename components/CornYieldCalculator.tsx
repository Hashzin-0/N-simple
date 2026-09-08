'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Calculator, 
  Sprout, 
  HelpCircle, 
  CheckCircle2, 
  RotateCcw,
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';
import CornEar3DVisualizer from './CornEar3DVisualizer';
import Elastic3DSlider from './Elastic3DSlider';
import Input3D from './Input3D';
import Button3D from './Button3D';
import { useTheme } from './ThemeProvider';
import CornYieldResultCard from './metrics/CornYieldResultCard';
import PresetMultiButton from './godui/preset-multi-button';
import { useAnimationLock } from '@/lib/useAnimationLock';
import { SplitFlapValue } from '@/components/godui/split-flap-value';
import type { AgronomicValidationIssue } from '@/lib/types';

interface CornYieldCalculatorProps {
  onApplyYieldGoal?: (scHa: number) => void;
  isConnected?: boolean;
}

interface YieldPreset {
  id: string;
  name: string;
  description: string;
  plantasPorMetro: number;
  espacamentoLinhas: number;
  fileiras: number;
  graosPorFileira: number;
  espigas: number;
  pmg: number;
  quebraDecimal: number;
}

const YIELD_PRESETS: YieldPreset[] = [
  {
    id: 'milho_alto',
    name: 'Alto Rendimento',
    description: 'Milho irrigado com alta população e grãos pesados, acima de 180 sc/ha.',
    plantasPorMetro: 4.5,
    espacamentoLinhas: 0.50,
    fileiras: 18,
    graosPorFileira: 40,
    espigas: 1.1,
    pmg: 320,
    quebraDecimal: 0.04,
  },
  {
    id: 'milho_medio',
    name: 'Médio Rendimento',
    description: 'Milho de sequeiro com manejo padrão, entre 120-160 sc/ha.',
    plantasPorMetro: 4.0,
    espacamentoLinhas: 0.50,
    fileiras: 16,
    graosPorFileira: 35,
    espigas: 1.0,
    pmg: 300,
    quebraDecimal: 0.05,
  },
  {
    id: 'milho_baixo',
    name: 'Baixo Rendimento',
    description: 'Milho com limitações hídricas ou solo pobre, abaixo de 100 sc/ha.',
    plantasPorMetro: 3.2,
    espacamentoLinhas: 0.60,
    fileiras: 14,
    graosPorFileira: 28,
    espigas: 0.9,
    pmg: 260,
    quebraDecimal: 0.08,
  },
];

export default function CornYieldCalculator({ onApplyYieldGoal, isConnected }: CornYieldCalculatorProps) {
  const { isDark } = useTheme();

  const [plantasPorMetro, setPlantasPorMetro] = useState<number>(0);
  const [espacamentoLinhas, setEspacamentoLinhas] = useState<number>(0);
  const [fileiras, setFileiras] = useState<number>(0);
  const [graosPorFileira, setGraosPorFileira] = useState<number>(0);
  const [espigas, setEspigas] = useState<number>(0);
  const [pmg, setPmg] = useState<number>(0);
  const [quebraDecimal, setQuebraDecimal] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string>('personalizado');
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(true);
  const { withLock } = useAnimationLock(400);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);
  
  // Animation state for filling fields when loading presets
  const [fillingFields, setFillingFields] = useState<Set<string>>(new Set());
  const fillingTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Calculations
  const estande = useMemo(() => {
    return Number((plantasPorMetro / espacamentoLinhas * 10000).toFixed(0));
  }, [plantasPorMetro, espacamentoLinhas]);

  const quantidadeGraos = useMemo(() => {
    return Number((fileiras * graosPorFileira).toFixed(0));
  }, [fileiras, graosPorFileira]);

  const pmgUnitario = useMemo(() => pmg / 1000, [pmg]);

  const kgHaBruto = useMemo(() => {
    const raw = (estande * espigas * quantidadeGraos * pmgUnitario) / 1000;
    return Number(raw.toFixed(1));
  }, [estande, espigas, quantidadeGraos, pmgUnitario]);

  const scHaBruto = useMemo(() => Number((kgHaBruto / 60).toFixed(2)), [kgHaBruto]);

  const produtividadeLiquida = useMemo(() => {
    return Number((scHaBruto * (1 - quebraDecimal)).toFixed(2));
  }, [scHaBruto, quebraDecimal]);

  const quebraValor = useMemo(() => {
    return Number((scHaBruto - produtividadeLiquida).toFixed(2));
  }, [scHaBruto, produtividadeLiquida]);

  // Agronomic validation
  const agronomicIssues = useMemo((): AgronomicValidationIssue[] => {
    const issues: AgronomicValidationIssue[] = [];

    if (plantasPorMetro < 2.5 || plantasPorMetro > 6.0) {
      issues.push({
        field: 'plantasPorMetro',
        label: 'Plantas por Metro',
        currentValue: plantasPorMetro,
        typicalRange: '2.5 a 6.0 pl/m',
        severity: plantasPorMetro < 1.5 || plantasPorMetro > 8.0 ? 'critical' : 'warning',
        message: plantasPorMetro < 2.5
          ? 'População muito baixa para milho. Comumente utilizam-se 3.0 a 5.5 pl/m.'
          : 'População excessiva, pode causar competição por luz e nutrients.',
        recommendedValue: 4.0,
      });
    }

    if (espacamentoLinhas < 0.40 || espacamentoLinhas > 0.80) {
      issues.push({
        field: 'espacamentoLinhas',
        label: 'Espaçamento entre Linhas',
        currentValue: espacamentoLinhas,
        typicalRange: '0.40 a 0.80 m',
        severity: espacamentoLinhas < 0.30 || espacamentoLinhas > 1.0 ? 'critical' : 'warning',
        message: espacamentoLinhas < 0.40
          ? 'Espaçamento estreito, reduz vigor e dificulta manejo mecânico.'
          : 'Espaçamento largo, reduz população por ha e potencial produtivo.',
        recommendedValue: 0.50,
      });
    }

    if (fileiras < 14 || fileiras > 20) {
      issues.push({
        field: 'fileiras',
        label: 'Fileiras na Espiga',
        currentValue: fileiras,
        typicalRange: '14 a 20 fileiras',
        severity: fileiras < 10 || fileiras > 24 ? 'critical' : 'warning',
        message: fileiras < 14
          ? 'Poucas fileiras, abaixo do típico para híbridos modernos (14-20).'
          : 'Muitas fileiras, pode indicar erros de contagem ou híbrido atípico.',
        recommendedValue: 16,
      });
    }

    if (graosPorFileira < 25 || graosPorFileira > 45) {
      issues.push({
        field: 'graosPorFileira',
        label: 'Grãos por Fileira',
        currentValue: graosPorFileira,
        typicalRange: '25 a 45 grãos',
        severity: graosPorFileira < 15 || graosPorFileira > 55 ? 'critical' : 'warning',
        message: graosPorFileira < 25
          ? 'Baixa contagem de grãos por fileira, pode indicar estresse durante enchimento.'
          : 'Contagem alta, atípica para a maioria dos híbridos comerciais.',
        recommendedValue: 35,
      });
    }

    if (espigas < 0.8 || espigas > 1.5) {
      issues.push({
        field: 'espigas',
        label: 'Espigas / Planta',
        currentValue: espigas,
        typicalRange: '0.8 a 1.5 espigas/planta',
        severity: espigas < 0.5 || espigas > 2.0 ? 'critical' : 'warning',
        message: espigas < 0.8
          ? 'Espigamento baixo, pode indicar estresse hídrico ou nutricional.'
          : 'Múltiplas espigas por planta é atípico em híbridos modernos.',
        recommendedValue: 1.0,
      });
    }

    if (pmg < 200 || pmg > 400) {
      issues.push({
        field: 'pmg',
        label: 'PMG (g/1000 grãos)',
        currentValue: pmg,
        typicalRange: '200 a 400 g',
        severity: pmg < 150 || pmg > 450 ? 'critical' : 'warning',
        message: pmg < 200
          ? 'Peso de mil grãos muito baixo, grãos mal preenchidos.'
          : 'PMG muito alto, pode indicar erro de medição ou híbrido especial.',
        recommendedValue: 300,
      });
    }

    if (quebraDecimal < 0.02 || quebraDecimal > 0.15) {
      issues.push({
        field: 'quebraDecimal',
        label: 'Quebra / Perda (%)',
        currentValue: `${(quebraDecimal * 100).toFixed(1)}%`,
        typicalRange: '2% a 15%',
        severity: quebraDecimal > 0.20 ? 'critical' : 'warning',
        message: quebraDecimal > 0.15
          ? 'Perda de colheita muito acima do normal (típico: 3-10%).'
          : 'Perda de colheita abaixo do esperado, pode subestimar perdas reais.',
        recommendedValue: 0.05,
      });
    }

    return issues;
  }, [plantasPorMetro, espacamentoLinhas, fileiras, graosPorFileira, espigas, pmg, quebraDecimal]);

  const loadPreset = useCallback((p: YieldPreset) => {
    // Clear any existing timers
    fillingTimersRef.current.forEach(clearTimeout);
    fillingTimersRef.current = [];
    
    // Define the fields to fill with their delays (staggered animation)
    const fieldsToFill = [
      { name: 'plantasPorMetro', value: p.plantasPorMetro, delay: 0 },
      { name: 'espacamentoLinhas', value: p.espacamentoLinhas, delay: 80 },
      { name: 'fileiras', value: p.fileiras, delay: 160 },
      { name: 'graosPorFileira', value: p.graosPorFileira, delay: 240 },
      { name: 'espigas', value: p.espigas, delay: 320 },
      { name: 'pmg', value: p.pmg, delay: 400 },
      { name: 'quebraDecimal', value: p.quebraDecimal, delay: 480 },
    ];

    // Set the active preset immediately
    setActivePreset(p.id);

    // Animate each field with staggered delay
    fieldsToFill.forEach(({ name, value, delay }) => {
      const timer = setTimeout(() => {
        // Add field to filling state
        setFillingFields(prev => new Set([...prev, name]));
        
        // Set the actual value
        switch (name) {
          case 'plantasPorMetro': setPlantasPorMetro(value); break;
          case 'espacamentoLinhas': setEspacamentoLinhas(value); break;
          case 'fileiras': setFileiras(value); break;
          case 'graosPorFileira': setGraosPorFileira(value); break;
          case 'espigas': setEspigas(value); break;
          case 'pmg': setPmg(value); break;
          case 'quebraDecimal': setQuebraDecimal(value); break;
        }
        
        // Remove from filling state after animation completes
        setTimeout(() => {
          setFillingFields(prev => {
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
        }, 300);
      }, delay);
      
      fillingTimersRef.current.push(timer);
    });
  }, []);

  const handleApplyToNitrogenCalculator = () => {
    if (onApplyYieldGoal) {
      onApplyYieldGoal(Math.round(produtividadeLiquida));
      setAppliedToast(`Meta de ${Math.round(produtividadeLiquida)} sc/ha aplicada no Simulador de Nitrogênio!`);
      setTimeout(() => setAppliedToast(null), 4000);
      const el = document.getElementById('form_section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helper: check if a field has issues
  const getFieldSeverity = (field: string): 'warning' | 'critical' | undefined => {
    const issue = agronomicIssues.find((i) => i.field === field);
    return issue?.severity;
  };

  return (
    <section id="corn_yield_calculator_section" className="space-y-6">
      
      {/* HEADER CARD */}
      <motion.div
        id="corn_yield_header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`p-6 sm:p-7 rounded-3xl border shadow-sm transition-colors ${
          isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-white border-[#E5E2D9]'
        }`}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-[#F0EDE5] dark:border-[#2F3329]">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-3 rounded-2xl bg-[#D4A373]/20 text-[#D4A373] border border-[#D4A373]/30"
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            >
              <Calculator className="h-6 w-6" />
            </motion.div>
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E8E7DF]">
                Estimativa de Produtividade de Milho
              </h2>
              <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
                Cálculo de estande (população), grãos por espiga, PMG unitário, sc/ha e quebra por perdas.
              </p>
            </div>
          </div>

          {/* PRESET CHIPS */}
          <PresetMultiButton
            presets={YIELD_PRESETS}
            activePreset={activePreset}
            onPresetClick={(p) => withLock(() => loadPreset(p))()}
            isDark={isDark}
          />
        </div>

        {/* NOTIFICATION TOAST */}
        {appliedToast && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mt-4 p-3.5 rounded-2xl bg-[#2E6F40] text-white flex items-center justify-between text-xs font-semibold shadow-md"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#86efac]" />
              <span>{appliedToast}</span>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('form_section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-[11px]"
            >
              Ver Simulador N ↓
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* TWO COLUMN GRID: INPUTS & 3D / RESULTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: PARAMETER INPUTS (7 COLS) */}
        <motion.div
          id="corn_yield_params"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 30, delay: 0.1 }}
          className={`lg:col-span-7 p-6 rounded-3xl border shadow-sm space-y-6 transition-colors ${
            isDark ? 'bg-[#1C1E19] border-[#2E3326]' : 'bg-white border-[#E5E2D9]'
          }`}
        >
          
          <div className="flex items-center justify-between border-b pb-3 border-[#F0EDE5] dark:border-[#2F3329]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A3B18A] flex items-center gap-2">
              <Layers className="h-4 w-4" /> Parâmetros da Lavoura / Questão
            </h3>
            <Button3D
              variant="ghost"
              size="sm"
              isDark={isDark}
              onClick={withLock(() => {
                setPlantasPorMetro(0);
                setEspacamentoLinhas(0);
                setFileiras(0);
                setGraosPorFileira(0);
                setEspigas(0);
                setPmg(0);
                setQuebraDecimal(0);
                setActivePreset('personalizado');
              })}
              icon={<RotateCcw className="h-3 w-3" />}
            >
              Resetar
            </Button3D>
          </div>

          <div className="space-y-5">
            
            {/* 1. PLANTAS POR METRO & ESPAÇAMENTO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input3D
                id="input_plantas_por_metro"
                label="Plantas por Metro"
                unit="pl/m"
                value={plantasPorMetro}
                onChange={(v) => { setPlantasPorMetro(v); setActivePreset('personalizado'); }}
                step={0.1}
                min={1}
                max={10}
                placeholder="Ex: 4.0"
                isDark={isDark}
                accentColor="#5A5A40"
                critical={getFieldSeverity('plantasPorMetro') === 'critical'}
                warning={getFieldSeverity('plantasPorMetro') === 'warning'}
                hint="Contagem linear na linha de semeadura."
                filling={fillingFields.has('plantasPorMetro')}
              />
              <Input3D
                id="input_espacamento_linhas"
                label="Espaçamento entre Linhas"
                unit={`m (${Math.round(espacamentoLinhas * 100)} cm)`}
                value={espacamentoLinhas}
                onChange={(v) => { setEspacamentoLinhas(v); setActivePreset('personalizado'); }}
                step={0.05}
                min={0.30}
                max={1.20}
                placeholder="Ex: 0.50"
                isDark={isDark}
                accentColor="#5A5A40"
                critical={getFieldSeverity('espacamentoLinhas') === 'critical'}
                warning={getFieldSeverity('espacamentoLinhas') === 'warning'}
                hint="Distância entre linhas (metros)."
                filling={fillingFields.has('espacamentoLinhas')}
              />
            </div>

            {/* ESTANDE RESULT CALLOUT */}
            <motion.div
              className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
              }`}
              animate={{ scale: [1, 1.005, 1] }}
              transition={{ duration: 0.3 }}
              key={estande}
            >
              <div className="flex items-center gap-2">
                <Sprout className="h-4 w-4 text-[#D4A373]" />
                <span className="font-semibold text-[#5A5A40] dark:text-[#E8E7DF]">
                  Estande (População Calculada):
                </span>
              </div>
              <div className="font-mono font-bold text-sm text-[#2E6F40] dark:text-[#86efac]">
                {estande.toLocaleString('pt-BR')} <span className="text-xs font-normal">plantas/ha</span>
              </div>
            </motion.div>

            {/* 2. FILEIRAS & GRÃOS POR FILEIRA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input3D
                id="input_fileiras"
                label="Fileiras na Espiga"
                unit="fileiras"
                value={fileiras}
                onChange={(v) => { setFileiras(Math.round(v)); setActivePreset('personalizado'); }}
                step={2}
                min={10}
                max={24}
                placeholder="Ex: 16"
                isDark={isDark}
                accentColor="#5A5A40"
                critical={getFieldSeverity('fileiras') === 'critical'}
                warning={getFieldSeverity('fileiras') === 'warning'}
                hint="Sempre em números pares (12, 14, 16, 18, 20)."
                filling={fillingFields.has('fileiras')}
              />
              <Input3D
                id="input_graos_por_fileira"
                label="Grãos por Fileira"
                unit="grãos"
                value={graosPorFileira}
                onChange={(v) => { setGraosPorFileira(Math.round(v)); setActivePreset('personalizado'); }}
                step={1}
                min={10}
                max={60}
                placeholder="Ex: 35"
                isDark={isDark}
                accentColor="#5A5A40"
                critical={getFieldSeverity('graosPorFileira') === 'critical'}
                warning={getFieldSeverity('graosPorFileira') === 'warning'}
                hint="Contagem média longitudinal de grãos."
                filling={fillingFields.has('graosPorFileira')}
              />
            </div>

            {/* 3. ESPIGAS, PMG & QUEBRA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <Input3D
                id="input_espigas"
                label="Espigas / Planta"
                unit=""
                value={espigas}
                onChange={(v) => { setEspigas(v); setActivePreset('personalizado'); }}
                step={0.05}
                min={0.5}
                max={2.0}
                placeholder="Ex: 1.0"
                isDark={isDark}
                accentColor="#D4A373"
                critical={getFieldSeverity('espigas') === 'critical'}
                warning={getFieldSeverity('espigas') === 'warning'}
                hint="Espigas viáveis por planta (questão: 1.0)."
                filling={fillingFields.has('espigas')}
              />

              <Input3D
                id="input_pmg"
                label="PMG (g / 1000 grãos)"
                unit="g"
                value={pmg}
                onChange={(v) => { setPmg(v); setActivePreset('personalizado'); }}
                step={5}
                min={150}
                max={450}
                placeholder="Ex: 300"
                isDark={isDark}
                accentColor="#D4A373"
                critical={getFieldSeverity('pmg') === 'critical'}
                warning={getFieldSeverity('pmg') === 'warning'}
                hint={`PMG unitário: ${pmgUnitario.toFixed(3)} g/grão`}
                filling={fillingFields.has('pmg')}
              />

              <Input3D
                id="input_quebra"
                label="Quebra / Perda (%)"
                unit={`${(quebraDecimal * 100).toFixed(1)}% (${quebraDecimal})`}
                value={quebraDecimal}
                onChange={(v) => { setQuebraDecimal(v); setActivePreset('personalizado'); }}
                step={0.01}
                min={0}
                max={0.30}
                placeholder="Ex: 0.05"
                isDark={isDark}
                accentColor="#D4A373"
                critical={getFieldSeverity('quebraDecimal') === 'critical'}
                warning={getFieldSeverity('quebraDecimal') === 'warning'}
                hint="Em decimal (ex: 0.05 para 5% de perda)."
                filling={fillingFields.has('quebraDecimal')}
              />
            </div>

          </div>

          {/* EDUCATIONAL STEP-BY-STEP BREAKDOWN PANEL */}
          <motion.div
            className={`rounded-2xl border p-4 transition-colors ${
              isDark ? 'bg-[#181A15] border-[#2E3326]' : 'bg-[#FAF8F3] border-[#E5E2D9]'
            }`}
          >
            <button
              onClick={withLock(() => setShowFormulaDetails(!showFormulaDetails))}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A3B18A]"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-[#D4A373]" />
                <span>Memória de Cálculo Didática (Passo a Passo da Questão)</span>
              </div>
              <motion.div
                animate={{ rotate: showFormulaDetails ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </button>

            {showFormulaDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3.5 space-y-2.5 text-xs text-[#3D3D3D] dark:text-[#D5D4CB] font-mono border-t pt-3 border-[#E5E2D9] dark:border-[#2F3329]"
              >
                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  <span className="text-[#8C897E] dark:text-[#9CA38C]">1. Estande (População):</span>
                  <div className="text-[#5A5A40] dark:text-[#A3B18A] font-bold">
                    {plantasPorMetro} pl/m ÷ {espacamentoLinhas} m × 10.000 = <strong>{estande.toLocaleString('pt-BR')} plantas/ha</strong>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  <span className="text-[#8C897E] dark:text-[#9CA38C]">2. Quantidade de grãos por espiga:</span>
                  <div className="text-[#5A5A40] dark:text-[#A3B18A] font-bold">
                    {fileiras} fileiras × {graosPorFileira} grãos/fileira = <strong>{quantidadeGraos} grãos/espiga</strong>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  <span className="text-[#8C897E] dark:text-[#9CA38C]">3. PMG Unitário (÷ 1000):</span>
                  <div className="text-[#5A5A40] dark:text-[#A3B18A] font-bold">
                    {pmg} g ÷ 1000 = <strong>{pmgUnitario.toFixed(3)} g por grão</strong>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  <span className="text-[#8C897E] dark:text-[#9CA38C]">4. Produtividade Bruta:</span>
                  <div className="text-[#5A5A40] dark:text-[#A3B18A] font-bold">
                    ({estande.toLocaleString('pt-BR')} × {espigas} × {quantidadeGraos} × {pmgUnitario.toFixed(3)}) ÷ 1000 = <strong>{kgHaBruto.toLocaleString('pt-BR')} kg/ha</strong>
                  </div>
                  <div className="text-[#5A5A40] dark:text-[#A3B18A] font-bold mt-0.5 flex items-baseline gap-2">
                    {kgHaBruto.toLocaleString('pt-BR')} kg ÷ 60 = <SplitFlapValue value={scHaBruto} size="sm" unit="sc/ha" />
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                  <span className="text-[#8C897E] dark:text-[#9CA38C]">5. Produtividade Líquida:</span>
                  <div className="text-[#D4A373] font-bold flex items-baseline gap-2">
                    {scHaBruto} sc/ha × {(1 - quebraDecimal).toFixed(2)} ({(quebraDecimal * 100).toFixed(0)}% perda) = <SplitFlapValue value={produtividadeLiquida} size="sm" unit="sc/ha" />
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

        </motion.div>

        {/* RIGHT COLUMN: 3D EAR & ESTIMATED YIELD RESULTS (5 COLS) */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 30, delay: 0.2 }}
          className="lg:col-span-5 space-y-6"
        >
          
          {/* 3D CORN EAR VISUALIZER */}
          <div id="corn_yield_visual">
            <CornEar3DVisualizer
              rows={fileiras}
              kernelsPerRow={graosPorFileira}
              totalKernels={quantidadeGraos}
            />
          </div>

          {/* RESULTS CARD */}
          <CornYieldResultCard
            isDark={isDark}
            produtividadeLiquida={produtividadeLiquida}
            scHaBruto={scHaBruto}
            quebraValor={quebraValor}
            quebraDecimal={quebraDecimal}
            plantasPorMetro={plantasPorMetro}
            espacamentoLinhas={espacamentoLinhas}
            fileiras={fileiras}
            graosPorFileira={graosPorFileira}
            espigas={espigas}
            pmg={pmg}
            pmgUnitario={pmgUnitario}
            quantidadeGraos={quantidadeGraos}
            estande={estande}
            onApplyToNitrogen={handleApplyToNitrogenCalculator}
          />

        </motion.div>

      </div>

    </section>
  );
}
