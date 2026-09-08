'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import Button3D from '@/components/Button3D';
import { Sparkles } from 'lucide-react';
import { useAnimationLock } from '@/lib/useAnimationLock';
import { ElasticText } from '@/components/godui/elastic-text';
import { SplitFlapValue } from '@/components/godui/split-flap-value';

interface Props {
  isDark: boolean;
  produtividadeLiquida: number;
  scHaBruto: number;
  quebraValor: number;
  quebraDecimal: number;
  plantasPorMetro: number;
  espacamentoLinhas: number;
  fileiras: number;
  graosPorFileira: number;
  espigas: number;
  pmg: number;
  pmgUnitario: number;
  quantidadeGraos: number;
  estande: number;
  onApplyToNitrogen: () => void;
}

export default function CornYieldResultCard({
  isDark,
  produtividadeLiquida,
  scHaBruto,
  quebraValor,
  quebraDecimal,
  plantasPorMetro,
  espacamentoLinhas,
  fileiras,
  graosPorFileira,
  espigas,
  pmg,
  pmgUnitario,
  quantidadeGraos,
  estande,
  onApplyToNitrogen,
}: Props) {
  const [showCalcYield, setShowCalcYield] = useState(false);
  const { withLock } = useAnimationLock(400);

  return (
    <div id="corn_yield_results" className={`calc-island-scoop p-6 rounded-3xl border shadow-md space-y-5 transition-colors relative ${
      isDark ? 'bg-[#1F221B] border-[#373C2C]' : 'bg-white border-[#E5E2D9]'
    }`}>
      <CalculationIsland
        isVisible={showCalcYield}
        onToggle={() => setShowCalcYield(!showCalcYield)}
        accentColor="#5A5A40"
        darkAccentColor="#9CB386"
        isDark={isDark}
      />

      <div className="border-b pb-3 border-[#F0EDE5] dark:border-[#2F3329] flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#A6A395]">
          <ElasticText className="text-xs font-bold uppercase tracking-wider" mode="auto" startOnView loop={false}>
            Resultado Final da Estimativa
          </ElasticText>
        </span>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#D4A373]/20 text-[#D4A373] font-bold">
          Safra Milho
        </span>
      </div>

      {/* BIG METRIC: PRODUTIVIDADE LÍQUIDA */}
      <motion.div
        className="p-5 rounded-2xl bg-gradient-to-br from-[#5A5A40] to-[#454530] text-white shadow-md space-y-2"
        animate={{ scale: [1, 1.005, 1] }}
        transition={{ duration: 0.4 }}
        key={produtividadeLiquida}
      >
        <div className="flex justify-between items-start">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            <ElasticText className="text-[11px] font-bold uppercase tracking-wider" mode="auto" startOnView loop={false}>
              Produtividade Líquida (Após Quebra)
            </ElasticText>
          </span>
          <motion.span
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <svg className="h-5 w-5 text-[#86efac]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </motion.span>
        </div>
        <div className="flex items-baseline gap-2">
          <motion.span
            className="text-4xl sm:text-5xl font-mono font-extrabold text-white tracking-tight"
            key={String(produtividadeLiquida)}
            style={{ display: 'inline-block' }}
            initial={{ scale: 1.1, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {Number.isNaN(produtividadeLiquida) ? '0' : produtividadeLiquida}
          </motion.span>
          <span className="text-lg font-medium text-white/90">sc/ha</span>
        </div>
        <div className="text-xs text-white/80 pt-1 border-t border-white/20 flex justify-between">
          <span>Total em Grãos:</span>
          <strong>{Number((produtividadeLiquida * 60).toFixed(0)).toLocaleString('pt-BR')} kg/ha</strong>
        </div>
      </motion.div>

      {/* SUB METRICS: BRUTO E QUEBRA */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3.5 rounded-2xl border transition-colors ${
          isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}>
          <span className="text-[10px] uppercase font-bold text-[#8C897E] dark:text-[#A6A395] block">
            <ElasticText className="text-[10px] uppercase font-bold" mode="auto" startOnView loop={false}>
              Produtividade Bruta
            </ElasticText>
          </span>
          <div className="text-xl font-mono font-bold text-[#5A5A40] dark:text-[#A3B18A] mt-1">
            {scHaBruto} <span className="text-xs font-normal">sc/ha</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border transition-colors ${
          isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}>
          <span className="text-[10px] uppercase font-bold text-[#D4A373] block">
            <ElasticText className="text-[10px] uppercase font-bold" mode="auto" startOnView loop={false}>
              Quebra / Perda ({quebraDecimal * 100}%)
            </ElasticText>
          </span>
          <div className="text-xl font-mono font-bold text-[#D4A373] mt-1">
            -{quebraValor} <span className="text-xs font-normal">sc/ha</span>
          </div>
        </div>
      </div>

      {/* ACTION BUTTON: APPLY TO NITROGEN CALCULATOR */}
      <Button3D
        id="btn_apply_yield_to_n"
        variant="primary"
        size="lg"
        isDark={isDark}
        onClick={withLock(onApplyToNitrogen)}
        icon={<Sparkles className="h-4 w-4 text-[#86efac]" />}
        iconRight={<svg className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
        tooltip="Transfere esta produtividade diretamente para a calculadora de Nitrogênio"
        className="w-full"
      >
        Usar esta Produtividade no Cálculo de Nitrogênio
      </Button3D>

      <CalculationMemoryPanel isVisible={showCalcYield} isDark={isDark}>
        <div className={`p-3 rounded-lg border text-[11px] leading-relaxed space-y-1.5 ${
          isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
        }`}>
          <div className={`font-bold text-xs mb-2 ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`}>Passo a Passo — Estimativa de Milho:</div>
          <div><span className={`font-semibold ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>1. Estande:</span> {plantasPorMetro} ÷ {espacamentoLinhas} × 10.000 = {estande} plantas/ha</div>
          <div><span className={`font-semibold ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>2. Grãos/espiga:</span> {fileiras} × {graosPorFileira} = {quantidadeGraos} grãos</div>
          <div><span className={`font-semibold ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>3. PMG unitário:</span> {pmg} ÷ 1000 = {pmgUnitario.toFixed(3)} g/grão</div>
          <div><span className={`font-semibold ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>4. Produtividade Bruta:</span></div>
          <div className="ml-2">({estande} × {espigas} × {quantidadeGraos} × {pmgUnitario.toFixed(3)}) ÷ 1000 = {Number((estande * espigas * quantidadeGraos * pmgUnitario / 1000).toFixed(1))} kg/ha</div>
          <div className="ml-2 flex items-baseline gap-2">{Number((estande * espigas * quantidadeGraos * pmgUnitario / 1000).toFixed(1))} ÷ 60 = <SplitFlapValue value={scHaBruto} size="sm" unit="sc/ha" /></div>
          <div><span className={`font-semibold ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>5. Produtividade Líquida ({quebraDecimal * 100}% perda):</span></div>
          <div className="flex items-baseline gap-2">{scHaBruto} × {(1 - quebraDecimal).toFixed(2)} = <SplitFlapValue value={produtividadeLiquida} size="sm" unit="sc/ha" /></div>
        </div>
      </CalculationMemoryPanel>
    </div>
  );
}