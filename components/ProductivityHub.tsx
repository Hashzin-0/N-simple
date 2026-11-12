'use client';

import React, { useCallback, useState } from 'react';
import { BarChart3, Bean, Flower2, Leaf, Wheat, Sprout, Candy, BookOpenCheck } from 'lucide-react';
import CornYieldCalculator from '@/components/CornYieldCalculator';
import SoybeanYieldCalculator from '@/components/SoybeanYieldCalculator';
import OtherCropProductivityCalculator from '@/components/OtherCropProductivityCalculator';
import CornProductivityGenerator from '@/components/CornProductivityGenerator';
import SoybeanProductivityGenerator from '@/components/SoybeanProductivityGenerator';
import OtherCropProductivityGenerator from '@/components/OtherCropProductivityGenerator';
import ProductivityCrop3D, { type ProductivityCrop } from '@/components/ProductivityCrop3D';

type CropTab = { id: ProductivityCrop; label: string; icon: React.ComponentType<{ className?: string }>; };
const CROPS: CropTab[] = [
  { id: 'corn', label: 'Milho', icon: Wheat },
  { id: 'soybean', label: 'Soja', icon: Sprout },
  { id: 'sorghum', label: 'Sorgo', icon: Wheat },
  { id: 'wheat', label: 'Trigo', icon: Wheat },
  { id: 'rice', label: 'Arroz', icon: Leaf },
  { id: 'common-bean', label: 'Feijão', icon: Bean },
  { id: 'sunflower', label: 'Girassol', icon: Flower2 },
  { id: 'peanut', label: 'Amendoim', icon: Bean },
  { id: 'sugarcane', label: 'Cana-de-açúcar', icon: Candy },
];

const OTHER_CROP_IDS = new Set<ProductivityCrop>(['sorghum','wheat','rice','common-bean','sunflower','peanut','sugarcane']);

export default function ProductivityHub({ onApplyYieldGoal, isConnected, fillRequest }: {
  onApplyYieldGoal: (scHa: number) => void;
  isConnected: boolean;
  fillRequest: React.ComponentProps<typeof CornYieldCalculator>['fillRequest'];
}) {
  const [activeCrop, setActiveCrop] = useState<ProductivityCrop>('corn');
  const [showActivities, setShowActivities] = useState(false);
  const [cropValues, setCropValues] = useState<Record<string, number>>({});
  const onValuesChange = useCallback((values: Record<string, number>) => setCropValues(values), []);
  const active = CROPS.find((crop) => crop.id === activeCrop) ?? CROPS[0];

  const selectCrop = (id: ProductivityCrop) => {
    setActiveCrop(id);
    setCropValues({});
    setShowActivities(false);
  };

  return <div className="w-full space-y-5" id="productivity_hub">
    <section className="rounded-3xl border border-[#E5E2D9] bg-[#FAF9F5] p-4 sm:p-5 dark:border-[#343B30] dark:bg-[#1A1E18]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C897E]">Centro de produtividade agrícola</p><h2 className="text-xl font-bold text-[#454638] dark:text-[#E8E7DF] sm:text-2xl">Estimativa por cultura</h2><p className="mt-1 text-xs text-[#777468] dark:text-[#A6A395]">Selecione a cultura para acessar sua calculadora, visualização 3D e atividades práticas.</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-[#E5E2D9] px-3 py-2 text-xs text-[#777468] dark:border-[#393E32] dark:text-[#C7CEBC]"><BarChart3 className="h-4 w-4"/> 9 culturas disponíveis</div>
      </div>
      <div role="tablist" aria-label="Culturas para estimativa de produtividade" className="flex gap-2 overflow-x-auto pb-2">
        {CROPS.map((crop) => { const Icon=crop.icon;const selected=activeCrop===crop.id;return <button key={crop.id} type="button" role="tab" aria-selected={selected} onClick={()=>selectCrop(crop.id)} className={'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition '+(selected?'border-[#557A91] bg-[#557A91]/10 text-[#365A70] ring-1 ring-[#557A91]/30 dark:text-[#B8D3E1]':'border-[#E5E2D9] bg-white text-[#777468] hover:border-[#557A91]/50 dark:border-[#393E32] dark:bg-[#242720] dark:text-[#A6A395]')}><Icon className="h-4 w-4"/>{crop.label}</button>;})}
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">Produtividade de {active.label}</h3><p className="text-xs text-[#8C897E] dark:text-[#A6A395]">Entradas, cálculo agronômico e representação visual da cultura selecionada.</p></div>
      <button type="button" onClick={()=>setShowActivities(v=>!v)} className="inline-flex items-center gap-2 rounded-xl border border-[#557A91]/30 bg-[#557A91]/10 px-4 py-2.5 text-xs font-bold text-[#365A70] dark:text-[#B8D3E1]"><BookOpenCheck className="h-4 w-4"/>{showActivities?'Voltar à calculadora':'Praticar atividades'}</button>
    </div>

    {showActivities ? <section className="space-y-3">
      <div className="rounded-2xl border border-[#E5E2D9] bg-white p-3 dark:border-[#343B30] dark:bg-[#1F221B]"><p className="text-xs font-semibold text-[#5A5A40] dark:text-[#C7CEBC]">Gerador de atividades · {active.label}</p><p className="mt-1 text-[11px] text-[#8C897E]">Cada cultura mantém seu próprio motor de questões, gabarito, tolerância numérica e resolução passo a passo.</p></div>
      {activeCrop==='corn' && <CornProductivityGenerator/>}
      {activeCrop==='soybean' && <SoybeanProductivityGenerator onBack={()=>setShowActivities(false)}/>}
      {OTHER_CROP_IDS.has(activeCrop) && <OtherCropProductivityGenerator fixedCrop={activeCrop as 'sorghum'|'wheat'|'rice'|'common-bean'|'sunflower'|'peanut'|'sugarcane'} onBack={()=>setShowActivities(false)}/>}
    </section> : <>
      {activeCrop==='corn' && <CornYieldCalculator isConnected={isConnected} onApplyYieldGoal={onApplyYieldGoal} fillRequest={fillRequest} onValuesChange={onValuesChange}/>}
      {activeCrop==='soybean' && <><SoybeanYieldCalculator onValuesChange={onValuesChange}/><ProductivityCrop3D crop="soybean" values={cropValues}/></>}
      {OTHER_CROP_IDS.has(activeCrop) && <><OtherCropProductivityCalculator selectedCrop={activeCrop as 'sorghum'|'wheat'|'rice'|'common-bean'|'sunflower'|'peanut'|'sugarcane'} onValuesChange={onValuesChange}/><ProductivityCrop3D crop={activeCrop} values={cropValues}/></>}
    </>}
  </div>;
}
