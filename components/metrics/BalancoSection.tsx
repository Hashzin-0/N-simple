'use client';

import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ElasticText } from '@/components/godui/elastic-text';
import { Calculations } from '@/lib/types';
import { NumberTicker } from '@/components/godui/number-ticker';

interface Props {
  calculations: Calculations;
  animKey?: string | number;
}

export default function BalancoSection({ calculations, animKey }: Props) {
  const { isDark } = useTheme();

  return (
    <div id="balanco_section" className="calc-island-scoop bg-white dark:bg-[#1C201A] rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] p-6 shadow-sm space-y-4 transition-colors relative">

      <div className="border-b border-[#F0EDE5] dark:border-[#2C3328] pb-3 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E8E6DF] uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" />
            <ElasticText className="text-[10px] font-bold tracking-widest" mode="auto" startOnView loop={false}>
              Validação e Fechamento de Balanço
            </ElasticText>
          </h3>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399] mt-0.5">
            Verifique se o parcelamento soma exatamente a sua meta planejada
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-[#3D3D3D] dark:text-[#E8E6DF]">
          <span>Visualização do Balanço:</span>
          <span className="text-[#5A5A40] dark:text-[#9CB386]">Meta: <NumberTicker key={animKey} value={calculations.targetSplitTotal} decimalPlaces={2} className="text-[#5A5A40] dark:text-[#9CB386]" /> kg N/ha</span>
        </div>

        <div className="h-4 bg-[#F0EDE5] dark:bg-[#2D3429] rounded-full flex overflow-hidden shadow-inner">
          <div
            style={{ width: `${Math.min(100, (calculations.base1_kg / calculations.targetSplitTotal) * 100)}%` }}
            className="bg-[#8C897E] h-full transition-all duration-300"
            title={`Base: ${calculations.base1_kg} kg N/ha`}
          />
          <div
            style={{ width: `${Math.min(100, (calculations.v4v6_1_kg / calculations.targetSplitTotal) * 100)}%` }}
            className="bg-[#5A5A40] dark:bg-[#9CB386] h-full transition-all duration-300"
            title={`V4-V6: ${calculations.v4v6_1_kg} kg N/ha`}
          />
          <div
            style={{ width: `${Math.min(100, (calculations.v8v10_1_kg / calculations.targetSplitTotal) * 100)}%` }}
            className="bg-[#8D6E63] dark:bg-[#D4A373] h-full transition-all duration-300"
            title={`V8-V10: ${calculations.v8v10_1_kg} kg N/ha`}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#8C897E] dark:text-[#9EA399] justify-between border-b border-[#F0EDE5] dark:border-[#2C3328] pb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#8C897E] rounded-sm" />
            <span>1ª Base: <NumberTicker key={animKey} value={calculations.base1_kg} decimalPlaces={2} className="font-medium" /> kg/ha</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#5A5A40] dark:bg-[#9CB386] rounded-sm" />
            <span>2ª V4-V6: <NumberTicker key={animKey} value={calculations.v4v6_1_kg} decimalPlaces={2} className="font-medium" /> kg/ha ({calculations.v4v6_1}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#8D6E63] dark:bg-[#D4A373] rounded-sm" />
            <span>3ª V8-V10: <NumberTicker key={animKey} value={calculations.v8v10_1_kg} decimalPlaces={2} className="font-medium" /> kg/ha ({calculations.v8v10_1_final}%)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
          <div className="space-y-1">
            <div className="text-xs text-[#8C897E] dark:text-[#9EA399]">Soma das Três Aplicações:</div>
            <div className="text-sm font-bold text-[#3D3D3D] dark:text-[#E8E6DF]">
              {calculations.base1_kg} + {calculations.v4v6_1_kg} + {calculations.v8v10_1_kg} = <span className="font-extrabold text-[#5A5A40] dark:text-[#9CB386] text-lg"><NumberTicker key={animKey} value={calculations.sumOfSplits} decimalPlaces={2} className="font-extrabold text-[#5A5A40] dark:text-[#9CB386] text-lg" /> kg N/ha</span>
            </div>
          </div>

          <div>
            {calculations.splitDiscrepancy === 0 ? (
              <div className="bg-[#F9F8F6] dark:bg-[#151813] text-[#5A5A40] dark:text-[#9CB386] border border-[#E5E2D9] dark:border-[#2C3328] p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#5A5A40] dark:text-[#9CB386] shrink-0" />
                <div>
                  <span>Balanço Fechado! (100% OK)</span>
                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] font-normal mt-0.5">A soma corresponde exatamente à meta.</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#FDFBF7] dark:bg-[#201C16] text-[#8D6E63] dark:text-[#E0A96D] border border-[#E5E2D9] dark:border-[#2C3328] p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold">
                <AlertCircle className="h-4.5 w-4.5 text-[#8D6E63] dark:text-[#E0A96D] shrink-0" />
                <div>
                  <span>Diferença de {calculations.splitDiscrepancy > 0 ? '+' : ''}<NumberTicker key={animKey} value={calculations.splitDiscrepancy} decimalPlaces={2} className="font-medium" /> kg N/ha</span>
                  <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] font-normal mt-0.5">Ajuste as frações percentuais para obter um fechamento exato.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
