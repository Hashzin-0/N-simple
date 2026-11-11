'use client';

import React, { useMemo, useState } from 'react';
import { Calculator, RotateCcw, Sprout, Wheat } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import Input3D from '@/components/Input3D';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import { calculateSoybeanYield } from '@/lib/soybeanYield';

const formatNumber = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits });

export default function SoybeanYieldCalculator() {
  const { isDark } = useTheme();
  const [populationPerHa, setPopulationPerHa] = useState(0);
  const [evaluatedPlants, setEvaluatedPlants] = useState(0);
  const [totalPods, setTotalPods] = useState(0);
  const [totalGrains, setTotalGrains] = useState(0);
  const [thousandGrainWeight, setThousandGrainWeight] = useState(0);
  const [lossPercent, setLossPercent] = useState(0);
  const [areaHa, setAreaHa] = useState(0);
  const [showCalculation, setShowCalculation] = useState(false);

  const results = useMemo(() => calculateSoybeanYield({
    populationPerHa,
    evaluatedPlants,
    totalPods,
    totalGrains,
    thousandGrainWeight,
    lossPercent,
  }), [populationPerHa, evaluatedPlants, totalPods, totalGrains, thousandGrainWeight, lossPercent]);

  const reset = () => {
    setPopulationPerHa(0);
    setEvaluatedPlants(0);
    setTotalPods(0);
    setTotalGrains(0);
    setThousandGrainWeight(0);
    setLossPercent(0);
    setAreaHa(0);
  };

  const cardClass = isDark
    ? 'bg-[#1F221B] border-[#373C2C] text-[#E8E6DF]'
    : 'bg-white border-[#E5E2D9] text-[#3D3D3D]';
  const subCardClass = isDark
    ? 'bg-[#242720] border-[#393E32]'
    : 'bg-[#FAF9F5] border-[#E5E2D9]';

  return (
    <section className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div id="soybean_yield_header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E8E7DF]">
              Estimativa de Produtividade de Soja
            </h2>
            <p className="text-xs sm:text-sm text-[#8C897E] dark:text-[#A6A395] mt-0.5">
              Estimativa por amostragem de plantas, legumes, grãos e peso de mil grãos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors border-[#E5E2D9] text-[#5A5A40] hover:bg-[#F5F3EE] dark:border-[#393E32] dark:text-[#C7CEBC] dark:hover:bg-[#242720]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar dados
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div id="soybean_yield_params" className={`xl:col-span-7 rounded-3xl border p-5 sm:p-6 space-y-6 shadow-sm ${cardClass}`}>
          <div className="flex items-center gap-2 border-b pb-3 border-[#F0EDE5] dark:border-[#2F3329]">
            <Wheat className="h-4 w-4 text-[#2E6F40] dark:text-[#9CB386]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A3B18A]">
              Dados da amostragem
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input3D
              id="soybean_population"
              label="População final"
              unit="plantas/ha"
              value={populationPerHa}
              onChange={(value) => setPopulationPerHa(Math.min(500000, Math.max(0, Math.round(value))))}
              step={1000}
              min={1}
              max={500000}
              placeholder="Ex.: 250.000"
              isDark={isDark}
              accentColor="#2E6F40"
              hint="Estande final de plantas por hectare."
            />
            <Input3D
              id="soybean_evaluated_plants"
              label="Plantas avaliadas"
              unit="plantas"
              value={evaluatedPlants}
              onChange={(value) => setEvaluatedPlants(Math.min(1000, Math.max(0, Math.round(value))))}
              step={1}
              min={1}
              max={1000}
              placeholder="Ex.: 10"
              isDark={isDark}
              accentColor="#2E6F40"
              hint="Quantidade de plantas usadas na amostragem."
            />
            <Input3D
              id="soybean_total_pods"
              label="Legumes"
              unit="legumes"
              value={totalPods}
              onChange={(value) => setTotalPods(Math.min(100000, Math.max(0, Math.round(value))))}
              step={1}
              min={1}
              max={100000}
              placeholder="Ex.: 450"
              isDark={isDark}
              accentColor="#2E6F40"
              hint="Total de legumes contados em todas as plantas avaliadas."
            />
            <Input3D
              id="soybean_total_grains"
              label="Grãos"
              unit="grãos"
              value={totalGrains}
              onChange={(value) => setTotalGrains(Math.min(1000000, Math.max(0, Math.round(value))))}
              step={1}
              min={1}
              max={1000000}
              placeholder="Ex.: 1.050"
              isDark={isDark}
              accentColor="#2E6F40"
              hint="Total de grãos encontrados nos legumes avaliados."
            />
            <Input3D
              id="soybean_pmg"
              label="PMG"
              unit="g/1.000 grãos"
              value={thousandGrainWeight}
              onChange={(value) => setThousandGrainWeight(Math.min(1000, Math.max(0, value)))}
              step={1}
              min={1}
              max={1000}
              placeholder="Ex.: 180"
              isDark={isDark}
              accentColor="#D4A373"
              hint="Peso de mil grãos, em gramas."
            />
            <Input3D
              id="soybean_loss"
              label="Quebra"
              unit="%"
              value={lossPercent}
              onChange={(value) => setLossPercent(Math.min(100, Math.max(0, value)))}
              step={0.1}
              min={0}
              max={100}
              placeholder="Ex.: 5"
              isDark={isDark}
              accentColor="#D4A373"
              hint="Percentual de perda aplicado sobre a produtividade bruta."
            />
          </div>

          <div className={`rounded-2xl border p-4 text-xs leading-relaxed ${subCardClass}`}>
            <div className="flex items-center gap-2 font-semibold text-[#5A5A40] dark:text-[#A3B18A] mb-1">
              <Calculator className="h-4 w-4" />
              Critério da amostragem
            </div>
            <p className="text-[#777468] dark:text-[#A6A395]">
              Informe os totais de legumes e grãos encontrados no conjunto de plantas avaliadas.
              A calculadora divide esses totais pela amostra para obter as médias por planta e por legume.
            </p>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-5">
          <div id="soybean_yield_results" className={`relative rounded-3xl border p-5 sm:p-6 shadow-md space-y-5 ${cardClass}`}>
            <CalculationIsland
              isVisible={showCalculation}
              onToggle={() => setShowCalculation((current) => !current)}
              accentColor="#2E6F40"
              darkAccentColor="#9CB386"
              isDark={isDark}
            />
            <div className="border-b pb-3 border-[#F0EDE5] dark:border-[#2F3329]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#A6A395]">
                Resultados da estimativa
              </span>
            </div>

            {results ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-2xl border p-3 ${subCardClass}`}>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Legumes por planta</span>
                    <strong className="block mt-1 text-2xl font-mono text-[#5A5A40] dark:text-[#A3B18A]">{formatNumber(results.podsPerPlant)}</strong>
                    <span className="text-[10px] text-[#8C897E]">legumes/planta</span>
                  </div>
                  <div className={`rounded-2xl border p-3 ${subCardClass}`}>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Grãos por legume</span>
                    <strong className="block mt-1 text-2xl font-mono text-[#5A5A40] dark:text-[#A3B18A]">{formatNumber(results.grainsPerPod)}</strong>
                    <span className="text-[10px] text-[#8C897E]">grãos/legume</span>
                  </div>
                </div>

                <div className="rounded-2xl p-5 bg-gradient-to-br from-[#5A5A40] to-[#454530] text-white space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/75">Produtividade final após quebra</div>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-4xl sm:text-5xl font-mono tracking-tight">{formatNumber(results.finalBagsPerHa)}</strong>
                    <span className="text-sm text-white/85">sc/ha</span>
                  </div>
                  <div className="border-t border-white/20 pt-2 flex items-center justify-between text-xs text-white/80">
                    <span>{formatNumber(results.finalKgPerHa, 1)} kg/ha</span>
                    <span>1 saca = 60 kg</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-2xl border p-3 ${subCardClass}`}>
                    <span className="block text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Produtividade bruta</span>
                    <strong className="block mt-1 text-lg font-mono text-[#5A5A40] dark:text-[#A3B18A]">{formatNumber(results.grossKgPerHa, 1)}</strong>
                    <span className="text-[10px] text-[#8C897E]">kg/ha</span>
                    <div className="mt-1 text-xs font-mono">{formatNumber(results.grossBagsPerHa)} sc/ha</div>
                  </div>
                  <div className={`rounded-2xl border p-3 ${subCardClass}`}>
                    <span className="block text-[10px] uppercase tracking-wide text-[#D4A373]">Quebra aplicada ({formatNumber(lossPercent)}%)</span>
                    <strong className="block mt-1 text-lg font-mono text-[#D4A373]">−{formatNumber(results.lossKgPerHa, 1)}</strong>
                    <span className="text-[10px] text-[#8C897E]">kg/ha</span>
                    <div className="mt-1 text-xs font-mono">−{formatNumber(results.lossBagsPerHa)} sc/ha</div>
                  </div>
                </div>
              </>
            ) : (
              <div className={`rounded-2xl border border-dashed p-6 text-center text-xs text-[#8C897E] dark:text-[#A6A395] ${subCardClass}`}>
                Preencha população, amostragem, PMG e quebra para visualizar a estimativa.
              </div>
            )}

            <CalculationMemoryPanel isVisible={showCalculation} isDark={isDark}>
              {results && (
                <div className={`rounded-xl border p-3 text-[11px] leading-relaxed space-y-2 font-mono ${subCardClass}`}>
                  <div className="font-bold text-xs text-[#5A5A40] dark:text-[#A3B18A]">Memória de cálculo — soja</div>
                  <div>Legumes/planta = {formatNumber(totalPods)} ÷ {formatNumber(evaluatedPlants)} = {formatNumber(results.podsPerPlant)}</div>
                  <div>Grãos/legume = {formatNumber(totalGrains)} ÷ {formatNumber(totalPods)} = {formatNumber(results.grainsPerPod)}</div>
                  <div>Conversão do PMG = {formatNumber(thousandGrainWeight)} g/1.000 grãos = {formatNumber(thousandGrainWeight / 1000, 3)} kg/1.000 grãos</div>
                  <div>Produtividade bruta = ({formatNumber(populationPerHa)} × {formatNumber(results.podsPerPlant)} × {formatNumber(results.grainsPerPod)} × {formatNumber(thousandGrainWeight / 1000, 3)}) ÷ 1.000 = {formatNumber(results.grossKgPerHa, 1)} kg/ha</div>
                  <div>Sacas/ha = {formatNumber(results.grossKgPerHa, 1)} ÷ 60 = {formatNumber(results.grossBagsPerHa)} sc/ha</div>
                  <div>Quebra = {formatNumber(results.grossKgPerHa, 1)} × {formatNumber(lossPercent)}% = {formatNumber(results.lossKgPerHa, 1)} kg/ha</div>
                  <div>Produtividade final = {formatNumber(results.grossKgPerHa, 1)} − {formatNumber(results.lossKgPerHa, 1)} = {formatNumber(results.finalKgPerHa, 1)} kg/ha ({formatNumber(results.finalBagsPerHa)} sc/ha)</div>
                </div>
              )}
            </CalculationMemoryPanel>
          </div>

          <div id="soybean_yield_area" className={`rounded-3xl border p-5 space-y-4 ${cardClass}`}>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A5A40] dark:text-[#A3B18A]">Produção total por área (opcional)</h3>
              <p className="text-[11px] text-[#8C897E] dark:text-[#A6A395] mt-1">
                Multiplique a produtividade final pela área da lavoura ou pela área solicitada na atividade.
              </p>
            </div>
            <Input3D
              id="soybean_area_ha"
              label="Área considerada"
              unit="hectares (ha)"
              value={areaHa}
              onChange={(value) => setAreaHa(Math.min(1000000, Math.max(0, value)))}
              step={0.5}
              min={0}
              max={1000000}
              placeholder="Ex.: 50"
              isDark={isDark}
              accentColor="#2E6F40"
              hint="Deixe em branco ou zero para não calcular a produção total."
            />
            {results && areaHa > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-2xl border p-3 ${subCardClass}`}>
                  <span className="block text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Produção total em sacas</span>
                  <strong className="block mt-1 text-2xl font-mono text-[#2E6F40] dark:text-[#9CB386]">{formatNumber(results.finalBagsPerHa * areaHa, 1)}</strong>
                  <span className="text-[10px] text-[#8C897E]">sacas de 60 kg</span>
                </div>
                <div className={`rounded-2xl border p-3 ${subCardClass}`}>
                  <span className="block text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Produção total em kg</span>
                  <strong className="block mt-1 text-2xl font-mono text-[#2E6F40] dark:text-[#9CB386]">{formatNumber(results.finalKgPerHa * areaHa, 0)}</strong>
                  <span className="text-[10px] text-[#8C897E]">quilogramas</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
