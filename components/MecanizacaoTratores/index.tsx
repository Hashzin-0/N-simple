'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Gauge, Info, Tractor, Wrench, Zap } from 'lucide-react';
import { getTractor, TRACTORS, type TractorSpec } from '@/lib/tratoresData';
import { COURSE_MODULES as DETAILED_MODULES, COURSE_TOTAL_HOURS } from '@/lib/tratoristaCurso';

const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const fmt=(n:number,d=1)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(Number.isFinite(n)?n:0);
const OPERATION_TYPES=[{id:'transporte',label:'Transporte'},{id:'preparo',label:'Preparo do solo'},{id:'plantio',label:'Plantio/semeadura'},{id:'cultivo',label:'Cultivo entre linhas'},{id:'pulverizacao',label:'Pulverização'},{id:'distribuicao',label:'Distribuição'},{id:'personalizada',label:'Outra operação'}];

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
  const [tractorId,setTractorId]=useState(TRACTORS[0].id);
  const [load,setLoad]=useState<number | null>(null),[slope,setSlope]=useState<number | null>(null);
  const [rolling,setRolling]=useState<number | null>(null),[mu,setMu]=useState<number | null>(null);
  const [driveFraction,setDriveFraction]=useState<number | null>(null),[eff,setEff]=useState<number | null>(null);
  const [operation,setOperation]=useState(''),[target,setTarget]=useState<number | null>(null);
  const [completed,setCompleted]=useState<string[]>([]);
  const [openModule,setOpenModule]=useState('m1');
  const [activityDone,setActivityDone]=useState<Record<string,string[]>>({});
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [checkedAnswers,setCheckedAnswers]=useState<Record<string,boolean>>({});

  const tractor=getTractor(tractorId);
  const preset=operation?OPERATION_SPEEDS[operation]:null;
  const calc=useMemo(()=>{
    if(load===null||slope===null||rolling===null||mu===null||driveFraction===null||eff===null||target===null) return null;
    return calculate({tractor,load,slope,rolling,mu,driveFraction,eff,target});
  },[tractor,load,slope,rolling,mu,driveFraction,eff,target]);

  const progress=Math.round(completed.length/DETAILED_MODULES.length*100);
  const activitiesTotal=DETAILED_MODULES.reduce((total,module)=>total+module.activities.length,0);
  const activitiesCompleted=Object.values(activityDone).reduce((total,ids)=>total+ids.length,0);
  const toggle=(id:string)=>setCompleted(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleActivity=(moduleId:string,index:number)=>setActivityDone(current=>{
    const key=String(index), existing=current[moduleId]??[];
    return {...current,[moduleId]:existing.includes(key)?existing.filter(x=>x!==key):[...existing,key]};
  });
  const resetCalculator=()=>{
    setLoad(null);setSlope(null);setRolling(null);setMu(null);setDriveFraction(null);setEff(null);setOperation('');setTarget(null);
  };
  const resetCourse=()=>{setCompleted([]);setActivityDone({});setAnswers({});setCheckedAnswers({});};

  return <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
    <header id="tratorista_inicio" className="rounded-3xl border border-[#D8D8CD] dark:border-[#394033] bg-gradient-to-br from-[#F7F8F3] to-white dark:from-[#20251D] dark:to-[#1C201A] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#55764F] dark:text-[#A9C49D]"><Tractor className="size-4"/> Mecanização Agrícola</div>
        <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-[#263024] dark:text-[#F0F2EB]">Curso integrado de operação de tratores</h2>
        <p className="mt-3 text-sm leading-6 text-[#667062] dark:text-[#B1B9AC]">Conteúdo consolidado a partir dos materiais do SENAR, NR-31, SENAR Play e referências técnicas de desempenho. A calculadora usa dados de transmissão documentados e separa estimativa de engenharia de recomendação do fabricante.</p>
      </div><div className="min-w-[170px] rounded-2xl border border-[#D8D8CD] dark:border-[#394033] bg-white/80 dark:bg-[#181C16] p-4"><div className="text-xs text-[#7B8277]">Carga de estudo</div><div className="text-xl font-bold text-[#2E6F40] dark:text-[#9CB386]">{COURSE_TOTAL_HOURS} h</div><div className="mt-2 text-[11px] text-[#7B8277]">{DETAILED_MODULES.length} módulos</div></div></div>
    </header>

    <section id="tratorista_curso" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-xl font-bold text-[#30382E] dark:text-[#EEF1E9]">Aulas, atividades e avaliações</h3><p className="text-xs text-[#778074] dark:text-[#AAB2A5]">Cada módulo reúne teoria, pontos-chave, atividade, prática supervisionada e verificação de aprendizagem.</p></div>
        <button type="button" onClick={resetCourse} className="text-[11px] font-semibold text-[#55764F] dark:text-[#A9C49D]">Reiniciar progresso</button>
      </div>
      <div className="rounded-2xl border border-[#E1E0D7] dark:border-[#353C30] bg-white dark:bg-[#1C201A] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-bold">Atividades realizadas</div><div className="text-[11px] text-[#7A8177]">{activitiesCompleted} de {activitiesTotal}</div></div><div className="w-40 h-2 rounded-full bg-[#E7E6DE] dark:bg-[#30362B] overflow-hidden"><div className="h-full bg-[#7A936B]" style={{width:(activitiesCompleted/Math.max(activitiesTotal,1))*100+'%'}}/></div></div>
      </div>
      <div className="space-y-3">
        {DETAILED_MODULES.map((m,i)=>{
          const isOpen=openModule===m.id, doneActivities=activityDone[m.id]??[], q=m.assessment[0], selected=answers[m.id], checked=checkedAnswers[m.id], correct=selected===q.answer;
          return <article key={m.id} className={'rounded-2xl border overflow-hidden '+(completed.includes(m.id)?'border-[#5A7D54]/40 bg-[#F3F7EF] dark:bg-[#263024]':'border-[#E1E0D7] dark:border-[#353C30] bg-white dark:bg-[#1C201A]')}>
            <div className="p-4 sm:p-5 flex gap-3">
              <button type="button" onClick={()=>toggle(m.id)} aria-label={completed.includes(m.id)?'Marcar módulo como pendente':'Marcar módulo como concluído'} className="shrink-0 mt-0.5">{completed.includes(m.id)?<CheckCircle2 className="size-5 text-[#4E794A]"/>:<div className="size-5 rounded-full border-2 border-[#AEB5A8]"/>}</button>
              <button type="button" onClick={()=>setOpenModule(isOpen?'':m.id)} className="flex-1 text-left min-w-0">
                <div className="flex flex-wrap gap-2 items-center"><span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8177]">Módulo {i+1}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF1EA] dark:bg-[#30382C]">{m.hours} h</span><span className="text-[10px] text-[#7A8177]">{m.source}</span></div>
                <div className="mt-1 flex items-center justify-between gap-3"><h4 className="font-semibold text-sm text-[#2F382E] dark:text-[#EEF1E9]">{m.title}</h4>{isOpen?<ChevronUp className="size-4"/>:<ChevronDown className="size-4" />}</div>
                <p className="mt-1 text-xs leading-5 text-[#687064] dark:text-[#B6BDB2]">{m.objective}</p>
              </button>
            </div>
            {isOpen&&<div className="border-t border-[#E5E3DA] dark:border-[#343B30] p-4 sm:p-5 space-y-5">
              <div className="grid lg:grid-cols-[1.4fr_.9fr] gap-4">
                <section className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] p-4"><div className="flex items-center gap-2"><BookOpen className="size-4 text-[#5A7D54]"/><h5 className="font-bold text-sm">Aula teórica</h5></div><div className="mt-3 space-y-3 text-xs leading-6 text-[#5E665B] dark:text-[#B6BDB2]">{m.theory.map(x=><p key={x}>{x}</p>)}</div></section>
                <section className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] p-4"><h5 className="font-bold text-sm">Pontos que você precisa dominar</h5><ul className="mt-3 space-y-2 text-xs leading-5 text-[#5E665B] dark:text-[#B6BDB2]">{m.keyPoints.map(x=><li key={x}>• {x}</li>)}</ul></section>
              </div>
              <section className="rounded-2xl border border-[#D9E2D3] dark:border-[#394934] bg-[#F7F9F4] dark:bg-[#20281D] p-4"><div className="flex items-center gap-2"><ClipboardCheck className="size-4 text-[#5A7D54]"/><h5 className="font-bold text-sm">Atividades de aprendizagem</h5></div><div className="mt-3 space-y-2">{m.activities.map((x,ai)=>{const done=doneActivities.includes(String(ai));return <button type="button" key={x} onClick={()=>toggleActivity(m.id,ai)} className="w-full flex gap-3 items-start text-left rounded-xl border border-[#DDE3D8] dark:border-[#354132] p-3">{done?<CheckCircle2 className="size-4 mt-0.5 shrink-0 text-[#4E794A]"/>:<div className="size-4 mt-0.5 shrink-0 rounded-full border-2 border-[#AAB5A4]"/>}<span className="text-xs leading-5 text-[#596256] dark:text-[#B9C1B4]">{x}</span></button>})}</div></section>
              <section className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] p-4"><div className="text-[10px] uppercase tracking-wider font-bold text-[#7A8177]">Prática supervisionada</div><p className="mt-2 text-xs leading-5 text-[#596256] dark:text-[#B9C1B4]">{m.practicalTask}</p><div className="mt-3 flex gap-2 text-[10px] leading-4 text-[#777F74]"><AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-[#B47732]"/>A prática deve ocorrer com máquina compatível, em local controlado e sob supervisão adequada.</div></section>
              <section className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] p-4"><div className="text-[10px] uppercase tracking-wider font-bold text-[#7A8177]">Verificação de aprendizagem</div><p className="mt-2 text-sm font-semibold">{q.question}</p><div className="mt-3 grid sm:grid-cols-2 gap-2">{q.options.map((x,oi)=>{const sel=selected===oi, right=checked&&oi===q.answer, wrong=checked&&sel&&!correct;return <button type="button" key={x} onClick={()=>{setAnswers(c=>({...c,[m.id]:oi}));setCheckedAnswers(c=>({...c,[m.id]:false}));}} className={'text-left rounded-xl border p-3 text-xs '+(right?'border-[#5A7D54] bg-[#EDF5E9]':wrong?'border-red-400/60 bg-red-50 dark:bg-red-950/20':sel?'border-[#7A936B] bg-[#F4F7F0] dark:bg-[#273022]':'border-[#E0DFD6] dark:border-[#353C30]')}>{x}</button>})}</div><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={selected===undefined} onClick={()=>setCheckedAnswers(c=>({...c,[m.id]:true}))} className="rounded-xl bg-[#4E794A] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Corrigir resposta</button>{checked&&<span className={'text-xs font-semibold '+(correct?'text-[#4E794A]':'text-[#B47732]')}>{correct?'Correto.':'Revise o conceito.'} {q.explanation}</span>}</div></section>
            </div>}
          </article>;
        })}
      </div>
    </section>

    <section id="tratorista_calculadora" className="rounded-3xl border border-[#D8D8CD] dark:border-[#394033] bg-white dark:bg-[#1C201A] overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-[#E5E2D9] dark:border-[#30372D]"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><Gauge className="size-5 text-[#5A7D54]"/><div><h3 className="text-xl font-bold">Calculadora de marcha, tração e velocidade</h3><p className="text-xs text-[#788074]">Sem cenários fictícios: a ferramenta só calcula depois que os parâmetros reais da operação forem informados.</p></div></div><button type="button" onClick={resetCalculator} className="text-[11px] font-semibold text-[#55764F]">Limpar parâmetros</button></div></div>
      <div className="grid lg:grid-cols-2">
        <div className="p-5 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-[#E5E2D9] dark:border-[#30372D]">
          <label className="block text-xs font-semibold">Trator<select value={tractorId} onChange={e=>setTractorId(e.target.value)} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm">{TRACTORS.map(t=><option key={t.id} value={t.id}>{t.label} · {t.powerCv} cv</option>)}</select></label>
          <div className="rounded-xl border border-[#DDE2D7] dark:border-[#364031] bg-[#F7F9F4] dark:bg-[#20271D] p-3 text-[10px] leading-4 text-[#687064] dark:text-[#B5BDB0]"><b>Dado documental:</b> {tractor.sourceLabel}. {tractor.notes}</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Carga rebocada / implemento (kg)<input type="number" min="0" placeholder="Informe a carga" value={load??''} onChange={e=>setLoad(e.target.value===''?null:Math.max(0,Number(e.target.value)))} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"/></label>
            <label className="text-xs font-semibold">Inclinação do terreno (%)<input type="number" placeholder="Informe a inclinação" value={slope??''} onChange={e=>setSlope(e.target.value===''?null:Number(e.target.value))} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"/></label>
            <label className="text-xs font-semibold">Operação<select value={operation} onChange={e=>{setOperation(e.target.value);setTarget(null)}} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"><option value="">Selecione a operação</option>{OPERATION_TYPES.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            <label className="text-xs font-semibold">Velocidade-alvo (km/h)<input type="number" min="0.5" max="30" step="0.1" placeholder="Informe a velocidade definida para a operação" value={target??''} onChange={e=>setTarget(e.target.value===''?null:clamp(Number(e.target.value),0.5,30))} className="mt-1 w-full rounded-xl border border-[#D9D9CF] dark:border-[#3A4235] bg-[#FAFAF7] dark:bg-[#20251D] px-3 py-2.5 text-sm"/></label>
          </div>
          <details className="rounded-xl border border-[#E3E2D9] dark:border-[#343B30] p-3"><summary className="cursor-pointer text-xs font-semibold">Parâmetros avançados — informe os dados reais</summary><div className="mt-3 space-y-3"><p className="text-[10px] leading-4 text-[#7A8177]">Nenhum destes campos possui valor inicial. Use medição, configuração real ou referência técnica adequada; não use números arbitrários apenas para obter uma marcha.</p><div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs">Resistência ao rolamento<input type="number" min="0" max="0.3" step="0.01" placeholder="Informe o valor" value={rolling??''} onChange={e=>setRolling(e.target.value===''?null:clamp(Number(e.target.value),0,0.3))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
            <label className="text-xs">Coeficiente de tração<input type="number" min="0.2" max="0.9" step="0.01" placeholder="Informe o valor" value={mu??''} onChange={e=>setMu(e.target.value===''?null:clamp(Number(e.target.value),0.2,0.9))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
            <label className="text-xs">Fração do peso sobre rodados motrizes<input type="number" min="0.3" max="1" step="0.01" placeholder="Informe a configuração" value={driveFraction??''} onChange={e=>setDriveFraction(e.target.value===''?null:clamp(Number(e.target.value),0.3,1))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
            <label className="text-xs">Eficiência até a barra<input type="number" min="0.3" max="0.95" step="0.01" placeholder="Informe a eficiência" value={eff??''} onChange={e=>setEff(e.target.value===''?null:clamp(Number(e.target.value),0.3,0.95))} className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2"/></label>
          </div></div></details>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          {!calc?<div className="rounded-2xl border border-dashed border-[#CFCFC4] dark:border-[#444B40] p-5"><div className="flex gap-3"><Info className="size-5 text-[#7B8277] shrink-0"/><div><div className="font-bold text-sm">Aguardando dados reais da operação</div><p className="mt-1 text-xs leading-5 text-[#697166] dark:text-[#B3BAAE]">Selecione a operação e informe todos os parâmetros. Nenhuma carga, inclinação, aderência, eficiência ou velocidade é presumida pelo sistema.</p></div></div></div>:<>
            <div className={'rounded-2xl border p-4 '+(calc.margin>=15?'border-[#5A7D54]/40 bg-[#F3F7EF] dark:bg-[#263024]':calc.margin>=0?'border-[#C9974E]/40 bg-[#FBF5E8] dark:bg-[#302A1F]':'border-red-500/30 bg-red-500/5')}><div className="flex gap-3">{calc.margin>=15?<CheckCircle2 className="size-5 text-[#4E794A]"/>:<AlertTriangle className="size-5 text-[#B47732]"/>}<div><div className="font-bold text-sm">{calc.recommended?'Candidata: '+calc.recommended.label+' · '+fmt(calc.recommended.speedKmh)+' km/h':'Sem marcha elegível'}</div><p className="mt-1 text-xs leading-5 text-[#697166] dark:text-[#B3BAAE]">Força requerida: <b>{fmt(calc.requiredForce/1000)} kN</b>. Força disponível estimada: <b>{fmt(calc.availableForce/1000)} kN</b>. Margem: <b>{fmt(calc.margin)}%</b>.</p></div></div></div>
            <div className="grid grid-cols-2 gap-2"><Metric label="Massa total" value={fmt(calc.mass,0)+' kg'}/><Metric label="Potência útil à barra" value={fmt(calc.drawbarPower/735.5,1)+' cv'}/><Metric label="Limite de aderência" value={fmt(calc.tractionLimit/1000)+' kN'}/><Metric label="Velocidade alvo" value={fmt(target??0)+' km/h'}/></div>
            <div className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] p-4"><div className="flex items-center justify-between mb-3"><span className="text-xs font-bold">Marchas candidatas</span><span className="text-[10px] text-[#7B8277]">velocidade teórica documentada</span></div><div className="space-y-2">{calc.candidates.map(g=><div key={g.id} className="grid grid-cols-[36px_1fr_65px] gap-2 items-center text-[11px]"><span className={g.ok?'font-bold text-[#4E794A]':'text-[#7D8479]'}>{g.label}</span><div className="h-1.5 rounded-full bg-[#ECEBE4] dark:bg-[#30362B] overflow-hidden"><div className={g.ok?'h-full rounded-full bg-[#5A7D54]':'h-full rounded-full bg-[#AEB5A8]'} style={{width:Math.min(100,g.forceAtGear/Math.max(calc.requiredForce,1)*100)+'%'}}/></div><span className="text-right tabular-nums">{fmt(g.speedKmh)} km/h</span></div>)}</div></div>
          </>}
          <div className="rounded-xl bg-[#F5F6F1] dark:bg-[#22281F] p-3 text-[10px] leading-5 text-[#6E766A] dark:text-[#ADB5A8]"><Info className="inline size-3 mr-1"/> Modelo simplificado: não substitui curva de torque, ensaio de barra de tração, manual do fabricante ou avaliação do solo. Para implemento trabalhando no solo, a resistência específica deve ser determinada de forma tecnicamente adequada.</div>
        </div>
      </div>
    </section>

    <section id="tratorista_tabelas" className="space-y-4"><div><h3 className="text-xl font-bold text-[#30382E] dark:text-[#EEF1E9]">Biblioteca de marchas e gráficos</h3><p className="text-xs text-[#788074] dark:text-[#AAB2A5]">Gráficos recriados a partir de tabelas e diagramas documentados. Não são uma velocidade universal de trabalho.</p></div><div className="grid xl:grid-cols-3 gap-4">{TRACTORS.map(t=><article key={t.id} className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] bg-white dark:bg-[#1C201A] p-4"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] uppercase tracking-wider text-[#7D857A]">{t.brand}</div><h4 className="font-bold text-sm text-[#30382E] dark:text-[#EEF1E9]">{t.model}</h4></div><span className="text-[10px] rounded-full bg-[#EEF2EA] dark:bg-[#30382C] px-2 py-1">{t.powerCv} cv</span></div><div className="mt-4"><GearChart tractor={t}/></div><p className="mt-4 text-[10px] leading-4 text-[#777E74] dark:text-[#A8B0A4]">{t.notes}</p><a href={t.source} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#4E794A] dark:text-[#A9C49D]"><BookOpen className="size-3.5"/> Fonte técnica</a></article>)}</div></section>

    <section id="tratorista_manutencao" className="rounded-3xl border border-[#D8D8CD] dark:border-[#394033] bg-[#F7F8F3] dark:bg-[#20251D] p-5"><div className="flex gap-3"><Wrench className="size-5 text-[#5A7D54] shrink-0"/><div><h3 className="font-bold text-sm">Segurança da ferramenta</h3><p className="mt-1 text-xs leading-5 text-[#687064] dark:text-[#B1B9AD]">Confirme sempre a relação de marcha, rotação, pneus, massa, lastro, TDP e limites no manual do modelo exato. A NR-31.12 exige capacitação compatível com a função; a etapa prática deve ser supervisionada e documentada quando aplicável.</p></div></div></section>

    <footer id="tratorista_fontes" className="rounded-2xl border border-[#E2E1D8] dark:border-[#353C30] bg-white dark:bg-[#1C201A] p-4"><div className="flex gap-2 items-start"><Zap className="size-4 text-[#B47732] mt-0.5"/><div className="text-[11px] leading-5 text-[#727A70] dark:text-[#AEB6A9]"><b className="text-[#40483D] dark:text-[#E8ECE5]">Base documental:</b> SENAR-PR, Tratorista: Prática Operacional; SENAR Play, Manutenção de Tratores Agrícolas; NR-31.12; Embrapa, Desempenho de tratores agrícolas em tração; manuais e fichas técnicas dos modelos apresentados. Esta formação é material educacional do N-simple e não emite certificado profissional.</div></div></footer>
  </div>;
}
