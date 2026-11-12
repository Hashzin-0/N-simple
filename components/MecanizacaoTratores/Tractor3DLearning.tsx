'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ArrowLeftRight, Camera, CheckCircle2, Gauge, Info, RotateCcw, Tractor } from 'lucide-react';
import { TRACTORS } from '@/lib/tratoresData';
import { TRACTOR_SYMBOLS } from '@/lib/tratoristaSimbolos';
import { TractorSymbolImage } from './TractorSymbolImage';

const EXTERIOR_MODEL = 'https://cdn.3dassets.dev/assets/16840/v1/model.glb';
const EXTERIOR_SOURCE = 'https://3dassets.dev/assets/arable-fields-and-farm-machinery-row-crop-tractor-eefceb01';
const ANCHOR_OVERLAY: Record<string,{left:string;top:string}> = {
  rockshaft:{left:'39%',top:'42%'}, 'rockshaft-up':{left:'39%',top:'42%'},
  'rockshaft-down':{left:'39%',top:'42%'}, 'remote-cylinder':{left:'57%',top:'48%'},
  'diff-lock':{left:'58%',top:'68%'}, 'pto-cw':{left:'24%',top:'48%'},
  'position-lights':{left:'63%',top:'32%'}, 'parking-brake':{left:'54%',top:'68%'}
};

type ViewMode = 'exterior' | 'cab';
type QuizStep = { symbolId: string; control: string; question: string; options: string[]; anchor: string };
const QUIZ: QuizStep[] = [
  { symbolId:'rockshaft', control:'Alavanca do levante', question:'Qual é a função deste comando?', options:['Elevar ou abaixar os braços do sistema hidráulico de três pontos','Acionar o bloqueio do diferencial','Ligar as luzes de posição'], anchor:'rockshaft' },
  { symbolId:'rockshaft-up', control:'Comando de subida', question:'O que acontece ao selecionar esta posição?', options:['O implemento é elevado pelo sistema de levante','O implemento é abaixado','A TDP é desligada'], anchor:'rockshaft-up' },
  { symbolId:'rockshaft-down', control:'Comando de descida', question:'O que esta indicação representa?', options:['Abaixar o implemento pelo sistema de levante','Elevar o implemento','Estender um cilindro remoto'], anchor:'rockshaft-down' },
  { symbolId:'remote-cylinder', control:'Alavanca hidráulica remota', question:'A que sistema este comando está associado?', options:['Válvula de controle remoto e cilindro hidráulico externo','Freio de estacionamento','Luzes de posição'], anchor:'remote-cylinder' },
  { symbolId:'diff-lock', control:'Pedal / comando do diferencial', question:'Para que serve o bloqueio do diferencial?', options:['Reduzir a diferença de rotação entre as rodas motrizes do eixo','Aumentar a rotação da TDP','Alterar a rotação nominal do motor'], anchor:'diff-lock' },
  { symbolId:'pto-cw', control:'Comando / indicação da TDP', question:'O símbolo indica qual informação?', options:['Sentido horário de rotação da TDP, conforme a referência de observação ISO','Sentido anti-horário da roda dianteira','Parada de emergência do motor'], anchor:'pto-cw' },
  { symbolId:'position-lights', control:'Interruptor de iluminação', question:'Qual função está associada a este símbolo?', options:['Luzes de posição','Farol alto exclusivamente','Luz de freio'], anchor:'position-lights' },
  { symbolId:'parking-brake', control:'Freio de estacionamento', question:'Qual é a função deste comando/indicador?', options:['Manter o trator imobilizado quando estacionado','Acionar o freio motor em movimento','Bloquear o levante hidráulico'], anchor:'parking-brake' },
];

