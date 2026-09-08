'use client';

import React from 'react';
import MetricCard from './MetricCard';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  totalExtraction: number;
  yieldGoal: number;
  nRequirementPerBag: number;
  animKey?: string | number;
}

export default React.memo(function ExtracaoTotalCard({ totalExtraction, yieldGoal, nRequirementPerBag, animKey }: Props) {
  const { isDark } = useTheme();

  return (
    <MetricCard
      label="1. Extração Total (Cultivo)"
      value={totalExtraction}
      unit="kg N/ha"
      formulaSummary={`${yieldGoal} sc/ha × ${nRequirementPerBag.toFixed(2)} kg/sc`}
      isDark={isDark}
      animKey={animKey}
    >
      <div className={`p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed ${
        isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
      }`}>
        <div className={`font-semibold mb-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>FÓRMULA:</div>
        <div className={`font-bold ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`}>E = sc/ha × N_saca</div>
        <div className={`border-t my-1 pt-1 font-bold ${isDark ? 'border-[#2C3328] text-[#D4A373]' : 'border-[#F0EDE5] text-[#8D6E63]'}`}>
          {yieldGoal} × {nRequirementPerBag.toFixed(2)} = {totalExtraction.toFixed(2)} kg N/ha
        </div>
        <p className={`mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
          N total extraído pela cultura para a produtividade planejada.
        </p>
      </div>
    </MetricCard>
  );
});
