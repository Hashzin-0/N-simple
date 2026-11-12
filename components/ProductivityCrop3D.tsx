'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '@/components/ThemeProvider';
import { useWebGLManager } from '@/hooks/useWebGLManager';
import WebGLFallback from '@/components/WebGLFallback';

export type ProductivityCrop = 'corn' | 'soybean' | 'sorghum' | 'wheat' | 'rice' | 'common-bean' | 'sunflower' | 'peanut' | 'sugarcane';

interface Props { crop: ProductivityCrop; values: Record<string, number>; }

const TITLES: Record<ProductivityCrop, string> = {
  corn: 'Espiga de milho', soybean: 'Vagens de soja', sorghum: 'Panícula de sorgo',
  wheat: 'Espiga de trigo', rice: 'Panícula de arroz', 'common-bean': 'Vagens de feijão',
  sunflower: 'Capítulo de girassol', peanut: 'Vagens de amendoim', sugarcane: 'Colmos de cana-de-açúcar',
};

function dispose(scene: THREE.Scene) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Line)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => { Object.values(mat).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); }); mat.dispose(); });
  });
}

export default function ProductivityCrop3D({ crop, values }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const { isDark } = useTheme();
  const { webglSupported, acquire, release } = useWebGLManager();

  const signature = Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => k + ':' + v).join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !webglSupported) return;
    let renderer: THREE.WebGLRenderer | null = null;
    const scene = new THREE.Scene();
    const background = new THREE.Color(isDark ? 0x181a15 : 0xfaf8f3);
    scene.background = background;
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(4.8, 3.1, 6.5);
    camera.lookAt(0, 0.1, 0);
    try {
      renderer = acquire(canvas, { antialias: true, powerPreference: 'low-power' });
      if (!renderer) return;
      renderer.setClearColor(background, 1);
      renderer.shadowMap.enabled = true;
      scene.add(new THREE.HemisphereLight(0xfff5dc, 0x526044, 2.1));
      const key = new THREE.DirectionalLight(0xfff0ce, 2.8); key.position.set(4, 7, 5); key.castShadow = true; scene.add(key);
      const fill = new THREE.DirectionalLight(0xc4d7ad, 1.1); fill.position.set(-4, 2, -3); scene.add(fill);
      const group = new THREE.Group(); groupRef.current = group; scene.add(group);
      const green = new THREE.MeshStandardMaterial({ color: 0x547b35, roughness: 0.88 });
      const gold = new THREE.MeshStandardMaterial({ color: crop === 'sunflower' ? 0x8a5428 : 0xd6a52f, roughness: 0.48 });
      const stemMat = new THREE.MeshStandardMaterial({ color: crop === 'sugarcane' ? 0x8fae55 : 0x557b38, roughness: 0.9 });
      const addStem = (x: number, z: number, height: number, radius = 0.045) => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, height, 9), stemMat);
        mesh.position.set(x, height / 2 - 0.65, z); mesh.castShadow = true; group.add(mesh);
      };
      const countFrom = (...keys: string[]) => Math.max(1, Math.min(160, Math.round(keys.map(k => values[k] ?? 0).find(v => v > 0) ?? 1)));
      const seedCount = crop === 'corn' ? countFrom('fileiras', 'rows') * Math.max(1, Math.min(60, Math.round(values.graosPorFileira ?? 24))) :
        crop === 'soybean' ? countFrom('totalPods', 'podsPerPlant', 'total_pods') :
        crop === 'sorghum' ? countFrom('grainsPerPanicle', 'paniclesPerPlant') :
        crop === 'wheat' ? countFrom('grainsPerEar', 'earsPerM2') :
        crop === 'rice' ? countFrom('spikeletsPerPanicle', 'paniclesPerM2') :
        crop === 'common-bean' ? countFrom('grainsPerPod', 'podsPerM2') :
        crop === 'sunflower' ? countFrom('achenesPerHead', 'headsPerPlant') :
        crop === 'peanut' ? countFrom('podsPerPlant', 'plantsPerM2') : countFrom('stalksPerMeter');
      const bounded = Math.max(1, Math.min(220, seedCount));
      if (crop === 'corn') {
        const cob = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 2.6, 32), new THREE.MeshStandardMaterial({ color: 0x9c7044, roughness: 0.95 }));
        cob.rotation.z = Math.PI / 2; group.add(cob);
        const kernel = new THREE.SphereGeometry(0.095, 12, 10);
        const inst = new THREE.InstancedMesh(kernel, gold, bounded * 4);
        const dummy = new THREE.Object3D(); let i = 0;
        for (let row = 0; row < Math.min(18, countFrom('fileiras')); row++) for (let n = 0; n < Math.min(60, Math.round(values.graosPorFileira || 0)); n++) {
          const a = row / Math.max(1, countFrom('fileiras')) * Math.PI * 2, y = (n / Math.max(1, values.graosPorFileira || 1) - 0.5) * 2.35;
          dummy.position.set(Math.cos(a) * 0.2, y, Math.sin(a) * 0.2); dummy.scale.set(0.82, 0.95, 0.82); dummy.updateMatrix(); inst.setMatrixAt(i++, dummy.matrix);
        }
        inst.count = i; group.add(inst);
        for (let j = 0; j < 3; j++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.24, 2.2, 8), green); leaf.position.set(-0.55, -0.25, j * 0.12 - 0.12); leaf.rotation.z = -0.9; group.add(leaf); }
      } else if (crop === 'sunflower') {
        const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.7, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0x4d5d2c })); disk.rotation.x = Math.PI / 2; disk.position.y = 0.45; group.add(disk);
        const seedGeo = new THREE.ConeGeometry(0.035, 0.15, 6); const seeds = new THREE.InstancedMesh(seedGeo, gold, bounded);
        const d = new THREE.Object3D(); for(let i=0;i<bounded;i++){const r=0.72*Math.sqrt((i+0.5)/bounded),a=i*2.39996;d.position.set(Math.cos(a)*r,0.47+Math.sin(a)*r,0.02);d.rotation.z=a;d.updateMatrix();seeds.setMatrixAt(i,d.matrix);} group.add(seeds); addStem(0,0,1.25,0.08);
      } else if (crop === 'sugarcane') {
        const stalks = Math.max(2, Math.min(12, countFrom('stalksPerMeter')));
        for(let i=0;i<stalks;i++){const x=(i%4-1.5)*0.28,z=(Math.floor(i/4)-1)*0.28;addStem(x,z,2.7,0.075);for(let y=0;y<5;y++){const ring=new THREE.Mesh(new THREE.TorusGeometry(0.075,0.008,5,12),new THREE.MeshStandardMaterial({color:0xc4a86a}));ring.position.set(x,-0.35+y*0.48,z);group.add(ring);}for(let j=0;j<2;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(0.11,1.3,7),green);leaf.position.set(x+(j?0.3:-0.3),1.5,z);leaf.rotation.z=j?0.8:-0.8;group.add(leaf);}}
      } else {
        const stemCount = crop === 'soybean' || crop === 'common-bean' || crop === 'peanut' ? Math.min(9, Math.max(2, Math.ceil(bounded / 8))) : 1;
        for(let p=0;p<stemCount;p++){
          const x=(p%3-1)*0.28,z=(Math.floor(p/3)-1)*0.24;addStem(x,z,1.8,0.035);
          const podGeo = crop === 'soybean' || crop === 'common-bean' || crop === 'peanut' ? new THREE.CapsuleGeometry(0.075,0.32,4,8) : new THREE.SphereGeometry(0.055,8,7);
          const podCount = crop === 'soybean' || crop === 'common-bean' || crop === 'peanut' ? Math.max(2,Math.min(8,Math.ceil(bounded/stemCount))) : Math.min(60,bounded);
          const pods = new THREE.InstancedMesh(podGeo, crop === 'wheat' || crop === 'rice' || crop === 'sorghum' ? gold : green, podCount);
          const d=new THREE.Object3D();for(let i=0;i<podCount;i++){const a=i*2.4;d.position.set(x+Math.cos(a)*0.25,0.05+(i%5)*0.29,z+Math.sin(a)*0.2);d.rotation.z=Math.cos(a)*0.8;d.scale.set(0.8,1,0.8);d.updateMatrix();pods.setMatrixAt(i,d.matrix);}group.add(pods);
        }
      }
      const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshStandardMaterial({ color: isDark ? 0x252a20 : 0xe9e6dc, roughness: 1 }));
      floor.rotation.x = -Math.PI/2; floor.position.y = -0.7; floor.receiveShadow = true; group.add(floor);
      const resize = () => { const w=canvas.parentElement?.clientWidth ?? 320,h=canvas.clientHeight||260;camera.aspect=w/h;camera.updateProjectionMatrix();renderer?.setSize(w,h,false); };
      resize(); const observer=new ResizeObserver(resize);if(canvas.parentElement)observer.observe(canvas.parentElement);
      let raf=0;const animate=()=>{raf=requestAnimationFrame(animate);if(groupRef.current)groupRef.current.rotation.y+=0.002;renderer?.render(scene,camera);};animate();
      return ()=>{cancelAnimationFrame(raf);observer.disconnect();groupRef.current=null;dispose(scene);if(renderer)release(renderer);};
    } catch { if(renderer)release(renderer); return; }
  }, [crop, signature, isDark, webglSupported, acquire, release]);

  return <section className="rounded-2xl border border-[#E5E2D9] bg-[#FAF8F3] p-3 dark:border-[#343B30] dark:bg-[#181A15]">
    <div className="mb-2 flex items-center justify-between"><strong className="text-xs uppercase tracking-wider text-[#5A5A40] dark:text-[#C7CEBC]">{TITLES[crop]} · modelo didático 3D</strong><span className="text-[10px] text-[#8C897E]">Atualiza com a amostragem</span></div>
    <canvas ref={canvasRef} className="h-[260px] w-full rounded-xl" aria-label={TITLES[crop] + ' em visualização 3D'} />
    {!webglSupported && <WebGLFallback variant="full" color="#557A91" label="Visualização 3D indisponível"/>}
  </section>;
}
