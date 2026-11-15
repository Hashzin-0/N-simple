'use client';

import React, { useCallback, useState } from 'react';
import { Bean, Flower2, Leaf, Wheat, Sprout, Candy, BookOpenCheck } from 'lucide-react';
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

export default function ProductivityHub({ onApplyYieldGoal, isConnected, fillRequest, initialCrop = 'corn' }: {
  onApplyYieldGoal: (scHa: number) => void;
  isConnected: boolean;
  fillRequest: React.ComponentProps<typeof CornYieldCalculator>['fillRequest'];
  initialCrop?: ProductivityCrop;
}) {
  const [activeCrop, setActiveCrop] = useState<ProductivityCrop>(initialCrop);
  const [showActivities, setShowActivities] = useState(false);
  const [cropValues, setCropValues] = useState<Record<string, number>>({});
  const onValuesChange = useCallback((values: Record<string, number>) => setCropValues(values), []);

  const selectCrop = (id: ProductivityCrop) => {
    setActiveCrop(id);
    setCropValues({});
    setShowActivities(false);
  };

  return <div className="w-full space-y-5" id="productivity_hub">
    <section className="border-b border-[#E5E2D9] pb-4 dark:border-[#343B30]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8C897E] dark:text-[#A6A395]">Cultura</span>
      </div>
      <div role="tablist" aria-label="Culturas para estimativa de produtividade" className="flex gap-2 overflow-x-auto pb-2">
        {CROPS.map((crop) => { const Icon=crop.icon;const selected=activeCrop===crop.id;return <button key={crop.id} type="button" role="tab" aria-selected={selected} onClick={()=>selectCrop(crop.id)} className={'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition '+(selected?'border-[#557A91] bg-[#557A91]/10 text-[#365A70] ring-1 ring-[#557A91]/30 dark:text-[#B8D3E1]':'border-[#E5E2D9] bg-white text-[#777468] hover:border-[#557A91]/50 dark:border-[#393E32] dark:bg-[#242720] dark:text-[#A6A395]')}><Icon className="h-4 w-4"/>{crop.label}</button>;})}
      </div>
    </section>

    <div className="flex justify-end">
      <button type="button" onClick={()=>setShowActivities(v=>!v)} className="inline-flex items-center gap-2 rounded-xl border border-[#557A91]/30 bg-[#557A91]/10 px-4 py-2.5 text-xs font-bold text-[#365A70] dark:text-[#B8D3E1]"><BookOpenCheck className="h-4 w-4"/>{showActivities?'Voltar à calculadora':'Praticar atividades'}</button>
    </div>

    {showActivities ? <section className="space-y-3">
      {activeCrop==='corn' && <CornProductivityGenerator/>}
      {activeCrop==='soybean' && <SoybeanProductivityGenerator onBack={()=>setShowActivities(false)}/>}
      {OTHER_CROP_IDS.has(activeCrop) && <OtherCropProductivityGenerator key={activeCrop} fixedCrop={activeCrop as 'sorghum'|'wheat'|'rice'|'common-bean'|'sunflower'|'peanut'|'sugarcane'} onBack={()=>setShowActivities(false)}/>}
    </section> : <>
      {activeCrop==='corn' && <CornYieldCalculator isConnected={isConnected} onApplyYieldGoal={onApplyYieldGoal} fillRequest={fillRequest} onValuesChange={onValuesChange}/>}
      {activeCrop==='soybean' && <><SoybeanYieldCalculator onValuesChange={onValuesChange}/><ProductivityCrop3D crop="soybean" values={cropValues}/></>}
      {OTHER_CROP_IDS.has(activeCrop) && <><OtherCropProductivityCalculator selectedCrop={activeCrop as 'sorghum'|'wheat'|'rice'|'common-bean'|'sunflower'|'peanut'|'sugarcane'} onValuesChange={onValuesChange}/><ProductivityCrop3D crop={activeCrop} values={cropValues}/></>}
    </>}
  </div>;
}
