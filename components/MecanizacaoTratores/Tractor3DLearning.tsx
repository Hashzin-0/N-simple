'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'motion/react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ArrowLeftRight, Camera, CheckCircle2, Gauge, Info, RotateCcw, Tractor } from 'lucide-react';
import { TRACTORS } from '@/lib/tratoresData';
import { TRACTOR_SYMBOLS } from '@/lib/tratoristaSimbolos';
import { TractorSymbolImage } from './TractorSymbolImage';

const EXTERIOR_MODEL = 'https://cdn.3dassets.dev/assets/16840/v1/model.glb';
const EXTERIOR_SOURCE = 'https://3dassets.dev/assets/arable-fields-and-farm-machinery-row-crop-tractor-eefceb01';


function disposeObject3D(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      Object.values(material).forEach(value => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

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
  // Reconstrução didática do posto de operação John Deere 5078E Série 5E cabinado.
  // Não é CAD OEM: dimensões e posições são aproximadas para visualização e ensino.
  const root=new THREE.Group();
  const mat=(color:string,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const green=mat('#36733A',.48,.12),dark=mat('#20251F'),panel=mat('#303630'),metal=mat('#737A70',.55,.4);
  const seat=mat('#252B25'),rubber=mat('#171B18',.95),yellow=mat('#E4B82F'),red=mat('#C94B3D'),white=mat('#DCE4D9',.35);
  const glass=new THREE.MeshStandardMaterial({color:'#91B6B7',transparent:true,opacity:.16,roughness:.1,side:THREE.DoubleSide});
  const box=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material,rot?:[number,number,number])=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.name=name;m.position.set(...pos);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  };
  const cyl=(name:string,r:number,h:number,pos:[number,number,number],material:THREE.Material,rot:[number,number,number]=[0,0,0])=>{
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,18),material);m.name=name;m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;root.add(m);return m;
  };
  const lever=(name:string,x:number,z:number,h:number,color=dark,baseY=.98)=>{
    const g=new THREE.Group();g.name=name;g.position.set(x,baseY,z);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.022,.032,h,10),metal);shaft.position.y=h/2;g.add(shaft);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.075,16,12),color);knob.position.y=h;g.add(knob);
    const boot=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.1,12),rubber);boot.position.y=.07;g.add(boot);root.add(g);return g;
  };
  const sw=(name:string,x:number,y:number,z:number,color=dark)=>{
    const g=new THREE.Group();g.name=name;g.position.set(x,y,z);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.07,.075,.07,16),panel);base.rotation.x=Math.PI/2;g.add(base);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,.045,16),color);cap.rotation.x=Math.PI/2;cap.position.z=-.05;g.add(cap);root.add(g);
  };

  // Cabine, piso plano, colunas, vidros e teto.
  box('cab-floor',[2.05,.14,2.55],[0,.34,.02],panel);
  box('cab-roof',[2.12,.16,2.3],[0,2.48,-.02],green);
  box('roof-liner',[1.98,.045,2.16],[0,2.38,-.02],dark);
  for(const x of [-.98,.98])for(const z of [-1.02,1.04])box('cab-pillar',[.085,2.08,.09],[x,1.38,z],green);
  box('front-windscreen',[1.84,1.58,.025],[0,1.55,-1.08],glass);
  box('rear-window',[1.84,1.52,.025],[0,1.54,1.08],glass);
  box('left-window',[.025,1.52,1.98],[-1,1.55,.02],glass);
  box('right-window',[.025,1.52,1.98],[1,1.55,.02],glass);
  box('front-roof-header',[2,.12,.12],[0,2.31,-1.03],green);
  box('rear-roof-header',[2,.12,.12],[0,2.31,1.03],green);

  // Assento, braços, volante e coluna de direção.
  box('seat-suspension',[.48,.25,.48],[0,.57,.58],metal);
  box('seat-base',[.62,.14,.58],[0,.76,.58],dark);
  box('seat-cushion',[.68,.18,.62],[0,.91,.58],seat);
  box('seat-back',[.68,.76,.17],[0,1.3,.85],seat,[-.12,0,0]);
  box('left-armrest',[.12,.09,.42],[-.43,1.12,.61],dark);
  box('right-armrest',[.12,.09,.42],[.43,1.12,.61],dark);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.29,.035,10,40),dark);wheel.name='steering-wheel';wheel.position.set(-.03,1.42,-.55);wheel.rotation.x=.42;root.add(wheel);
  cyl('steering-column',.045,.58,[-.03,1.13,-.55],metal,[.42,0,0]);

  // Painel dianteiro e conjunto de instrumentos.
  box('front-dashboard',[1.35,.35,.38],[0,1.34,-.92],dark,[.12,0,0]);
  box('instrument-cluster',[.68,.29,.055],[0,1.58,-.69],panel,[.12,0,0]);
  box('digital-display',[.29,.14,.012],[0,1.59,-.65],white);
  for(const x of [-.24,.24]){
    cyl('instrument-gauge',.085,.025,[x,1.59,-.65],white,[Math.PI/2,0,0]);
    box('gauge-needle',[.012,.065,.012],[x,1.6,-.62],red);
  }
  sw('light-switch',-.55,1.42,-.66);sw('high-beam-switch',-.36,1.42,-.66,yellow);
  sw('hazard-switch',.39,1.42,-.66,red);sw('wiper-switch',.57,1.42,-.66);
  cyl('ignition-switch',.045,.09,[.68,1.32,-.66],yellow,[Math.PI/2,0,0]);

  // Pedais dianteiros: embreagem, freios separados, acelerador e diferencial.
  const pedal=(name:string,x:number,z:number,w=.16)=>{
    box(name+'-arm',[.055,.28,.055],[x,.55,z],metal,[.25,0,0]);
    box(name,[w,.07,.2],[x,.42,z-.08],rubber,[.25,0,0]);
  };
  pedal('clutch-pedal',-.48,-.65,.17);pedal('left-brake-pedal',-.2,-.67,.15);
  pedal('right-brake-pedal',.02,-.67,.15);pedal('accelerator-pedal',.38,-.62,.12);
  pedal('diff-lock',.68,-.48,.13);

  // Console direito: VCRs, acelerador manual, levante, limitador, controle de tração,
  // alavancas de câmbio e grupos.
  box('right-console-base',[.48,.16,1.42],[.78,.83,.04],green,[0,-.06,0]);
  box('right-console-top',[.46,.08,1.34],[.78,.94,.04],panel,[0,-.06,0]);
  box('right-console-side',[.055,.42,1.32],[1.01,.75,.04],dark);
  lever('remote-valve-1',.66,-.42,.42);lever('remote-valve-2',.82,-.18,.44);lever('remote-valve-3',.96,.04,.4);
  lever('manual-throttle',.62,.34,.3,yellow);lever('rockshaft',.84,.34,.42);
  lever('draft-control',.98,.55,.34);lever('gear-lever',.62,.75,.48);lever('range-lever',.86,.78,.4);
  cyl('rockshaft-height-limiter',.065,.13,[.99,1.02,.73],yellow,[Math.PI/2,0,0]);
  cyl('rockshaft-drop-speed-knob',.06,.12,[.66,1.02,.76],dark,[Math.PI/2,0,0]);

  // Console esquerdo: tração dianteira e acionamento da TDP.
  box('left-console-base',[.55,.14,1.1],[-.79,.82,.12],green,[0,.06,0]);
  box('left-console-top',[.53,.07,1.04],[-.79,.92,.12],panel,[0,.06,0]);
  lever('front-wheel-drive',-.72,.05,.36);lever('pto-engagement',-.88,.38,.42,yellow);
  lever('pto-economy',-.68,.62,.32);
  lever('parking-brake',-.56,.42,.3,red);

  // Comandos traseiros: ajuste de velocidade de descida e TDP econômica.
  box('rear-control-panel',[.72,.28,.07],[0,1.12,.99],dark);
  cyl('rear-lowering-speed-valve',.07,.1,[-.22,1.12,.94],yellow,[Math.PI/2,0,0]);
  lever('rear-pto-economy',.24,.88,.26,yellow,1.29);

  // Limpador e retrovisores.
  box('wiper-arm',[.025,.5,.025],[0,1.9,-1.045],dark,[0,0,-.2]);
  for(const x of [-1.12,1.12]){
    box('mirror-arm',[.035,.035,.42],[x,1.72,-.55],metal,[0,0,.15]);
    box('side-mirror',[.16,.28,.07],[x*1.04,1.83,-.34],dark);
  }
  // Pictogramas ISO aplicados fisicamente aos painéis/controles correspondentes.
  // A imagem é apenas o pictograma; o nome permanece reservado ao feedback do exercício.
  const symbolLoader=new THREE.TextureLoader();
  const symbolPlacements=[
    {id:'position-lights',pos:[-.55,1.56,-.62] as [number,number,number],rot:[0,0,0] as [number,number,number]},
    {id:'rockshaft',pos:[.84,.995,.34] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
    {id:'rockshaft-up',pos:[.72,.995,.27] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
    {id:'rockshaft-down',pos:[.92,.995,.27] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
    {id:'remote-cylinder',pos:[.66,.995,-.42] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
    {id:'pto-cw',pos:[-.88,.995,.38] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
    {id:'parking-brake',pos:[-.56,.995,.42] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
    {id:'diff-lock',pos:[.68,.49,-.57] as [number,number,number],rot:[-Math.PI/2,0,0] as [number,number,number]},
  ];
  for(const placement of symbolPlacements){
    const symbol=TRACTOR_SYMBOLS.find(item=>item.id===placement.id);
    if(!symbol)continue;
    const material=new THREE.MeshBasicMaterial({color:'#FFFFFF',side:THREE.DoubleSide,transparent:true});
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(.115,.115),material);
    plate.name='iso-symbol-'+placement.id;plate.position.set(...placement.pos);plate.rotation.set(...placement.rot);root.add(plate);
    symbolLoader.load(symbol.imageUrl,texture=>{if(root.userData.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;},undefined,()=>{});
  }
  scene.add(root);return root;
}
function ThreeViewport({ mode, modelSpeed, onLoadState, activeAnchor, calloutRef }: {
  mode:ViewMode; modelSpeed:number; onLoadState:(state:'loading'|'ready'|'error'|'unsupported')=>void; activeAnchor:string; calloutRef:{current:HTMLDivElement|null};
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
    let disposed=false, frame=0, mixer:THREE.AnimationMixer|undefined, action:THREE.AnimationAction|undefined, lastAnchor='', lastMode:ViewMode|undefined;
    const scene=new THREE.Scene(); scene.background=new THREE.Color('#e8ece4');
    scene.fog=new THREE.Fog('#e8ece4',12,30);
    const camera=new THREE.PerspectiveCamera(42,1,.1,100);
    camera.position.set(7,4.5,8);
    let renderer:THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'}); }
    catch { onLoadState('unsupported'); if(calloutRef.current) calloutRef.current.style.display='none'; return ()=>{disposed=true;}; }
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
      if(disposed){disposeObject3D(gltf.scene);return;}
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
      if(cabMode&&lastMode!=='cab'){
        camera.position.set(0,1.72,3.25);controls.target.set(0,1.25,-.45);controls.update();lastMode='cab';
      } else if(!cabMode&&lastMode!=='exterior'){
        camera.position.set(7,4.5,8);controls.target.set(0,1,0);controls.update();lastMode='exterior';
      }
      if(cabMode){
        const anchor=anchorRef.current;
        if(anchor!==lastAnchor){
          if(lastAnchor){const previousName=lastAnchor==='rockshaft-up'||lastAnchor==='rockshaft-down'?'rockshaft':lastAnchor==='remote-cylinder'?'remote-valve-1':lastAnchor==='pto-cw'?'pto-engagement':lastAnchor==='position-lights'?'light-switch':lastAnchor;const previous=cabRoot.getObjectByName(previousName);previous?.traverse(node=>{if(node instanceof THREE.Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial)material.emissive.set('#000000');});}});}
          const targetName=anchor==='rockshaft-up'||anchor==='rockshaft-down'?'rockshaft':anchor==='remote-cylinder'?'remote-valve-1':anchor==='pto-cw'?'pto-engagement':anchor==='position-lights'?'light-switch':anchor==='parking-brake'?'parking-brake':anchor;
          const target=cabRoot.getObjectByName(targetName);
          target?.traverse(node=>{if(node instanceof THREE.Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial)material.emissive.set('#75B95E');});}});
          lastAnchor=anchor;
        }
        controls.minDistance=1.8;controls.maxDistance=5;}
      else {controls.minDistance=2.5;controls.maxDistance=14;}
      const scale=Math.max(-2.5,Math.min(2.5,speedRef.current/12));
      if(action) action.timeScale=scale;
      else wheelPivots.forEach(w=>{w.rotation.x-=scale*.025;});
      mixer?.update(1/60); controls.update();
      if(cabMode&&calloutRef.current){
        const targetName=anchorRef.current==='rockshaft-up'||anchorRef.current==='rockshaft-down'?'rockshaft':anchorRef.current==='remote-cylinder'?'remote-valve-1':anchorRef.current==='pto-cw'?'pto-engagement':anchorRef.current==='position-lights'?'light-switch':anchorRef.current;
        const target=cabRoot.getObjectByName(targetName);
        if(target){
          const projected=target.getWorldPosition(new THREE.Vector3()).project(camera);
          const visible=projected.z<1&&Math.abs(projected.x)<1.2&&Math.abs(projected.y)<1.2;
          calloutRef.current.style.display=visible?'flex':'none';
          calloutRef.current.style.left=((projected.x*.5+.5)*element.clientWidth)+'px';
          calloutRef.current.style.top=((-projected.y*.5+.5)*element.clientHeight)+'px';
        }
      } else if(calloutRef.current) calloutRef.current.style.display='none';
      renderer.render(scene,camera);
    };
    animate();
    return ()=>{
      disposed=true; cabRoot.userData.disposed=true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.dispose();
      if(mixer) mixer.stopAllAction();
      disposeObject3D(scene);
      if(renderer.domElement.parentElement===element) element.removeChild(renderer.domElement);
    };
  },[onLoadState]);
  return <div ref={host} className="absolute inset-0" aria-label={mode==='cab'?'Cabine didática 3D do trator':'Modelo 3D externo genérico do trator'}/>;
}