function buildCab(scene: THREE.Scene) {
  const root = new THREE.Group();
  const mat = (color:string, roughness=0.72, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  const dark=mat('#252A25'), frame=mat('#657064',0.55,0.45), glass=new THREE.MeshStandardMaterial({color:'#8BA6A0',transparent:true,opacity:0.2,roughness:0.12,metalness:0.1}), seat=mat('#303A2F');
  const addBox=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material); mesh.name=name; mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; root.add(mesh); return mesh;
  };
  addBox('floor',[2.2,.12,2.5],[0,.35,0],dark);
  addBox('roof',[2.15,.12,2.3],[0,2.55,-.1],frame);
  for(const x of [-1,1]) for(const z of [-1,1]) addBox('cab-post',[.09,2.15,.09],[x,1.48,z-.1],frame);
  addBox('windscreen',[1.9,1.45,.025],[0,1.65,-1.02],glass);
  addBox('rear-glass',[1.9,1.45,.025],[0,1.65,1.03],glass);
  addBox('left-window',[.025,1.45,1.9],[-1,1.65,-.05],glass);
  addBox('right-window',[.025,1.45,1.9],[1,1.65,-.05],glass);
  addBox('dashboard',[1.55,.38,.42],[0,1.18,-.78],dark);
  addBox('seat-base',[.62,.16,.62],[0,.68,.55],frame);
  addBox('seat-cushion',[.68,.18,.58],[0,.9,.55],seat);
  addBox('seat-back',[.68,.78,.16],[0,1.28,.82],seat);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.31,.045,10,36),dark); wheel.name='steering-wheel'; wheel.position.set(-.42,1.28,-.42); wheel.rotation.x=0.35; root.add(wheel);
  const steeringColumn=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.55,12),frame); steeringColumn.position.set(-.42,1.02,-.42); steeringColumn.rotation.x=-.5; root.add(steeringColumn);
  const lever=(name:string,x:number,z:number,height:number)=>{
    const group=new THREE.Group(); group.name=name; group.position.set(x,.42,z);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,height,10),frame); shaft.position.y=height/2; group.add(shaft);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.09,16,12),dark); knob.position.y=height; group.add(knob); root.add(group); return group;
  };
  lever('rockshaft',.55,-.2,.48); lever('remote-cylinder',.78,-.05,.4); lever('gear-lever',.22,.22,.38); lever('pto-cw',-.78,.1,.32);
  const pedal=addBox('diff-lock',[.16,.07,.3],[.55,.45,-.48],frame); pedal.rotation.x=-.25;
  const lightSwitch=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.1,16),dark); lightSwitch.name='position-lights'; lightSwitch.rotation.x=Math.PI/2; lightSwitch.position.set(.62,1.35,-.96); root.add(lightSwitch);
  scene.add(root);
  return root;
}

