'use client';

import React from 'react';
import MetricCard from './MetricCard';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  recommendedDose: number;
  liquidNeed: number;
  efficiency: number;
  onSaveClick?: () => void;
  animKey?: string | number;
}

export default React.memo(function DoseRecomendadaCard({ recommendedDose, liquidNeed, efficiency, onSaveClick, animKey }: Props) {
  const { isDark } = useTheme();

  return (
    <MetricCard
      label="Dose Total a Aplicar"
      value={recommendedDose}
      unit="kg N/ha"
      formulaSummary={`Eficiência: ${efficiency}% (Perdas de ${100 - efficiency}%)`}
      isDark={isDark}
      variant="hero"
      {...(onSaveClick ? { saveAction: { label: 'Salvar', onClick: onSaveClick } } : {})}
      animKey={animKey}
    >
      <div className="p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed bg-[#232821] border-[#2C3328] text-[#E8E6DF]">
        <div className="text-[#9EA399] font-semibold mb-1">FÓRMULA:</div>
        <div className="font-bold text-[#9CB386]">Dose = N_Liq ÷ Efic</div>
        <div className="border-t border-[#2C3328] my-1 pt-1 text-[#D4A373] font-bold">
          {liquidNeed.toFixed(2)} ÷ {efficiency / 100} = {recommendedDose.toFixed(2)} kg N/ha
        </div>
        <p className="mt-1 text-[#9EA399]">
          Dose corrigida considerando a eficiência de {efficiency}%. Perdas estimadas: {100 - efficiency}%.
        </p>
      </div>
    </MetricCard>
  );
});