export default function Tractor3DLearning() {
  const [mode,setMode]=useState<ViewMode>('cab');
  const [tractorId,setTractorId]=useState('john-deere-5078e');
  const [gearId,setGearId]=useState(TRACTORS.find(item=>item.id==='john-deere-5078e')?.gears[0].id??TRACTORS[0].gears[0].id);
  const [rpm,setRpm]=useState(TRACTORS.find(item=>item.id==='john-deere-5078e')?.nominalRpm??TRACTORS[0].nominalRpm);
  const [range,setRange]=useState<'turtle'|'hare'>('turtle');
  const [stepIndex,setStepIndex]=useState(0);
  const [answer,setAnswer]=useState<number|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [correct,setCorrect]=useState(0);
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'|'unsupported'>('loading');
  const calloutRef=useRef<HTMLDivElement>(null);
  const tractor=TRACTORS.find(item=>item.id===tractorId)??TRACTORS[0];
  const gear=tractor.gears.find(item=>item.id===gearId)??tractor.gears[0];
  const baseSpeed=gear.speedKmh*rpm/tractor.nominalRpm;
  const demoScale=range==='turtle'?.5:1;
  const direction=gear.label.toUpperCase().startsWith('R')?-1:1;
  const modelSpeed=baseSpeed*demoScale*direction;
  const step=QUIZ[stepIndex%QUIZ.length];
  const symbol=TRACTOR_SYMBOLS.find(item=>item.id===step.symbolId);
  const choices=useMemo(()=>step.options,[step]);
  const onLoadState=useCallback((state:'loading'|'ready'|'error'|'unsupported')=>setLoadState(state),[]);

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
      <div><div className="flex items-center gap-2"><Tractor className="size-5 text-[#66865B]"/><h4 className="text-lg font-bold">Simulador 3D e cabine interativa</h4></div><p className="mt-1 max-w-3xl text-xs leading-5 text-[#788074] dark:text-[#AAB2A5]">Cabine didática John Deere 5078E Série 5E, reconstruída a partir da documentação do fabricante. A malha é uma interpretação 3D educacional, não um arquivo CAD OEM.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={()=>setMode('exterior')} className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(mode==='exterior'?'bg-[#EAF1E5] border-[#78966D]':'border-[#D9DED4]')}>Exterior 3D</button>
        <button type="button" onClick={()=>setMode('cab')} className={'rounded-lg border px-3 py-2 text-xs font-semibold '+(mode==='cab'?'bg-[#EAF1E5] border-[#78966D]':'border-[#D9DED4]')}>Cabine didática</button>
      </div>
    </div>
    <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.65fr)] gap-4">
      <div className="space-y-3">
        <div className="relative h-[340px] sm:h-[480px] overflow-hidden rounded-xl border border-[#D5DCD0] bg-[#E8ECE4]">
          <ThreeViewport mode={mode} modelSpeed={modelSpeed} onLoadState={onLoadState} activeAnchor={step.anchor} calloutRef={calloutRef}/>
          {mode==='cab'&&symbol&&<AnimatePresence mode="wait"><motion.div key={step.symbolId} initial={{opacity:0,x:36}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-36}} transition={{duration:.2}} ref={calloutRef} className="pointer-events-none absolute z-10 flex items-center gap-2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-16 w-16 rounded-xl border-2 border-[#68895D] bg-white/95 p-2 shadow-lg"><TractorSymbolImage symbol={symbol} revealMeaning={false} className="h-full w-full"/></div>
            <svg width="100" height="60" viewBox="0 0 100 60" className="overflow-visible"><path d="M0 30 L95 30" stroke="#54784A" strokeWidth="2.5" fill="none" strokeDasharray="5 3"/><circle cx="95" cy="30" r="4" fill="#54784A"/></svg>
          </motion.div></AnimatePresence>}
          <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#344132]">
            {mode==='cab'?'JOHN DEERE 5078E — CABINE DIDÁTICA':'MODELO EXTERNO GENÉRICO CC0'}
          </div>
          <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-[10px] text-[#344132]">
            {loadState==='unsupported'?'WebGL indisponível neste dispositivo':mode==='cab'?'Cabine didática carregada':loadState==='loading'?'Carregando modelo externo…':loadState==='error'?'Modelo externo indisponível — visual alternativo':'Modelo externo carregado'}
          </div>
          <button type="button" onClick={()=>{setMode(mode==='cab'?'exterior':'cab');}} aria-label="Alternar visualização 3D" className="absolute right-3 top-3 rounded-lg bg-white/90 p-2 text-[#344132]"><Camera className="size-4"/></button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-xs font-semibold">Trator / tabela de referência<select value={tractorId} onChange={e=>changeTractor(e.target.value)} className="mt-1 w-full rounded-lg border border-[#D9DED4] bg-[#FAFAF7] px-2 py-2 text-xs">{TRACTORS.filter(t=>t.brand==='John Deere').map(t=><option key={t.id} value={t.id}>{t.brand} {t.model}</option>)}</select></label>
          <label className="text-xs font-semibold">Marcha<select value={gearId} onChange={e=>setGearId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#D9DED4] bg-[#FAFAF7] px-2 py-2 text-xs">{tractor.gears.map(g=><option key={g.id} value={g.id}>{g.label} — {g.speedKmh} km/h</option>)}</select></label>
          <label className="text-xs font-semibold">Faixa visual de simulação<select value={range} onChange={e=>setRange(e.target.value as 'turtle'|'hare')} className="mt-1 w-full rounded-lg border border-[#D9DED4] bg-[#FAFAF7] px-2 py-2 text-xs"><option value="turtle">Tartaruga — escala 0,5×</option><option value="hare">Lebre — escala 1×</option></select></label>
        </div>
        <div className="rounded-xl border border-[#DCE3D7] p-3 space-y-2">
          <div className="flex justify-between text-xs"><span className="font-semibold">Rotação do motor (simulação proporcional)</span><b className="tabular-nums">{rpm.toLocaleString('pt-BR')} rpm</b></div>
          <input aria-label="Rotação simulada do motor" type="range" min={Math.round(tractor.nominalRpm*.5)} max={tractor.nominalRpm} step="50" value={rpm} onChange={e=>setRpm(Number(e.target.value))} className="w-full accent-[#66865B]"/>
          <div className="flex items-center justify-between text-xs"><span className="text-[#788074]">Velocidade estimada na tabela</span><b className="text-base tabular-nums">{Math.abs(modelSpeed).toFixed(1).replace('.',',')} km/h</b></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E9EDE5]"><div className="h-full rounded-full bg-[#66865B] transition-all" style={{width:Math.min(100,Math.abs(modelSpeed)/35*100)+'%'}}/></div>
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
        <AnimatePresence mode="wait">
          <motion.div key={step.symbolId} initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} transition={{duration:.2}} className="space-y-3">
            {mode==='cab'&&symbol?<div className="flex items-center gap-3 rounded-lg bg-[#F2F5EF] dark:bg-[#252D22] p-3"><div className="h-16 w-16 shrink-0 rounded-lg bg-white p-2"><TractorSymbolImage symbol={symbol} revealMeaning={false} className="h-full w-full"/></div><div><b className="text-xs">{symbol.iso}</b><p className="text-[10px] text-[#788074]">Observe o pictograma e identifique sua função.</p></div></div>:<p className="text-xs text-[#788074]">Ative a cabine John Deere para visualizar o símbolo conectado ao comando em 3D.</p>}
            <p className="text-sm font-semibold leading-5">{step.question}</p>
            <div className="space-y-2">{choices.map((option,index)=><button key={option} type="button" disabled={submitted} onClick={()=>setAnswer(index)} className={'w-full rounded-lg border p-3 text-left text-xs leading-5 transition '+(answer===index?'border-[#68895D] bg-[#EDF3E9] dark:bg-[#2A3526]':'border-[#E0E5DC] dark:border-[#394334] hover:border-[#9DAF94]')}>{option}</button>)}</div>
            {submitted&&<div role="status" className={'rounded-lg p-3 text-xs leading-5 '+(answer===0?'bg-[#EDF5E9] text-[#426B3B]':'bg-[#FBF2E5] text-[#87602D]')}><b>{answer===0?'Resposta correta.':'Resposta incorreta.'} {symbol?.title}</b><p className="mt-1">{symbol?.meaning}</p><p className="mt-1 text-[10px]">{symbol?.application}</p></div>}
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-wrap gap-2">
          {!submitted?<button type="button" disabled={answer===null} onClick={submit} className="flex-1 rounded-lg bg-[#557B4C] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Confirmar resposta</button>:<button type="button" onClick={next} className="flex-1 rounded-lg bg-[#557B4C] px-3 py-2.5 text-xs font-bold text-white">Próximo símbolo <ArrowLeftRight className="inline size-3 ml-1"/></button>}
          <button type="button" onClick={restart} aria-label="Reiniciar questionário" className="rounded-lg border border-[#D9DED4] px-3 py-2.5"><RotateCcw className="size-4"/></button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#788074]"><CheckCircle2 className="size-3 text-[#66865B]"/> Acertos nesta sequência: {correct}</div>
        <p className="text-[9px] leading-4 text-[#858C82]">A cabine é uma maquete interativa criada para ensino. A posição física real dos comandos varia conforme fabricante, série, ano, versão e opcionais; consulte sempre o manual específico.</p>
      </aside>
    </div>
    <div className="rounded-lg bg-[#F3F5F0] dark:bg-[#252D22] p-3 text-[10px] leading-5 text-[#697366] dark:text-[#B6C0B1]"><Info className="inline size-3 mr-1"/> Referência da cabine: John Deere 5078E Série 5E cabinado. A disposição dos comandos foi reconstruída a partir da página oficial do modelo e do guia/manual de operação da Série 5E. A geometria é educacional e não substitui o manual do número de série e da configuração efetiva.</div>
  </section>;
}
