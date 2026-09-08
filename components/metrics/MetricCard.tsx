'use client';

import React, { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import { NumberTicker } from '@/components/godui/number-ticker';
import { ElasticText } from '@/components/godui/elastic-text';
import { MetricCardProps } from '@/lib/types';

export default function MetricCard({
  label,
  value,
  unit,
  formulaSummary,
  isDark,
  accentColor = '#5A5A40',
  darkAccentColor = '#9CB386',
  variant = 'default',
  saveAction,
  animKey,
  children,
}: MetricCardProps) {
  const [showCalc, setShowCalc] = useState(false);

  const isHero = variant === 'hero';

  return (
    <div className="relative flex flex-col min-h-[120px]">
      <CalculationIsland
        isVisible={showCalc}
        onToggle={() => setShowCalc(!showCalc)}
        accentColor={isHero ? '#8D6E63' : accentColor}
        darkAccentColor={isHero ? '#D4A373' : darkAccentColor}
        isDark={isDark}
      />

      <div
        className={`calc-island-scoop rounded-3xl p-5 shadow-sm overflow-hidden flex flex-col justify-between h-full transition-colors ${
          isHero
            ? 'bg-[#5A5A40] dark:bg-[#263122] text-white border border-transparent dark:border-[#3D4C37] shadow-md'
            : 'bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#2C3328]'
        }`}
      >
        <div>
          {isHero ? (
            <div className="flex justify-between items-start">
              <ElasticText className="text-[10px] font-bold uppercase tracking-widest opacity-85 block" mode="auto" startOnView loop={false}>
                {label}
              </ElasticText>
              {saveAction && (
                <button
                  type="button"
                  onClick={saveAction.onClick}
                  className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all text-[10px] flex items-center gap-1 font-bold border border-white/15"
                  title="Salvar este cálculo no histórico local"
                >
                  <BookmarkPlus className="h-3 w-3 text-[#D4A373]" />
                  <span>{saveAction.label}</span>
                </button>
              )}
            </div>
          ) : (
            <ElasticText className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block" mode="auto" startOnView loop={false}>
              {label}
            </ElasticText>
          )}
          <div
            className={`mt-1.5 ${
              isHero
                ? 'text-3xl font-bold font-serif'
                : 'text-2xl font-bold text-[#5A5A40] dark:text-[#9CB386]'
            }`}
          >
            <NumberTicker
              key={animKey}
              value={value}
              decimalPlaces={2}
              className={isHero ? 'text-3xl font-bold font-serif' : 'text-2xl font-bold text-[#5A5A40] dark:text-[#9CB386]'}
            />{' '}
            <span
              className={`text-xs font-semibold ${
                isHero
                  ? 'text-xs font-sans font-normal opacity-80'
                  : 'text-[#8C897E] dark:text-[#9EA399]'
              }`}
            >
              {unit}
            </span>
          </div>
        </div>

        <div
          className={`mt-2 text-[10px] border-t pt-2 font-medium ${
            isHero
              ? 'opacity-75 border-white/20'
              : 'text-[#8C897E] dark:text-[#9EA399] border-[#F0EDE5] dark:border-[#2C3328]'
          }`}
        >
          {formulaSummary}
        </div>
      </div>

      <CalculationMemoryPanel isVisible={showCalc} isDark={isDark}>
        {children}
      </CalculationMemoryPanel>
    </div>
  );
}