function ThreeViewport({ mode, modelSpeed, onLoadState, activeAnchor }: {
  mode:ViewMode; modelSpeed:number; onLoadState:(state:'loading'|'ready'|'error')=>void; activeAnchor:string;
}) {
  const host=useRef<HTMLDivElement>(null);
  const speedRef=useRef(modelSpeed);
  const modeRef=useRef(mode);
  const anchorRef=useRef(activeAnchor);
  useEffect(()=>{speedRef.current=modelSpeed;},[modelSpeed]);
  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{anchorRef.current=activeAnchor;},[activeAnchor]);

  useEffect(()=>{
    const element=host.current;
    if(!element) return;
    let disposed=false, frame=0, mixer:THREE.AnimationMixer|undefined, action:THREE.AnimationAction|undefined, lastAnchor='';
    const scene=new THREE.Scene(); scene.background=new THREE.Color('#e8ece4');
    scene.fog=new THREE.Fog('#e8ece4',12,30);
    const camera=new THREE.PerspectiveCamera(42,1,.1,100);
    camera.position.set(7,4.5,8);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,1,0); controls.maxPolarAngle=Math.PI*.49; controls.minDistance=2.5; controls.maxDistance=14;
    scene.add(new THREE.HemisphereLight('#ffffff','#78836f',2));
    const sun=new THREE.DirectionalLight('#fff6df',2.4); sun.position.set(5,9,5); sun.castShadow=true; scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#c7d0bf',roughness:1})); ground.rotation.x=-Math.PI/2; ground.position.y=-.04; ground.receiveShadow=true; scene.add(ground);
    const grid=new THREE.GridHelper(20,20,'#9ca995','#b6c0af'); grid.position.y=-.025; scene.add(grid);
    const fallback=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.35,.72,2.3),new THREE.MeshStandardMaterial({color:'#66834d',roughness:.8})); body.position.y=1.05; fallback.add(body);
    const hood=new THREE.Mesh(new THREE.BoxGeometry(1.1,.62,1.1),new THREE.MeshStandardMaterial({color:'#7d995e'})); hood.position.set(0,1.3,-1.25); fallback.add(hood);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.1,1.05),new THREE.MeshStandardMaterial({color:'#64766d',transparent:true,opacity:.55})); cabin.position.set(0,1.9,.1); fallback.add(cabin);
    const wheelPivots:THREE.Group[]=[];
    for(const x of [-.83,.83]) for(const z of [-1.35,1.05]){
      const pivot=new THREE.Group(); pivot.position.set(x,z<0?.55:.72,z); const wheel=new THREE.Mesh(new THREE.CylinderGeometry(z<0?.38:.58,z<0?.38:.58,.24,24),new THREE.MeshStandardMaterial({color:'#242824',roughness:1})); wheel.rotation.z=Math.PI/2; pivot.add(wheel); fallback.add(pivot); wheelPivots.push(pivot);
    }
    let tractorRoot:THREE.Object3D|undefined;
    const cabRoot=buildCab(scene);
    cabRoot.visible=false;
    const loader=new GLTFLoader();
    onLoadState('loading');
    loader.load(EXTERIOR_MODEL,(gltf)=>{
      if(disposed){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}});return;}
      tractorRoot=gltf.scene; tractorRoot.scale.setScalar(.9); tractorRoot.position.set(0,0,0);
      tractorRoot.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      scene.add(tractorRoot);
      if(gltf.animations.length){mixer=new THREE.AnimationMixer(tractorRoot);const wheelClip=gltf.animations.find(clip=>clip.name.toLowerCase().includes('wheel'))??gltf.animations[gltf.animations.length-1];action=mixer.clipAction(wheelClip);action.play();}
      fallback.visible=false; onLoadState('ready');
    },undefined,()=>{if(!disposed){fallback.visible=true;onLoadState('error');}});
    scene.add(fallback);
    const resize=()=>{
      const width=element.clientWidth||640,height=element.clientHeight||420;
      camera.aspect=width/height; camera.updateProjectionMatrix(); renderer.setSize(width,height,false);
    };
    const observer=new ResizeObserver(resize); observer.observe(element); resize();
    const animate=()=>{
      frame=requestAnimationFrame(animate);
      const cabMode=modeRef.current==='cab';
      cabRoot.visible=cabMode; if(tractorRoot) tractorRoot.visible=!cabMode; fallback.visible=!cabMode&&!tractorRoot;
      if(cabMode){
        const anchor=anchorRef.current;
        if(anchor!==lastAnchor){
          if(lastAnchor){const previousName=lastAnchor==='rockshaft-up'||lastAnchor==='rockshaft-down'?'rockshaft':lastAnchor;const previous=cabRoot.getObjectByName(previousName);previous?.traverse(node=>{if(node instanceof THREE.Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial)material.emissive.set('#000000');});}});}
          const targetName=anchor==='rockshaft-up'||anchor==='rockshaft-down'?'rockshaft':anchor;
          const target=cabRoot.getObjectByName(targetName);
          target?.traverse(node=>{if(node instanceof THREE.Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial)material.emissive.set('#75B95E');});}});
          lastAnchor=anchor;
        }
        camera.position.lerp(new THREE.Vector3(0,1.72,3.25),.035);controls.target.lerp(new THREE.Vector3(0,1.25,-.45),.035);controls.minDistance=1.8;controls.maxDistance=5;}
      else {camera.position.lerp(new THREE.Vector3(7,4.5,8),.025);controls.target.lerp(new THREE.Vector3(0,1,0),.025);controls.minDistance=2.5;controls.maxDistance=14;}
      const scale=Math.max(-2.5,Math.min(2.5,speedRef.current/12));
      if(action) action.timeScale=scale;
      else wheelPivots.forEach(w=>{w.rotation.x-=scale*.025;});
      mixer?.update(1/60); controls.update(); renderer.render(scene,camera);
    };
    animate();
    return ()=>{
      disposed=true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.dispose();
      if(mixer) mixer.stopAllAction();
      scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
      if(renderer.domElement.parentElement===element) element.removeChild(renderer.domElement);
    };
  },[onLoadState]);
  return <div ref={host} className="absolute inset-0" aria-label={mode==='cab'?'Cabine didática 3D do trator':'Modelo 3D externo genérico do trator'}/>;
}

