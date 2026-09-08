'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Calculations } from '@/lib/types';
import { ElasticText } from '@/components/godui/elastic-text';
import { SplitFlapValue } from '@/components/godui/split-flap-value';

interface Props {
  calculations: Calculations;
  mosNContribution: number;
  soyNContribution: number;
}

export default function DetailedMathPanel({ calculations, mosNContribution, soyNContribution }: Props) {
  const { isDark } = useTheme();

  return (
    <section id="detailed_math_panel" className="bg-white dark:bg-[#1C201A] rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] p-6 shadow-sm transition-colors">
      <div className="bg-[#FDFBF7] dark:bg-[#151813] border border-[#E5E2D9] dark:border-[#2C3328] p-5 rounded-xl text-xs text-[#3D3D3D] dark:text-[#E8E6DF] leading-relaxed space-y-2">
        <h4 className="font-bold text-[#5A5A40] dark:text-[#9CB386] flex items-center gap-1.5 text-sm">
          <Info className="h-4 w-4 text-[#5A5A40] dark:text-[#9CB386]" /> <ElasticText className="text-sm font-bold" mode="auto" startOnView loop={false}>Resumo de Respostas e Conferência (Pronto para Copiar)</ElasticText>
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-3 my-1">
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">Extração</div>
            <SplitFlapValue value={calculations.totalExtraction} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">N Líquida</div>
            <SplitFlapValue value={calculations.liquidNeed} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">Dose Final</div>
            <SplitFlapValue value={calculations.recommendedDose} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">MOS</div>
            <SplitFlapValue value={mosNContribution} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">Soja</div>
            <SplitFlapValue value={soyNContribution} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">Base</div>
            <SplitFlapValue value={calculations.base1_kg} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">V4-V6 (50-60%)</div>
            <SplitFlapValue value={calculations.v4v6_50} size="sm" /> a <SplitFlapValue value={calculations.v4v6_60} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">V8-V10 (20-30%)</div>
            <SplitFlapValue value={calculations.v8v10_20} size="sm" /> a <SplitFlapValue value={calculations.v8v10_30} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">Diferença</div>
            <SplitFlapValue value={calculations.splitDifference} size="sm" unit="kg N/ha" />
          </div>
          <div className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399] mb-1">Soma Parcelas</div>
            <SplitFlapValue value={calculations.sumOfSplits} size="sm" unit="kg N/ha" />
          </div>
        </div>
      </div>
    </section>
  );
}
