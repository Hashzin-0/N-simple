'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Gauge, Info, Tractor, Wrench, Zap } from 'lucide-react';
import { COURSE_MODULES, getTractor, OPERATION_SPEEDS, TRACTORS, type TractorSpec } from '@/lib/tratoresData';

const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const fmt=(n:number,d=1)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(Number.isFinite(n)?n:0);

function calculate(p:{tractor:TractorSpec;load:number;slope:number;rolling:number;mu:number;driveFraction:number;eff:number;target:number}){
  const g=9.80665, mass=p.tractor.massKg+Math.max(0,p.load), weight=mass*g;
  const grade=Math.atan(p.slope/100);
  const requiredForce=weight*(p.rolling*Math.cos(grade)+Math.sin(grade));
  const tractionLimit=weight*p.driveFraction*p.mu;
  const drawbarPower=p.tractor.powerCv*735.49875*p.eff;
  const targetMs=Math.max(p.target/3.6,0.14);
  const availableForce=Math.min(tractionLimit,drawbarPower/targetMs);
  const margin=availableForce>0?(availableForce-requiredForce)/availableForce*100:-100;
  const candidates=p.tractor.gears.filter(g=>!g.label.startsWith('R')).map(g=>{
    const forceAtGear=Math.min(tractionLimit,drawbarPower/Math.max(g.speedKmh/3.6,0.14));
    return {...g,forceAtGear,ok:forceAtGear>=requiredForce*1.08,delta:Math.abs(g.speedKmh-p.target)};
  });
  const valid=candidates.filter(g=>g.ok).sort((a,b)=>a.delta-b.delta);
  const recommended=valid[0]??[...candidates].sort((a,b)=>a.delta-b.delta)[0];
  return {mass,requiredForce,tractionLimit,drawbarPower,availableForce,margin,recommended,candidates};
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl border border-[#E3E2D9] dark:border-[#353C30] p-3">
    <div className="text-[10px] text-[#7A8177]">{label}</div>
    <div className="mt-1 text-sm font-bold text-[#30382E] dark:text-[#EEF1E9] tabular-nums">{value}</div>
  </div>;
}

function GearChart({tractor}:{tractor:TractorSpec}) {
  const forward=tractor.gears.filter(g=>!g.label.startsWith('R')), max=Math.max(...forward.map(g=>g.speedKmh),1);
  return <div className="space-y-2">{forward.map(g=><div key={g.id} className="grid grid-cols-[42px_1fr_54px] items-center gap-2 text-xs">
    <span className="font-semibold text-[#5A5A40] dark:text-[#DDE6D5]">{g.label}</span>
    <div className="h-2 rounded-full bg-[#EEECE5] dark:bg-[#30362B] overflow-hidden"><div className="h-full rounded-full bg-[#5A7D54] dark:bg-[#9CB386]" style={{width:(g.speedKmh/max*100)+'%'}}/></div>
    <span className="text-right tabular-nums text-[#6F756A] dark:text-[#AEB7A8]">{fmt(g.speedKmh)} km/h</span>
  </div>)}</div>;
}

export default function MecanizacaoTratores(){
  const [tractorId,setTractorId]=useState(TRACTORS[0].id),[load,setLoad]=useState(5000),[slope,setSlope]=useState(0);
  const [rolling,setRolling]=useState(0.06),[mu,setMu]=useState(0.55),[driveFraction,setDriveFraction]=useState(0.7);
  const [eff,setEff]=useState(0.78),[operation,setOperation]=useState('preparo'),[target,setTarget]=useState(6),[completed,setCompleted]=useState<string[]>([]);
  const tractor=getTractor(tractorId), calc=useMemo(()=>calculate({tractor,load,slope,rolling,mu,driveFraction,eff,target}),[tractor,load,slope,rolling,mu,driveFraction,eff,target]);
  const preset=OPERATION_SPEEDS[operation], progress=Math.round(completed.length/COURSE_MODULES.length*100);
  const toggle=(id:string)=>setCompleted(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  return <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
    <header id="tratorista_inicio" className="rounded-3xl border border-[#D8D8CD] dark:border-[#394033] bg-gradient-to-br from-[#F7F8F3] to-white dark:from-[#20251D] dark:to-[#1C201A] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#55764F] dark:text-[#A9C49D]"><Tractor className="size-4"/> Mecanização Agrícola</div>
        <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#263024] dark:text-[#F0F2EB]">Curso integrado de operação de tratores</h2>
        <p className="mt-3 text-sm leading-6 text-[#667062] dark:text-[#B1B9AC]">Conteúdo consolidado a partir dos materiais do SENAR, NR-31, SENAR Play e referências técnicas de desempenho. A calculadora usa dados de transmissão documentados e separa estimativa de engenharia de recomendação do fabricante.</p>
      </div><div className="min-w-[170px] rounded-2xl border border-[#D8D8CD] dark:border-[#394033] bg-white/80 dark:bg-[#181C16] p-4"><div className="text-xs text-[#7B8277]">Carga de estudo</div><div className="text-xl font-bold text-[#2E6F40] dark:text-[#9CB386]">30 h</div><div className="mt-2 text-[11px] text-[#7B8277]">8 módulos</div></div></div>
    </header>

    <section id="tratorista_curso" className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h3 className="text-xl font-bold text-[#30382E] dark:text-[#EEF1E9]">Trilha de formação</h3><p className="text-xs text-[#778074] dark:text-[#AAB2A5]">Marque os módulos estudados para acompanhar o progresso.</p></div><span className="text-sm font-semibold text-[#55764F] dark:text-[#A9C49D]">{progress}%</span></div>
      <div className="h-2 rounded-full bg-[#E7E6DE] dark:bg-[#30362B] overflow-hidden"><div className="h-full bg-[#5A7D54] dark:bg-[#9CB386] transition-all" style={{width:progress+'%'}}/></div>
      <div className="grid md:grid-cols-2 gap-3">{COURSE_MODULES.map((m,i)=><article key={m.id} className={'rounded-2xl border p-4 transition-colors '+(completed.includes(m.id)?'border-[#5A7D54]/40 bg-[#F3F7EF] dark:bg-[#263024]':'border-[#E1E0D7] dark:border-[#353C30] bg-white dark:bg-[#1C201A]')}>
        <div className="flex gap-3"><button onClick={()=>toggle(m.id)} aria-label={completed.includes(m.id)?'Marcar módulo como pendente':'Marcar módulo como concluído'} className="shrink-0 mt-0.5">{completed.includes(m.id)?<CheckCircle2 className="size-5 text-[#4E794A]"/>:<div className="size-5 rounded-full border-2 border-[#AEB5A8]"/>}</button>
          <div className="min-w-0"><div className="flex flex-wrap gap-2 items-center"><span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8177]">Módulo {i+1}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF1EA] dark:bg-[#30382C] text-[#65705F] dark:text-[#B3BBAE]">{m.hours} h</span></div>
          <h4 className="mt-1 font-semibold text-sm text-[#2F382E] dark:text-[#EEF1E9]">{m.title}</h4><p className="mt-1 text-[11px] text-[#7A8177] dark:text-[#AAB2A5]">Fonte-base: {m.source}</p><ul className="mt-3 space-y-1.5 text-xs leading-5 text-[#5E665B] dark:text-[#B6BDB2]">{m.lessons.map(x=><li key={x}>• {x}</li>)}</ul></div>
        </div></article>)}</div>
    </section>

    <section id="tratorista_calculadora" className="rounded-3xl border border-[#D8D8CD] dark:border-[#394033] bg-white dark:bg-[#1C201A] overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-[#E5E2D9] dark:border-[#30372D]"><div className="flex items-center gap-2"><Gauge className="size-5 text-[#5A7D54] dark:text-[#A9C49D]"/><div><h3 className="text-xl font-bold text-[#30382E] dark:text-[#EEF1E9]">Calculadora de marcha, tração e velocidade</h3><p className="text-xs text-[#788074] dark:text-[#AAB2A5]">Dimensiona a resistência ao movimento e cruza o resultado com o escalonamento documentado do trator.</p></div></div></div>
      <div className="grid lg:grid-cols-2">
        <div className="p-5 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-[#E5E2D9] dark:border-[#30372D]">
          <label className="block text-xs font-semibold">Trator<select value={tractorId} onChange={e=>setTractorId(e.target.value)} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm">{TRACTORS.map(t=><option key={t.id} value={t.id}>{t.label} · {t.powerCv} cv</option>)}</select></label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Carga rebocada / implemento (kg)<input type="number" min="0" value={load} onChange={e=>setLoad(Number(e.target.value)||0)} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"/></label>
            <label className="text-xs font-semibold">Inclinação do terreno (%)<input type="number" value={slope} onChange={e=>setSlope(Number(e.target.value)||0)} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"/></label>
            <label className="text-xs font-semibold">Operação<select value={operation} onChange={e=>{setOperation(e.target.value);setTarget(OPERATION_SPEEDS[e.target.value].min)}} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm">{Object.entries(OPERATION_SPEEDS).map(([id,o])=><option key={id} value={id}>{o.label}</option>)}</select></label>
            <label className="text-xs font-semibold">Velocidade-alvo (km/h)<input type="number" min="0.5" max="30" step="0.1" value={target} onChange={e=>setTarget(clamp(Number(e.target.value)||0.5,0.5,30))} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"/><span className="block mt-1 text-[10px] font-normal text-[#858C81]">Faixa de referência: {preset.min}–{preset.max} km/h</span></label>
          </div>
          <details className="rounded-xl border border-[#E3E2D9] dark:border-[#343B30] p-3"><summary className="cursor-pointer text-xs font-semibold">Parâmetros avançados</summary><div className="grid sm:grid-cols-2 gap-3 mt-3">
            <label className="text-xs">Resistência ao rolamento<input type="number" min="0" max="0.3" step="0.01" value={rolling} onChange={e=>setRolling(clamp(Number(e.target.value)||0,0,0.3))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/><span className="text-[10px] text-[#858C81]">Ex.: 0,02 firme; 0,06 solo agrícola.</span></label>
            <label className="text-xs">Coeficiente de tração<input type="number" min="0.2" max="0.9" step="0.01" value={mu} onChange={e=>setMu(clamp(Number(e.target.value)||0.2,0.2,0.9))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
            <label className="text-xs">Fração do peso sobre rodados motrizes<input type="number" min="0.3" max="1" step="0.01" value={driveFraction} onChange={e=>setDriveFraction(clamp(Number(e.target.value)||0.3,0.3,1))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
            <label className="text-xs">Eficiência até a barra<input type="number" min="0.3" max="0.95" step="0.01" value={eff} onChange={e=>setEff(clamp(Number(e.target.value)||0.3,0.3,0.95))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
          </div></details>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <div className={'rounded-2xl border p-4 '+(calc.margin>=15?'border-[#5A7D54]/40 bg-[#F3F7EF] dark:bg-[#263024]':calc.margin>=0?'border-[#C9974E]/40 bg-[#FBF5E8] dark:bg-[#302A1F]':'border-red-500/30 bg-red-500/5')}><div className="flex gap-3">{calc.margin>=15?<CheckCircle2 className="size-5 text-[#4E794A]"/>:<AlertTriangle className="size-5 text-[#B47732]"/>}<div><div className="font-bold text-sm">{calc.recommended?'Sugestão: '+calc.recommended.label+' · '+fmt(calc.recommended.speedKmh)+' km/h':'Sem marcha elegível'}</div><p className="mt-1 text-xs leading-5 text-[#697166] dark:text-[#B3BAAE]">Força requerida: <b>{fmt(calc.requiredForce/1000)} kN</b>. Força disponível estimada: <b>{fmt(calc.availableForce/1000)} kN</b>. Margem: <b>{fmt(calc.margin)}%</b>.</p></div></div></div>
          <div className="grid grid-cols-2 gap-2"><Metric label="Massa total" value={fmt(calc.mass,0)+' kg'}/><Metric label="Potência útil à barra" value={fmt(calc.drawbarPower/735.5,1)+' cv'}/><Metric label="Limite de aderência" value={fmt(calc.tractionLimit/1000)+' kN'}/><Metric label="Velocidade alvo" value={fmt(target)+' km/h'}/></div>
          <div className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] p-4"><div className="flex items-center justify-between mb-3"><span className="text-xs font-bold">Marchas candidatas</span><span className="text-[10px] text-[#7B8277]">velocidade teórica</span></div><div className="space-y-2">{calc.candidates.map(g=><div key={g.id} className="grid grid-cols-[36px_1fr_65px] gap-2 items-center text-[11px]"><span className={g.ok?'font-bold text-[#4E794A]':'text-[#7D8479]'}>{g.label}</span><div className="h-1.5 rounded-full bg-[#ECEBE4] dark:bg-[#30362B] overflow-hidden"><div className={g.ok?'h-full rounded-full bg-[#5A7D54]':'h-full rounded-full bg-[#AEB5A8]'} style={{width:Math.min(100,g.forceAtGear/Math.max(calc.requiredForce,1)*100)+'%'}}/></div><span className="text-right tabular-nums">{fmt(g.speedKmh)} km/h</span></div>)}</div></div>
          <div className="rounded-xl bg-[#F5F6F1] dark:bg-[#22281F] p-3 text-[10px] leading-5 text-[#6E766A] dark:text-[#ADB5A8]"><Info className="inline size-3 mr-1"/> Modelo simplificado: não substitui curva de torque, ensaio de barra de tração, manual do fabricante ou avaliação do solo. A carga informada é tratada como massa rebocada; implemento em solo exige resistência específica para dimensionamento mais rigoroso.</div>
        </div>
      </div>
    </section>

    <section id="tratorista_tabelas" className="space-y-4"><div><h3 className="text-xl font-bold text-[#30382E] dark:text-[#EEF1E9]">Biblioteca de marchas e gráficos</h3><p className="text-xs text-[#788074] dark:text-[#AAB2A5]">Gráficos recriados a partir de tabelas e diagramas documentados. Não são uma velocidade universal de trabalho.</p></div><div className="grid xl:grid-cols-3 gap-4">{TRACTORS.map(t=><article key={t.id} className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] bg-white dark:bg-[#1C201A] p-4"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] uppercase tracking-wider text-[#7D857A]">{t.brand}</div><h4 className="font-bold text-sm text-[#30382E] dark:text-[#EEF1E9]">{t.model}</h4></div><span className="text-[10px] rounded-full bg-[#EEF2EA] dark:bg-[#30382C] px-2 py-1">{t.powerCv} cv</span></div><div className="mt-4"><GearChart tractor={t}/></div><p className="mt-4 text-[10px] leading-4 text-[#777E74] dark:text-[#A8B0A4]">{t.notes}</p><a href={t.source} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#4E794A] dark:text-[#A9C49D]"><BookOpen className="size-3.5"/> Fonte técnica</a></article>)}</div></section>

    <section id="tratorista_manutencao" className="rounded-3xl border border-[#D8D8CD] dark:border-[#394033] bg-[#F7F8F3] dark:bg-[#20251D] p-5"><div className="flex gap-3"><Wrench className="size-5 text-[#5A7D54] shrink-0"/><div><h3 className="font-bold text-sm">Segurança da ferramenta</h3><p className="mt-1 text-xs leading-5 text-[#687064] dark:text-[#B1B9AD]">Confirme sempre a relação de marcha, rotação, pneus, massa, lastro, TDP e limites no manual do modelo exato. A NR-31.12 exige capacitação compatível com a função; a etapa prática deve ser supervisionada e documentada quando aplicável.</p></div></div></section>

    <footer id="tratorista_fontes" className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] bg-white dark:bg-[#1C201A] p-4"><div className="flex gap-2 items-start"><Zap className="size-4 text-[#B47732] mt-0.5"/><div className="text-[11px] leading-5 text-[#727A70] dark:text-[#AEB6A9]"><b className="text-[#40483D] dark:text-[#E8ECE5]">Base documental:</b> SENAR-PR, Tratorista: Prática Operacional; SENAR Play, Manutenção de Tratores Agrícolas; NR-31.12; Embrapa, Desempenho de tratores agrícolas em tração; manuais e fichas técnicas dos modelos apresentados. Esta formação é material educacional do N-simple e não emite certificado profissional.</div></div></footer>
  </div>;
}