export default function Tractor3DLearning() {
  const [mode,setMode]=useState<ViewMode>('exterior');
  const [tractorId,setTractorId]=useState(TRACTORS[0].id);
  const [gearId,setGearId]=useState(TRACTORS[0].gears[0].id);
  const [rpm,setRpm]=useState(TRACTORS[0].nominalRpm);
  const [range,setRange]=useState<'turtle'|'hare'>('turtle');
  const [stepIndex,setStepIndex]=useState(0);
  const [answer,setAnswer]=useState<number|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [correct,setCorrect]=useState(0);
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const tractor=TRACTORS.find(item=>item.id===tractorId)??TRACTORS[0];
  const gear=tractor.gears.find(item=>item.id===gearId)??tractor.gears[0];
  const baseSpeed=gear.speedKmh*rpm/tractor.nominalRpm;
  const demoScale=range==='turtle'?.5:1;
  const direction=gear.label.toUpperCase().startsWith('R')?-1:1;
  const modelSpeed=baseSpeed*demoScale*direction;
  const step=QUIZ[stepIndex%QUIZ.length];
  const symbol=TRACTOR_SYMBOLS.find(item=>item.id===step.symbolId);
  const choices=useMemo(()=>step.options,[step]);
  const onLoadState=useCallback((state:'loading'|'ready'|'error')=>setLoadState(state),[]);

  const changeTractor=(id:string)=>{
    const next=TRACTORS.find(item=>item.id===id)??TRACTORS[0];
    setTractorId(id);setGearId(next.gears[0].id);setRpm(next.nominalRpm);
  };
  const submit=()=>{
    if(answer===null||submitted)return;
    const isRight=answer===0;
    if(isRight)setCorrect(v=>v+1);
    setSubmitted(true);
  };
  const next=()=>{
    setStepIndex(v=>v+1);setAnswer(null);setSubmitted(false);
    if((stepIndex+1)%QUIZ.length===0)setCorrect(0);
  };
  const restart=()=>{setStepIndex(0);setAnswer(null);setSubmitted(false);setCorrect(0);};

  return <section className="space-y-4 border-y border-[#D8DED2] dark:border-[#394334] py-6" id="tratorista_3d">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><Tractor className="size-5 text-[#66865B]"/><h4 className="text-lg font-bold">Simulador 3D e cabine interativa</h4></div><p className="mt-1 max-w-3xl text-xs leading-5 text-[#788074] dark:text-[#AAB2A5]">Exterior genérico CC0 com cabine didática construída no projeto. Não representa a geometria nem a disposição real dos comandos de um modelo comercial específico.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={()=>setMode('exterior')} className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(mode==='exterior'?'bg-[#EAF1E5] border-[#78966D]':'border-[#D9DED4]')}>Exterior 3D</button>
        <button type="button" onClick={()=>setMode('cab')} className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(mode==='cab'?'bg-[#EAF1E5] border-[#78966D]':'border-[#D9DED4]')}>Cabine didática</button>
      </div>
    </div>
    <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.65fr)] gap-4">
      <div className="space-y-3">
        <div className="relative h-[340px] sm:h-[480px] overflow-hidden rounded-xl border border-[#D5DCD0] bg-[#E8ECE4]">
          <ThreeViewport mode={mode} modelSpeed={modelSpeed} onLoadState={onLoadState} activeAnchor={step.anchor}/>
          {mode==='cab'&&symbol&&<div className="pointer-events-none absolute z-10 flex items-center gap-2 transition-all duration-300" style={ANCHOR_OVERLAY[step.anchor]??{left:"43%",top:"34%"}}>
            <div className="h-16 w-16 rounded-xl border-2 border-[#68895D] bg-white/95 p-2 shadow-lg"><TractorSymbolImage symbol={symbol} className="h-full w-full"/></div>
            <svg width="100" height="60" viewBox="0 0 100 60" className="overflow-visible"><path d="M0 30 L95 30" stroke="#54784A" strokeWidth="2.5" fill="none" strokeDasharray="5 3"/><circle cx="95" cy="30" r="4" fill="#54784A"/></svg>
          </div>}
          <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#344132]">
            {mode==='cab'?'REPRESENTAÇÃO DIDÁTICA — NÃO É CABINE OEM':'MODELO EXTERNO GENÉRICO CC0'}
          </div>
          <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-[10px] text-[#344132]">
            {loadState==='loading'?'Carregando modelo 3D…':loadState==='error'?'Modelo externo indisponível — visual alternativo':'Modelo 3D carregado'}
          </div>
          <button type="button" onClick={()=>{setMode(mode==='cab'?'exterior':'cab');}} aria-label="Alternar visualização 3D" className="absolute right-3 top-3 rounded-lg bg-white/90 p-2 text-[#344132]"><Camera className="size-4"/></button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-xs font-semibold">Trator / tabela de referência<select value={tractorId} onChange={e=>changeTractor(e.target.value)} className="mt-1 w-full rounded-lg border border-[#D9DED4] bg-[#FAFAF7] px-2 py-2 text-xs">{TRACTORS.map(t=><option key={t.id} value={t.id}>{t.brand} {t.model}</option>)}</select></label>
          <label className="text-xs font-semibold">Marcha<select value={gearId} onChange={e=>setGearId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#D9DED4] bg-[#FAFAF7] px-2 py-2 text-xs">{tractor.gears.map(g=><option key={g.id} value={g.id}>{g.label} — {g.speedKmh} km/h</option>)}</select></label>
          <label className="text-xs font-semibold">Faixa visual de simulação<select value={range} onChange={e=>setRange(e.target.value as 'turtle'|'hare')} className="mt-1 w-full rounded-lg border border-[#D9DED4] bg-[#FAFAF7] px-2 py-2 text-xs"><option value="turtle">Tartaruga — escala 0,5×</option><option value="hare">Lebre — escala 1×</option></select></label>
        </div>
        <div className="rounded-xl border border-[#DCE3D7] p-3 space-y-2">
          <div className="flex justify-between text-xs"><span className="font-semibold">Rotação do motor (simulação proporcional)</span><b className="tabular-nums">{rpm.toLocaleString('pt-BR')} rpm</b></div>
          <input aria-label="Rotação simulada do motor" type="range" min={Math.round(tractor.nominalRpm*.5)} max={tractor.nominalRpm} step="50" value={rpm} onChange={e=>setRpm(Number(e.target.value))} className="w-full accent-[#66865B]"/>
          <div className="flex items-center justify-between text-xs"><span className="text-[#788074]">Velocidade estimada na tabela</span><b className="text-base tabular-nums">{Math.abs(modelSpeed).toFixed(1).replace('.',',')} km/h</b></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E9EDE5]"><div className="h-full rounded-full bg-[#66865B] transition-all" style={{width:Math.min(100,modelSpeed/35*100)+'%'}}/></div>
          <p className="text-[10px] leading-4 text-[#7A8177]">A escala tartaruga/lebre é um controle visual didático de 0,5×/1×, não uma relação de transmissão atribuída ao trator. O exterior genérico não possui telemetria nem representa uma máquina real específica.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#788074]">
          <span className="inline-flex items-center gap-1"><Gauge className="size-3"/> Animação de roda proporcional à velocidade estimada</span>
          <span>·</span><a href={EXTERIOR_SOURCE} target="_blank" rel="noreferrer" className="font-semibold text-[#52764A]">Origem do modelo CC0 ↗</a>
        </div>
      </div>
      <aside className="rounded-xl border border-[#DCE3D7] dark:border-[#394334] p-4 space-y-4">
        <div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#6B8062]">Aprendizagem ISO 7000</div><h5 className="mt-1 font-bold text-sm">Identifique o comando</h5></div><span className="text-[10px] tabular-nums">{stepIndex+1}/{QUIZ.length}</span></div>
        <div className="h-1.5 rounded-full bg-[#E9EDE5] overflow-hidden"><div className="h-full bg-[#66865B] transition-all" style={{width:((stepIndex%QUIZ.length+1)/QUIZ.length*100)+'%'}}/></div>
        {mode==='cab'&&symbol?<div className="flex items-center gap-3 rounded-lg bg-[#F2F5EF] dark:bg-[#252D22] p-3"><div className="h-16 w-16 shrink-0 rounded-lg bg-white p-2"><TractorSymbolImage symbol={symbol} className="h-full w-full"/></div><div><b className="text-xs">{symbol.iso}</b><p className="text-[10px] text-[#788074]">{step.control}</p><p className="text-[9px] text-[#788074]">Componente didático destacado</p></div></div>:<p className="text-xs text-[#788074]">Ative a cabine didática para visualizar o símbolo conectado ao comando em 3D.</p>}
        <p className="text-sm font-semibold leading-5">{step.question}</p>
        <div className="space-y-2">{choices.map((option,index)=><button key={option} type="button" disabled={submitted} onClick={()=>setAnswer(index)} className={'w-full rounded-lg border p-3 text-left text-xs leading-5 transition '+(answer===index?'border-[#68895D] bg-[#EDF3E9] dark:bg-[#2A3526]':'border-[#E0E5DC] dark:border-[#394334] hover:border-[#9DAF94]')}>{option}</button>)}</div>
        {submitted&&<div role="status" className={'rounded-lg p-3 text-xs leading-5 '+(answer===0?'bg-[#EDF5E9] text-[#426B3B]':'bg-[#FBF2E5] text-[#87602D]')}>{answer===0?'Resposta correta.':'Resposta incorreta.'} {symbol?.meaning}</div>}
        <div className="flex flex-wrap gap-2">
          {!submitted?<button type="button" disabled={answer===null} onClick={submit} className="flex-1 rounded-lg bg-[#557B4C] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Confirmar resposta</button>:<button type="button" onClick={next} className="flex-1 rounded-lg bg-[#557B4C] px-3 py-2.5 text-xs font-bold text-white">Próximo símbolo <ArrowLeftRight className="inline size-3 ml-1"/></button>}
          <button type="button" onClick={restart} aria-label="Reiniciar questionário" className="rounded-lg border border-[#D9DED4] px-3 py-2.5"><RotateCcw className="size-4"/></button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#788074]"><CheckCircle2 className="size-3 text-[#66865B]"/> Acertos nesta sequência: {correct}</div>
        <p className="text-[9px] leading-4 text-[#858C82]">A cabine é uma maquete interativa criada para ensino. A posição física real dos comandos varia conforme fabricante, série, ano, versão e opcionais; consulte sempre o manual específico.</p>
      </aside>
    </div>
    <div className="rounded-lg bg-[#F3F5F0] dark:bg-[#252D22] p-3 text-[10px] leading-5 text-[#697366] dark:text-[#B6C0B1]"><Info className="inline size-3 mr-1"/> Modelo externo: Mid-size row-crop tractor, 3DAssets.dev, CC0 1.0, 6.444 triângulos, animações open/close/wheel-roll. É um projeto genérico de 150 hp, não é um John Deere, Massey Ferguson, Valtra ou New Holland. A cabine é geometria original procedural do N-simple e não é uma reprodução OEM.</div>
  </section>;
}
