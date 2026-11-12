'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTheme } from './ThemeProvider';
import { useWebGLManager } from '@/hooks/useWebGLManager';
import WebGLFallback from './WebGLFallback';

interface CornEar3DVisualizerProps {
  rows: number;
  kernelsPerRow: number;
  totalKernels: number;
  isAlarmActive?: boolean;
}

const COB_LENGTH = 3.8;
const COB_RADIUS = 0.39;

function createKernelGeometry() {
  // Rounded, slightly tapered maize kernel with a soft crown and a narrow attachment base.
  const profile = [
    new THREE.Vector2(0.008, -0.012),
    new THREE.Vector2(0.043, -0.004),
    new THREE.Vector2(0.066, 0.025),
    new THREE.Vector2(0.073, 0.065),
    new THREE.Vector2(0.064, 0.105),
    new THREE.Vector2(0.044, 0.137),
    new THREE.Vector2(0.019, 0.154),
    new THREE.Vector2(0.002, 0.157),
  ];
  const geometry = new THREE.LatheGeometry(profile, 16);
  geometry.computeVertexNormals();
  return geometry;
}

function createHuskLeaf(angle: number, length: number, width: number, color: number) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 28;
  const across = 8;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = -COB_LENGTH * 0.5 - 0.02 + t * length;
    const taper = Math.pow(Math.sin(Math.PI * (0.12 + t * 0.82)), 0.72);
    const leafWidth = width * taper;
    const radial = COB_RADIUS + 0.035 + Math.sin(t * Math.PI) * 0.10;
    const centerX = Math.cos(angle) * radial;
    const centerZ = Math.sin(angle) * radial;

    for (let j = 0; j <= across; j++) {
      const u = (j / across) * 2 - 1;
      const arch = (1 - u * u) * 0.035;
      const side = u * leafWidth;
      const x = centerX + Math.cos(angle) * arch - Math.sin(angle) * side;
      const z = centerZ + Math.sin(angle) * arch + Math.cos(angle) * side;
      positions.push(x, y + Math.sin(t * Math.PI) * 0.12 * Math.abs(u), z);
      uvs.push(j / across, t);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const leaf = new THREE.Mesh(geometry, material);
  leaf.castShadow = true;
  leaf.receiveShadow = true;

  const veinPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = -COB_LENGTH * 0.5 - 0.01 + t * length;
    const radial = COB_RADIUS + 0.035 + Math.sin(t * Math.PI) * 0.10 + 0.038;
    veinPoints.push(new THREE.Vector3(Math.cos(angle) * radial, y + Math.sin(t * Math.PI) * 0.12, Math.sin(angle) * radial));
  }
  const veinCurve = new THREE.CatmullRomCurve3(veinPoints);
  const veinGeometry = new THREE.TubeGeometry(veinCurve, 24, 0.009, 5, false);
  const veinMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa45b, roughness: 0.9 });
  const vein = new THREE.Mesh(veinGeometry, veinMaterial);

  return { leaf, vein, geometry, material, veinGeometry, veinMaterial };
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

