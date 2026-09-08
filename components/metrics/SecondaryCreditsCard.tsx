'use client';

import React from 'react';
import { useTheme } from '@/components/ThemeProvider';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import { NumberTicker } from '@/components/godui/number-ticker';
import { ElasticText } from '@/components/godui/elastic-text';

interface Props {
  totalExtraction: number;
  mosNContribution: number;
  soyNContribution: number;
  animKey?: string | number;
}

export default React.memo(function SecondaryCreditsCard({ totalExtraction, mosNContribution, soyNContribution, animKey }: Props) {
  const { isDark } = useTheme();
  const [showCreditsCalc, setShowCreditsCalc] = React.useState(false);

  const mosResult = Number((totalExtraction - mosNContribution).toFixed(2));
  const soyResult = Number((totalExtraction - soyNContribution).toFixed(2));

  return (
    <div className="relative bg-white dark:bg-[#1C201A] rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] p-5 shadow-sm grid grid-cols-2 gap-4 transition-colors">
      <CalculationIsland
        isVisible={showCreditsCalc}
        onToggle={() => setShowCreditsCalc(!showCreditsCalc)}
        accentColor="#5A5A40"
        darkAccentColor="#9CB386"
        isDark={isDark}
      />
      <div className="relative border-r border-[#F0EDE5] dark:border-[#2C3328] pr-2">
        <ElasticText className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block" mode="auto" startOnView loop={false}>
          N Proveniente da MOS
        </ElasticText>
        <div className="mt-1.5 text-2xl font-bold text-[#5A5A40] dark:text-[#9CB386]">
          <NumberTicker key={animKey} value={mosResult} decimalPlaces={2} className="text-2xl font-bold text-[#5A5A40] dark:text-[#9CB386]" />{' '}
          <span className="text-xs font-semibold text-[#8C897E] dark:text-[#9EA399]">kg N/ha</span>
        </div>
        <div className="mt-2 text-[10px] text-[#8C897E] dark:text-[#9EA399] border-t border-[#F0EDE5] dark:border-[#2C3328] pt-2 font-medium">
          Extração − MOS
        </div>
        <CalculationMemoryPanel isVisible={showCreditsCalc} isDark={isDark}>
          <div className={`p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed ${
            isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
          }`}>
            <div className={`font-semibold mb-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>FÓRMULA:</div>
            <div className={`font-bold ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`}>E = Extração Total − MOS</div>
            <div className={`border-t my-1 pt-1 font-bold ${isDark ? 'border-[#2C3328] text-[#D4A373]' : 'border-[#F0EDE5] text-[#8D6E63]'}`}>
              {totalExtraction.toFixed(2)} − {mosNContribution.toFixed(2)} = {mosResult.toFixed(2)} kg N/ha
            </div>
            <p className={`mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Reduz a necessidade química de adubação nitrogenada.
            </p>
          </div>
        </CalculationMemoryPanel>
      </div>
      <div className="relative pl-2">
        <ElasticText className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block" mode="auto" startOnView loop={false}>
          Crédito da Soja
        </ElasticText>
        <div className="mt-1.5 text-2xl font-bold text-[#5A5A40] dark:text-[#9CB386]">
          <NumberTicker key={animKey} value={soyResult} decimalPlaces={2} className="text-2xl font-bold text-[#5A5A40] dark:text-[#9CB386]" />{' '}
          <span className="text-xs font-semibold text-[#8C897E] dark:text-[#9EA399]">kg N/ha</span>
        </div>
        <div className="mt-2 text-[10px] text-[#8C897E] dark:text-[#9EA399] border-t border-[#F0EDE5] dark:border-[#2C3328] pt-2 font-medium">
          Extração − Soja
        </div>
        <CalculationMemoryPanel isVisible={showCreditsCalc} isDark={isDark}>
          <div className={`p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed ${
            isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
          }`}>
            <div className={`font-semibold mb-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>FÓRMULA:</div>
            <div className={`font-bold ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`}>Crédito Soja = Extração Total − N Soja</div>
            <div className={`border-t my-1 pt-1 font-bold ${isDark ? 'border-[#2C3328] text-[#D4A373]' : 'border-[#F0EDE5] text-[#8D6E63]'}`}>
              {totalExtraction.toFixed(2)} − {soyNContribution.toFixed(2)} = {soyResult.toFixed(2)} kg N/ha
            </div>
            <p className={`mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Crédito da leguminosa anterior (soja) reduz a dose de N.
            </p>
          </div>
        </CalculationMemoryPanel>
      </div>
    </div>
  );
});
