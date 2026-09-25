'use client';

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import { NumberTicker } from '@/components/godui/number-ticker';
import { ElasticText } from '@/components/godui/elastic-text';
import { PRESET_FERTILIZERS } from '@/lib/fertilizers';

interface Props {
  liquidNeed: number;
  animKey?: string | number;
  selectedPreset?: string;
  customTeorN?: number;
  onChange?: (patch: { preset?: string; customTeorN?: number }) => void;
}

export default React.memo(function FonteNitrogenadaCard({
  liquidNeed,
  animKey,
  selectedPreset: selectedPresetProp = 'ureia',
  customTeorN: customTeorNProp = 45,
  onChange,
}: Props) {
  const { isDark } = useTheme();
  const [showCalc, setShowCalc] = useState(false);
  const [localPreset, setLocalPreset] = useState('ureia');
  const [localTeor, setLocalTeor] = useState(45);

  const controlled = onChange !== undefined;
  const selectedPreset = controlled ? selectedPresetProp : localPreset;
  const customTeorN = controlled ? customTeorNProp : localTeor;

  const applyPreset = (id: string) => {
    const preset = PRESET_FERTILIZERS.find((p) => p.id === id);
    if (controlled) {
      onChange?.({ preset: id, ...(id !== 'custom' && preset ? { customTeorN: preset.teorN } : {}) });
    } else {
      setLocalPreset(id);
      if (id !== 'custom' && preset) setLocalTeor(preset.teorN);
    }
  };

  const applyTeor = (val: number) => {
    if (controlled) {
      onChange?.({ customTeorN: val, ...(selectedPreset !== 'custom' ? { preset: 'custom' } : {}) });
    } else {
      setLocalTeor(val);
      if (selectedPreset !== 'custom') setLocalPreset('custom');
    }
  };

  const activeTeorN = useMemo(() => {
    if (selectedPreset === 'custom') return customTeorN;
    const preset = PRESET_FERTILIZERS.find((p) => p.id === selectedPreset);
    return preset ? preset.teorN : 45;
  }, [selectedPreset, customTeorN]);

  const fertilizerResult = useMemo(() => {
    if (activeTeorN <= 0) return 0;
    return Number((liquidNeed / (activeTeorN / 100)).toFixed(2));
  }, [liquidNeed, activeTeorN]);

  const handlePresetChange = (id: string) => {
    applyPreset(id);
  };

  const selectedName = useMemo(() => {
    if (selectedPreset === 'custom') return 'Personalizado';
    return PRESET_FERTILIZERS.find((p) => p.id === selectedPreset)?.name || '';
  }, [selectedPreset]);

  return (
    <div className="relative flex flex-col min-h-[120px]">
      <CalculationIsland
        isVisible={showCalc}
        onToggle={() => setShowCalc(!showCalc)}
        accentColor="#5A5A40"
        darkAccentColor="#9CB386"
        isDark={isDark}
      />

      <div
        className={`calc-island-scoop rounded-3xl p-5 shadow-sm overflow-hidden flex flex-col justify-between h-full transition-colors ${
          isDark
            ? 'bg-[#1C201A] text-white border border-[#2C3328]'
            : 'bg-white border border-[#E5E2D9]'
        }`}
      >
        <div>
          <ElasticText
            className={`text-[10px] font-bold uppercase tracking-widest block ${
              isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
            }`}
            mode="auto"
            startOnView
            loop={false}
          >
            4. Escolha de Fonte Nitrogenada
          </ElasticText>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {/* Preset selector */}
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
              }`}>
                Fonte de N
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 text-xs font-bold border transition-colors ${
                  isDark
                    ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]'
                    : 'bg-[#F9F8F6] border-[#E5E2D9] text-[#3D3D3D]'
                }`}
              >
                {PRESET_FERTILIZERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.id !== 'custom' ? ` (${p.teorN}%)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Teor de N input */}
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
                isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
              }`}>
                Teor de N (%)
              </label>
              <input
                type="number"
                value={activeTeorN}
                onChange={(e) => {
                  applyTeor(Number(e.target.value));
                }}
                min={1}
                max={100}
                step={0.1}
                className={`w-full rounded-lg px-3 py-2 text-xs font-bold border transition-colors ${
                  isDark
                    ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]'
                    : 'bg-[#F9F8F6] border-[#E5E2D9] text-[#3D3D3D]'
                }`}
              />
            </div>
          </div>

          {/* Result display */}
          <div className="mt-4">
            <div className={`text-[10px] font-bold uppercase tracking-widest block ${
              isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
            }`}>
              Fertilizante ({selectedName})
            </div>
            <div className={`mt-1.5 text-2xl font-bold ${
              isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'
            }`}>
              <NumberTicker
                key={animKey}
                value={fertilizerResult}
                decimalPlaces={2}
                className={`text-2xl font-bold ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`}
              />{' '}
              <span className={`text-xs font-semibold ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
                kg/ha
              </span>
            </div>
            <div className={`mt-2 text-[10px] border-t pt-2 font-medium ${
              isDark ? 'text-[#9EA399] border-[#2C3328]' : 'text-[#8C897E] border-[#F0EDE5]'
            }`}>
              {activeTeorN}% de N → {fertilizerResult.toFixed(2)} kg produto/ha
            </div>
          </div>
        </div>
      </div>

      <CalculationMemoryPanel isVisible={showCalc} isDark={isDark}>
        <div className={`p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed ${
          isDark ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
        }`}>
          <div className={`font-semibold mb-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>FÓRMULA:</div>
          <div className={`font-bold ${isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'}`}>
            Fertilizante = N_Liq ÷ (Teor N ÷ 100)
          </div>
          <div className={`border-t my-1 pt-1 font-bold ${isDark ? 'border-[#2C3328] text-[#D4A373]' : 'border-[#F0EDE5] text-[#8D6E63]'}`}>
            {liquidNeed.toFixed(2)} ÷ {activeTeorN / 100} = {fertilizerResult.toFixed(2)} kg/ha
          </div>
          <p className={`mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
            Conversão de N líquido para quantidade de produto fertilizante ({selectedName} com {activeTeorN}% de N).
          </p>
        </div>
      </CalculationMemoryPanel>
    </div>
  );
});
