'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Info, Gauge, FileText } from 'lucide-react';
import { TRACTORS, type TractorSpec } from '@/lib/tratoresData';
import { getTechnicalProfile } from '@/lib/tratoristaFichasTecnicas';

const fmt = (value:number) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);

function SpeedRows({ entries, baseRpm, rpm }: {
  entries: {gear:string;speedKmh:number}[];
  baseRpm:number;
  rpm:number;
}) {
  const max=Math.max(...entries.map(entry=>entry.speedKmh),1);
  return <div className="space-y-2">
    {entries.map(entry=>{
      const speed=entry.speedKmh*rpm/baseRpm;
      return <div key={entry.gear} className="grid grid-cols-[46px_minmax(0,1fr)_88px] items-center gap-2 text-xs">
        <span className="font-semibold text-[#43523D] dark:text-[#DCE6D5]">{entry.gear}</span>
        <div className="h-2 rounded-full bg-[#EAECE5] dark:bg-[#30382D] overflow-hidden">
          <div className="h-full rounded-full bg-[#66865B]" style={{width:(entry.speedKmh/max*100)+'%'}}/>
        </div>
        <span className="text-right tabular-nums">{fmt(speed)} km/h</span>
      </div>;
    })}
  </div>;
}

function ExistingTractorCard({ tractor }: { tractor:TractorSpec }) {
  return <div className="rounded-xl border border-[#E1E5DC] dark:border-[#394334] p-4 space-y-3">
    <div className="flex items-center gap-2"><Info className="size-4 text-[#66865B]"/><b className="text-sm">Ficha técnica detalhada ainda não cadastrada</b></div>
    <p className="text-xs leading-5 text-[#697366] dark:text-[#B6C0B1]">Este modelo já possui dados de transmissão na biblioteca operacional. Os demais campos abaixo são os dados atualmente registrados; não serão completados com especificações presumidas.</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div className="bg-[#F4F6F0] dark:bg-[#242B22] rounded-lg p-3"><div className="text-[10px] text-[#788174]">Potência cadastrada</div><b className="text-sm">{tractor.powerCv} cv</b></div>
      <div className="bg-[#F4F6F0] dark:bg-[#242B22] rounded-lg p-3"><div className="text-[10px] text-[#788174]">Rotação nominal</div><b className="text-sm">{tractor.nominalRpm.toLocaleString('pt-BR')} rpm</b></div>
      <div className="bg-[#F4F6F0] dark:bg-[#242B22] rounded-lg p-3"><div className="text-[10px] text-[#788174]">Tração cadastrada</div><b className="text-sm">{tractor.traction}</b></div>
    </div>
    <a href={tractor.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-[#52764A]"><BookOpen className="size-4"/> Abrir fonte da tabela de velocidades</a>
    {tractor.brand==='John Deere'&&<a href="https://www.deere.com.br/pt/peças-e-serviços/manuais-e-treinamento/manuais/" target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-2 text-xs font-semibold text-[#52764A]"><FileText className="size-4"/> Biblioteca oficial de manuais John Deere</a>}
  </div>;
}

export default function TractorTechnicalLibrary() {
  const [tractorId,setTractorId]=useState('massey-ferguson-275');
  const tractor=TRACTORS.find(item=>item.id===tractorId)??TRACTORS[0];
  const profile=getTechnicalProfile(tractorId);
  const speedTable=profile?.speedTable;
  const [rpm,setRpm]=useState(speedTable?.engineRpm??tractor.nominalRpm);
  const baseRpm=speedTable?.engineRpm??tractor.nominalRpm;
  const forward=useMemo(()=>speedTable?.forward??tractor.gears.filter(gear=>!gear.label.startsWith('R')).map(gear=>({gear:gear.label,speedKmh:gear.speedKmh})),[speedTable,tractor]);
  const reverse=useMemo(()=>speedTable?.reverse??tractor.gears.filter(gear=>gear.label.startsWith('R')).map(gear=>({gear:gear.label,speedKmh:gear.speedKmh})),[speedTable,tractor]);

  return <section id="tratorista_fichas" className="space-y-5 border-y border-[#D8DED2] dark:border-[#394334] py-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><FileText className="size-5 text-[#66865B]"/><h3 className="text-xl font-bold text-[#30382E] dark:text-[#EEF1E9]">Fichas técnicas e interpretação de velocidades</h3></div>
        <p className="mt-1 text-xs leading-5 text-[#788074] dark:text-[#AAB2A5]">Consulte as especificações cadastradas por modelo, compare marchas e entenda como ler as tabelas do fabricante.</p>
      </div>
      <label className="min-w-[220px] text-xs font-semibold">Marca e modelo
        <select value={tractorId} onChange={event=>{setTractorId(event.target.value);const next=TRACTORS.find(item=>item.id===event.target.value);setRpm(next?.nominalRpm??2200);}} className="mt-1 w-full rounded-lg border border-[#D9DED4] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm">
          {TRACTORS.map(item=><option key={item.id} value={item.id}>{item.brand} — {item.model}</option>)}
        </select>
      </label>
    </div>

    {profile ? <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#EAF1E5] dark:bg-[#2C3828] px-3 py-1 text-[10px] font-bold text-[#4C7045]">Ficha técnica cadastrada</span>
        <span className="text-xs text-[#788074]">{profile.document}{profile.documentDate?' · '+profile.documentDate:''}</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {profile.sections.map(section=><article key={section.title} className="rounded-xl border border-[#E1E5DC] dark:border-[#394334] p-4">
          <h4 className="font-bold text-sm mb-3">{section.title}</h4>
          <dl className="space-y-2">{section.fields.map(field=><div key={field.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-[#EDF0E9] dark:border-[#30382D] pb-2 text-xs">
            <dt className="text-[#778074] dark:text-[#AAB2A5]">{field.label}</dt><dd className="font-semibold text-right text-[#3D4938] dark:text-[#E0E8DA]">{field.value}</dd>
          </div>)}</dl>
        </article>)}
      </div>
    </div> : <ExistingTractorCard tractor={tractor}/ >}

    <article className="rounded-xl border border-[#DCE3D7] dark:border-[#394334] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h4 className="font-bold text-base">Tabela de velocidades — {tractor.model}</h4><p className="text-xs text-[#788074] mt-1">{speedTable?.transmission??'Velocidades de avanço cadastradas na biblioteca'}{speedTable?' · Pneu traseiro '+speedTable.rearTyre:''}</p></div>
        <div className="flex items-center gap-2 text-xs"><Gauge className="size-4 text-[#66865B]"/><b>Referência: {baseRpm.toLocaleString('pt-BR')} rpm</b></div>
      </div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-xs font-semibold">Rotação do motor para simulação proporcional
          <input type="range" min={Math.max(800,Math.round(baseRpm*.5))} max={Math.round(baseRpm*1.05)} step="50" value={rpm} onChange={event=>setRpm(Number(event.target.value))} className="mt-2 w-full accent-[#66865B]"/>
        </label>
        <div className="rounded-lg bg-[#F1F4ED] dark:bg-[#252D22] px-4 py-2 text-right"><b className="text-lg tabular-nums">{rpm.toLocaleString('pt-BR')}</b><div className="text-[10px] text-[#788074]">rpm simulados</div></div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div><h5 className="text-xs font-bold mb-3">Marchas à frente</h5><SpeedRows entries={forward} baseRpm={baseRpm} rpm={rpm}/></div>
        {reverse.length>0&&<div><h5 className="text-xs font-bold mb-3">Marchas à ré</h5><SpeedRows entries={reverse} baseRpm={baseRpm} rpm={rpm}/></div>}
      </div>
      <div className="rounded-lg bg-[#F5F6F1] dark:bg-[#242B22] p-3 text-xs leading-5 text-[#697366] dark:text-[#B6C0B1]">
        <b>Como interpretar:</b> cada linha representa uma relação de marcha e sua velocidade de referência. Barras maiores indicam maior velocidade, não maior força de tração. A simulação ajusta proporcionalmente a velocidade pela rotação selecionada: velocidade estimada = velocidade da tabela × rpm selecionado ÷ rpm de referência.
      </div>
      <p className="text-[10px] leading-4 text-[#7A8177] dark:text-[#AAB2A5]">A simulação é matemática e não substitui medição de velocidade real. A velocidade efetiva varia com medida e desgaste dos pneus, pressão, patinagem, carga, relação de transmissão e configuração. Não use esta estimativa como autorização operacional ou velocidade segura.</p>
      <div className="flex flex-wrap gap-2">
        <a href={profile?.sourceUrl??tractor.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-[#52764A]"><BookOpen className="size-4"/> Fonte da tabela / documento</a>
        {tractor.brand==='John Deere'&&<a href="https://www.deere.com.br/pt/peças-e-serviços/manuais-e-treinamento/manuais/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-[#52764A]"><FileText className="size-4"/> Manuais oficiais John Deere</a>}
      </div>
    </article>

    <div className="space-y-3">
      <h4 className="font-bold text-sm">Leitura prática de uma tabela ou diagrama de velocidades</h4>
      <ol className="list-decimal pl-5 space-y-2 text-xs leading-5 text-[#626C5E] dark:text-[#B4BDAF]">
        <li><b>Identifique a transmissão:</b> 8x2 significa oito relações à frente e duas à ré; não confunda com 12x4 ou outras opções do mesmo modelo.</li>
        <li><b>Confira a rotação de referência:</b> a tabela só vale para o rpm indicado no documento.</li>
        <li><b>Confira os pneus:</b> a circunferência de rolamento altera a velocidade de deslocamento.</li>
        <li><b>Leia a legenda e os grupos:</b> diagramas podem separar gamas, grupos e posições da alavanca; a posição deve ser confirmada no esquema do modelo exato.</li>
        <li><b>Compare a velocidade com a operação e o implemento:</b> consulte o manual e as recomendações agronômicas específicas. Não existe uma marcha universal para plantio, pulverização ou preparo.</li>
        <li><b>Valide no campo:</b> use medição real e observe rotação, patinagem, carga, qualidade do trabalho e segurança.</li>
      </ol>
    </div>
    {profile&&<p className="text-[10px] leading-5 text-[#7A8177] dark:text-[#AAB2A5]">{profile.disclaimer}</p>}
  </section>;
}