export default function CornEar3DVisualizer({
  rows,
  kernelsPerRow,
  totalKernels,
  isAlarmActive = false,
}: CornEar3DVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isDark } = useTheme();
  const earGroupRef = useRef<THREE.Group | null>(null);
  const animFrameId = useRef<number | null>(null);
  const previousMousePos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isAlarmRef = useRef(isAlarmActive);
  const [contextLost, setContextLost] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const { webglSupported, acquire, release } = useWebGLManager();

  useEffect(() => {
    isAlarmRef.current = isAlarmActive;
  }, [isAlarmActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || contextLost || !webglSupported || rendererFailed) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let scene: THREE.Scene | null = null;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
      if (animFrameId.current !== null) cancelAnimationFrame(animFrameId.current);
    };
    const onContextRestored = () => {
      setContextLost(false);
      setRendererFailed(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    try {
      scene = new THREE.Scene();
      const sceneBackground = new THREE.Color(isDark ? 0x181a15 : 0xfaf8f3);
      scene.background = sceneBackground;

      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(5.3, 2.0, 6.5);
      camera.lookAt(0, 0, 0);

      renderer = acquire(canvas, { powerPreference: 'high-performance', antialias: true });
      if (!renderer) {
        setTimeout(() => setRendererFailed(true), 0);
        return () => {
          canvas.removeEventListener('webglcontextlost', onContextLost);
          canvas.removeEventListener('webglcontextrestored', onContextRestored);
        };
      }
      renderer.setClearColor(sceneBackground, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const ambient = new THREE.HemisphereLight(0xfff8df, 0x59613b, 2.0);
      scene.add(ambient);
      const keyLight = new THREE.DirectionalLight(0xfff0c4, 3.1);
      keyLight.position.set(4, 6, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xc7d9a1, 1.15);
      fillLight.position.set(-5, 1, -4);
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xffffff, 1.0);
      rimLight.position.set(0, -2, 5);
      scene.add(rimLight);

      const earGroup = new THREE.Group();
      earGroupRef.current = earGroup;
      scene.add(earGroup);

      // Natural, slightly irregular cob beneath the kernels.
      const cobProfile = [
        new THREE.Vector2(0.02, -2.02),
        new THREE.Vector2(0.20, -1.96),
        new THREE.Vector2(0.31, -1.78),
        new THREE.Vector2(0.36, -1.35),
        new THREE.Vector2(0.385, -0.65),
        new THREE.Vector2(0.39, 0.45),
        new THREE.Vector2(0.36, 1.25),
        new THREE.Vector2(0.29, 1.78),
        new THREE.Vector2(0.15, 1.96),
        new THREE.Vector2(0.015, 2.0),
      ];
      const cobGeometry = new THREE.LatheGeometry(cobProfile, 48);
      const cobMaterial = new THREE.MeshStandardMaterial({
        color: 0xb8793c,
        roughness: 0.96,
        bumpScale: 0.018,
      });
      const cob = new THREE.Mesh(cobGeometry, cobMaterial);
      cob.castShadow = true;
      cob.receiveShadow = true;
      earGroup.add(cob);

      // Kernel geometry is instanced for performance, but each grain has a natural crown,
      // tapered base, slight size variation and its own golden color.
      const safeRows = Math.max(0, Math.floor(Number(rows) || 0));
      const safeKernels = Math.max(0, Math.floor(Number(kernelsPerRow) || 0));
      const instanceCount = safeRows * safeKernels;
      if (instanceCount > 0) {
        const kernelGeometry = createKernelGeometry();
        const kernelMaterial = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.43,
          metalness: 0.0,
        });
        const kernels = new THREE.InstancedMesh(kernelGeometry, kernelMaterial, instanceCount);
        kernels.castShadow = true;
        kernels.receiveShadow = true;
        const dummy = new THREE.Object3D();
        const outward = new THREE.Vector3();
        const baseAxis = new THREE.Vector3(0, 1, 0);
        const color = new THREE.Color();
        let index = 0;

        for (let row = 0; row < safeRows; row++) {
          const rowAngle = (row / safeRows) * Math.PI * 2;
          for (let grain = 0; grain < safeKernels; grain++) {
            const stagger = row % 2 === 0 ? 0 : 0.5;
            const along = safeKernels <= 1 ? 0.5 : (grain + stagger) / safeKernels;
            const yStaggered = (along - 0.5) * COB_LENGTH * 0.91;
            const normalizedY = yStaggered / (COB_LENGTH * 0.5);
            const endTaper = 1 - Math.pow(Math.abs(normalizedY), 2.4) * 0.22;
            const radius = (COB_RADIUS + 0.018) * endTaper;
            const angle = rowAngle + (grain % 2) * 0.012;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            dummy.position.set(x, yStaggered, z);
            outward.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
            dummy.quaternion.setFromUnitVectors(baseAxis, outward);
            const rowPitch = (2 * Math.PI * COB_RADIUS) / Math.max(1, safeRows);
            const aroundScale = THREE.MathUtils.clamp(rowPitch / 0.15, 0.68, 1.22);
            const verticalPitch = safeKernels > 1 ? (COB_LENGTH * 0.91) / (safeKernels - 1) : 0.15;
            const lengthScale = THREE.MathUtils.clamp(verticalPitch / 0.15, 0.62, 1.12);
            dummy.scale.set(aroundScale, lengthScale, 0.94 + ((row * 7 + grain * 3) % 5) * 0.025);
            dummy.updateMatrix();
            kernels.setMatrixAt(index, dummy.matrix);

            const variation = ((row * 13 + grain * 7) % 17) / 17;
            color.setHSL(0.105 + variation * 0.018, 0.78 - variation * 0.12, 0.47 + variation * 0.12);
            kernels.setColorAt(index, color);
            index++;
          }
        }
        kernels.instanceMatrix.needsUpdate = true;
        if (kernels.instanceColor) kernels.instanceColor.needsUpdate = true;
        earGroup.add(kernels);
      }

      // Three overlapping green husk leaves remain around the lower third of the ear.
      const husks = [
        createHuskLeaf(0.15, 2.0, 0.31, 0x587d2b),
        createHuskLeaf(2.25, 1.82, 0.28, 0x6d9135),
        createHuskLeaf(4.35, 1.72, 0.27, 0x486f2a),
      ];
      husks.forEach(({ leaf, vein }) => {
        earGroup.add(leaf);
        earGroup.add(vein);
      });

      // Fine silk threads at the tip, a characteristic detail of a real ear.
      const silkMaterial = new THREE.MeshStandardMaterial({ color: 0x9b7040, roughness: 1 });
      for (let i = 0; i < 11; i++) {
        const angle = (i / 11) * Math.PI * 2;
        const points = [
          new THREE.Vector3(Math.cos(angle) * 0.035, 1.88, Math.sin(angle) * 0.035),
          new THREE.Vector3(Math.cos(angle) * 0.10, 2.04, Math.sin(angle) * 0.10),
          new THREE.Vector3(Math.cos(angle + 0.2) * 0.18, 2.16 + (i % 3) * 0.025, Math.sin(angle + 0.2) * 0.18),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const silk = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.006, 4, false), silkMaterial);
        earGroup.add(silk);
      }

      // Short stem under the husks.
      const stemGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.42, 12);
      const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x55752b, roughness: 0.9 });
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.y = -2.05;
      earGroup.add(stem);

      earGroup.rotation.z = 0.12;
      earGroup.rotation.x = 0.10;

      const resize = () => {
        const width = canvas.parentElement?.clientWidth ?? 320;
        const height = canvas.clientHeight || 220;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer?.setSize(width, height, false);
      };
      resize();
      resizeObserver = new ResizeObserver(resize);
      if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

      const clock = new THREE.Clock();
      const animate = () => {
        animFrameId.current = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        if (!isDragging.current) earGroup.rotation.y += delta * (isAlarmRef.current ? 1.0 : 0.22);
        renderer?.render(scene!, camera);
      };
      animate();

      return () => {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        resizeObserver?.disconnect();
        if (animFrameId.current !== null) cancelAnimationFrame(animFrameId.current);
        earGroupRef.current = null;
        if (scene) disposeScene(scene);
        if (renderer) release(renderer);
      };
    } catch {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver?.disconnect();
      if (animFrameId.current !== null) cancelAnimationFrame(animFrameId.current);
      if (scene) disposeScene(scene);
      if (renderer) release(renderer);
      setRendererFailed(true);
      return;
    }
  }, [rows, kernelsPerRow, isDark, contextLost, webglSupported, rendererFailed, acquire, release]);

  const handlePointerDown = (event: React.PointerEvent) => {
    isDragging.current = true;
    previousMousePos.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isDragging.current || !earGroupRef.current) return;
    const deltaX = event.clientX - previousMousePos.current.x;
    const deltaY = event.clientY - previousMousePos.current.y;
    earGroupRef.current.rotation.y += deltaX * 0.012;
    earGroupRef.current.rotation.x = THREE.MathUtils.clamp(
      earGroupRef.current.rotation.x + deltaY * 0.008,
      -0.8,
      0.8
    );
    previousMousePos.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = () => {
    isDragging.current = false;
  };

  return (
    <div
      className={`relative w-full rounded-2xl border p-3 flex flex-col items-center justify-center select-none overflow-hidden transition-colors ${
        isDark ? 'bg-[#181A15] border-[#2E3326]' : 'bg-[#FAF8F3] border-[#E5E2D9]'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#D4A373]">
        <span className="h-2 w-2 rounded-full bg-[#D4A373] animate-pulse" />
        Espiga de milho 3D
      </div>
      <div className="absolute top-2.5 right-3 z-10 text-[10px] font-mono text-[#8C897E] dark:text-[#9CA38C]">
        Arraste para girar
      </div>
      <canvas
        ref={canvasRef}
        className={`w-full h-[220px] ${
          contextLost || !webglSupported || rendererFailed ? 'hidden' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{ touchAction: 'none' }}
        aria-label={`Modelo 3D de espiga com ${rows} fileiras e ${kernelsPerRow} grãos por fileira`}
      />
      {(contextLost || !webglSupported || rendererFailed) && (
        <WebGLFallback variant="full" color="#D4A373" label="Visualização 3D indisponível">
          <span className="text-4xl" role="img" aria-label="Espiga de milho">🌽</span>
        </WebGLFallback>
      )}
      <div className="w-full grid grid-cols-3 gap-2 text-center text-xs mt-1 pt-2 border-t border-[#E5E2D9] dark:border-[#2F3329]">
        <div>
          <span className="block text-[10px] text-[#8C897E] dark:text-[#9CA38C] uppercase">Fileiras</span>
          <strong className="text-[#5A5A40] dark:text-[#A3B18A] font-mono text-sm">{rows}</strong>
        </div>
        <div>
          <span className="block text-[10px] text-[#8C897E] dark:text-[#9CA38C] uppercase">Grãos/Fileira</span>
          <strong className="text-[#5A5A40] dark:text-[#A3B18A] font-mono text-sm">{kernelsPerRow}</strong>
        </div>
        <div>
          <span className="block text-[10px] text-[#8C897E] dark:text-[#9CA38C] uppercase">Total na Espiga</span>
          <strong className="text-[#D4A373] font-mono text-sm">{totalKernels} grãos</strong>
        </div>
      </div>
    </div>
  );
}
