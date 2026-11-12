'use client';

import React, { useMemo, useState } from 'react';
import { Calculator, RotateCcw, Sprout, Wheat } from 'lucide-react';
import Input3D from '@/components/Input3D';
import { useTheme } from '@/components/ThemeProvider';
import { calculateOtherCropYield, OTHER_CROP_CALCULATORS, type OtherCropCalculatorId } from '@/lib/otherCropProductivityCalculator';

const cropOrder: OtherCropCalculatorId[] = ['sorghum', 'wheat', 'rice', 'common-bean', 'sunflower', 'peanut', 'sugarcane'];
const formatNumber = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function OtherCropProductivityCalculator() {
  const { isDark } = useTheme();
  const [crop, setCrop] = useState<OtherCropCalculatorId>('sorghum');
  const [values, setValues] = useState<Record<string, number>>({});
  const [lossPercent, setLossPercent] = useState(0);
  const [areaHa, setAreaHa] = useState(0);
  const definition = OTHER_CROP_CALCULATORS[crop];
  const result = useMemo(() => calculateOtherCropYield(crop, values, lossPercent, areaHa), [crop, values, lossPercent, areaHa]);
  const reset = () => { setValues({}); setLossPercent(0); setAreaHa(0); };
  const cardClass = isDark ? 'bg-[#1F221B] border-[#373C2C] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D]';
  const subCardClass = isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#FAF9F5] border-[#E5E2D9]';

  return (
    <section id="other_crop_productivity_calculator" className="w-full space-y-5 rounded-3xl border border-[#E5E2D9] bg-[#FAF9F5] p-4 sm:p-6 dark:border-[#343B30] dark:bg-[#1A1E18]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#557A91]/25 bg-[#557A91]/10 p-3 text-[#557A91] dark:text-[#9DC0D2]"><Calculator className="h-6 w-6" /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C897E] dark:text-[#A6A395]">Calculadoras de produtividade</p>
            <h2 className="text-xl font-bold text-[#454638] dark:text-[#E8E7DF] sm:text-2xl">Outras culturas</h2>
            <p className="mt-1 text-xs text-[#777468] dark:text-[#A6A395]">Selecione uma cultura para abrir sua calculadora operacional.</p>
          </div>
        </div>
        <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E2D9] px-4 py-2 text-xs font-semibold text-[#5A5A40] transition hover:bg-white dark:border-[#393E32] dark:text-[#C7CEBC] dark:hover:bg-[#242720]"><RotateCcw className="h-3.5 w-3.5" /> Limpar dados</button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" role="group" aria-label="Selecionar cultura">
        {cropOrder.map((id) => {
          const selected = crop === id;
          const item = OTHER_CROP_CALCULATORS[id];
          return <button key={id} type="button" aria-pressed={selected} onClick={() => { setCrop(id); reset(); }} className={'rounded-xl border px-3 py-3 text-left text-xs font-bold transition ' + (selected ? 'border-[#557A91] bg-[#557A91]/10 text-[#365A70] ring-1 ring-[#557A91]/30 dark:text-[#B8D3E1]' : 'border-[#E5E2D9] bg-white text-[#777468] hover:border-[#557A91]/50 dark:border-[#393E32] dark:bg-[#242720] dark:text-[#A6A395]')}>{item.shortName}</button>;
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className={'space-y-5 rounded-2xl border p-4 sm:p-5 xl:col-span-7 ' + cardClass}>
          <div className="flex items-center gap-2 border-b border-[#E5E2D9] pb-3 dark:border-[#343B30]">
            <Sprout className="h-4 w-4 text-[#557A91] dark:text-[#9DC0D2]" />
            <div><h3 className="text-sm font-bold">{definition.name}</h3><p className="mt-0.5 text-xs text-[#777468] dark:text-[#A6A395]">{definition.description}</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {definition.fields.map((item) => <Input3D key={item.key} id={'crop_' + crop + '_' + item.key} label={item.label} unit={item.unit} value={values[item.key] ?? 0} onChange={(value) => setValues((previous) => ({ ...previous, [item.key]: Math.min(item.max, Math.max(0, value)) }))} step={item.step} min={0} max={item.max} placeholder="Informe o valor medido" isDark={isDark} accentColor="#557A91" hint={item.hint} />)}
            <Input3D id="other_crop_loss_percent" label="Perdas estimadas" unit="%" value={lossPercent} onChange={(value) => setLossPercent(Math.min(100, Math.max(0, value)))} step={0.1} min={0} max={100} placeholder="Ex.: 5" isDark={isDark} accentColor="#D4A373" hint="Percentual de perdas a descontar da produtividade bruta." />
            <Input3D id="other_crop_area_ha" label="Área do talhão" unit="ha" value={areaHa} onChange={(value) => setAreaHa(Math.min(1000000, Math.max(0, value)))} step={0.1} min={0} max={1000000} placeholder="Opcional" isDark={isDark} accentColor="#557A91" hint="Informe a área para estimar a produção total. É opcional." />
          </div>
          <div className={'rounded-xl border p-3 text-xs leading-relaxed ' + subCardClass}>
            <p className="font-semibold text-[#5A5A40] dark:text-[#A3B18A]">Fórmula utilizada</p>
            <p className="mt-1 font-mono text-[11px] text-[#777468] dark:text-[#C4C9BD]">{definition.formula}</p>
            <p className="mt-2 text-[#777468] dark:text-[#A6A395]">Os valores devem representar médias de amostras distribuídas na lavoura. A estimativa por componentes não substitui a pesagem de parcelas e a aferição da colheita.</p>
          </div>
        </div>

        <div className={'space-y-4 rounded-2xl border p-4 sm:p-5 xl:col-span-5 ' + cardClass}>
          <div className="flex items-center gap-2 border-b border-[#E5E2D9] pb-3 dark:border-[#343B30]"><Wheat className="h-4 w-4 text-[#557A91] dark:text-[#9DC0D2]" /><h3 className="text-xs font-bold uppercase tracking-wider">Resultado da estimativa</h3></div>
          {result ? <>
            <div className="rounded-2xl bg-gradient-to-br from-[#557A91] to-[#365A70] p-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">Produtividade líquida</p>
              <div className="mt-2 flex items-baseline gap-2"><strong className="font-mono text-4xl sm:text-5xl">{formatNumber(result.netYieldPerHa)}</strong><span className="text-sm text-white/85">{result.yieldUnit}</span></div>
              {result.yieldUnit === 'kg/ha' && <p className="mt-1 text-xs text-white/80">{formatNumber(result.netYieldPerHa / 1000)} t/ha</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={'rounded-xl border p-3 ' + subCardClass}><p className="text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Produtividade bruta</p><strong className="mt-1 block font-mono text-lg">{formatNumber(result.grossYieldPerHa)}</strong><span className="text-[10px] text-[#777468] dark:text-[#A6A395]">{result.yieldUnit}</span></div>
              <div className={'rounded-xl border p-3 ' + subCardClass}><p className="text-[10px] uppercase tracking-wide text-[#D4A373]">Perdas</p><strong className="mt-1 block font-mono text-lg">−{formatNumber(result.lossPerHa)}</strong><span className="text-[10px] text-[#777468] dark:text-[#A6A395]">{result.yieldUnit}</span></div>
            </div>
            {result.totalProductionTons !== null && <div className={'rounded-xl border p-3 ' + subCardClass}><p className="text-[10px] uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Produção líquida do talhão</p><strong className="mt-1 block font-mono text-2xl text-[#557A91] dark:text-[#9DC0D2]">{formatNumber(result.totalProductionTons)} t</strong></div>}
            <div className="space-y-2 rounded-xl border border-[#E5E2D9] p-3 text-xs dark:border-[#343B30]"><p className="font-bold text-[#5A5A40] dark:text-[#A3B18A]">Memória de cálculo</p>{result.steps.map((step, index) => <p key={index} className="text-[#777468] dark:text-[#C4C9BD]">{index + 1}. {step}</p>)}</div>
          </> : <div className="rounded-2xl border border-dashed border-[#D7D3C8] p-6 text-center dark:border-[#41483B]"><Calculator className="mx-auto h-8 w-8 text-[#A6A395]" /><p className="mt-3 text-sm font-semibold text-[#5A5A40] dark:text-[#C7CEBC]">Preencha os componentes</p><p className="mt-1 text-xs leading-relaxed text-[#777468] dark:text-[#A6A395]">Informe todos os valores da amostragem para calcular produtividade bruta, perdas e resultado líquido.</p></div>}
          <div className="space-y-2 text-[10px] leading-relaxed text-[#8C897E] dark:text-[#A6A395]"><p>Referências técnicas. Confirme a unidade e a base de umidade da amostra antes de comparar resultados.</p><div className="flex flex-wrap gap-2">{definition.source.map((source, index) => <a key={source} href={source} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#557A91] dark:hover:text-[#9DC0D2]">Referência técnica {index + 1}</a>)}</div></div>
        </div>
      </div>
    </section>
  );
}
