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

    const width = canvas.parentElement?.clientWidth || 320;
    const height = 240;

    let renderer: THREE.WebGLRenderer | null = null;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };

    const onContextRestored = () => {
      setContextLost(false);
      setRendererFailed(false);
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    try {
      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 0, 8.5);

      renderer = acquire(canvas, { powerPreference: 'high-performance' });
      if (!renderer) {
        setTimeout(() => setRendererFailed(true), 0);
        return () => {
          canvas.removeEventListener('webglcontextlost', onContextLost);
          canvas.removeEventListener('webglcontextrestored', onContextRestored);
        };
      }
      renderer.setSize(width, height);


      const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.9 : 1.1);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xfff3c4, 2.2);
      dirLight1.position.set(5, 8, 6);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x86efac, 0.8);
      dirLight2.position.set(-5, -4, -4);
      scene.add(dirLight2);

      const earGroup = new THREE.Group();
      earGroupRef.current = earGroup;
      scene.add(earGroup);

      const cobLength = 4.8;
      const cobRadius = 0.55;
      const cobGeo = new THREE.CylinderGeometry(cobRadius * 0.7, cobRadius, cobLength, 24);
      const cobMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x991b1b : 0xdc2626,
        roughness: 0.9,
      });
      const cobMesh = new THREE.Mesh(cobGeo, cobMat);
      earGroup.add(cobMesh);

      const clampedRows = Math.max(10, Math.min(24, rows || 16));
      const clampedKernels = Math.max(15, Math.min(50, kernelsPerRow || 35));
      const instanceCount = clampedRows * clampedKernels;

      const kernelGeo = new THREE.SphereGeometry(0.09, 8, 6);
      kernelGeo.scale(1.0, 0.8, 1.4);

      const kernelMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.18,
        roughness: 0.35,
        metalness: 0.1,
      });

      const kernelInstancedMesh = new THREE.InstancedMesh(kernelGeo, kernelMat, instanceCount);
      earGroup.add(kernelInstancedMesh);

      const dummy = new THREE.Object3D();
      let idx = 0;

      for (let k = 0; k < clampedKernels; k++) {
        const yNorm = (k / (clampedKernels - 1)) - 0.5;
        const yPos = yNorm * (cobLength * 0.92);
        const taper = 1.0 - Math.pow(Math.max(0, yNorm), 2) * 0.45;
        const currentRadius = (cobRadius + 0.08) * taper;

        for (let r = 0; r < clampedRows; r++) {
          const angle = (r / clampedRows) * Math.PI * 2 + (k % 2 === 0 ? 0.03 : 0);
          const xPos = Math.cos(angle) * currentRadius;
          const zPos = Math.sin(angle) * currentRadius;

          dummy.position.set(xPos, yPos, zPos);
          dummy.lookAt(xPos * 2, yPos, zPos * 2);
          dummy.updateMatrix();

          kernelInstancedMesh.setMatrixAt(idx++, dummy.matrix);
        }
      }
      kernelInstancedMesh.instanceMatrix.needsUpdate = true;

      const huskGeo = new THREE.ConeGeometry(0.9, 1.8, 12, 1, true);
      const huskMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x3f6212 : 0x65a30d,
        roughness: 0.8,
        side: THREE.DoubleSide,
      });
      const huskMesh = new THREE.Mesh(huskGeo, huskMat);
      huskMesh.position.y = -cobLength / 2 - 0.5;
      huskMesh.rotation.x = Math.PI;
      earGroup.add(huskMesh);

      earGroup.rotation.z = 0.2;
      earGroup.rotation.x = 0.3;

      let clock = new THREE.Clock();
      const animate = () => {
        animFrameId.current = requestAnimationFrame(animate);
        const delta = clock.getDelta();

        if (!isDragging.current) {
          earGroup.rotation.y += delta * 0.7;
        }

        renderer!.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if (!canvas.parentElement) return;
        const w = canvas.parentElement.clientWidth;
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
        renderer!.setSize(w, height);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        window.removeEventListener('resize', handleResize);
        if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
        cobGeo.dispose();
        cobMat.dispose();
        kernelGeo.dispose();
        kernelMat.dispose();
        huskGeo.dispose();
        huskMat.dispose();
        if (renderer) release(renderer);
      };
    } catch {
      return () => {
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      };
    }
  }, [rows, kernelsPerRow, isDark, contextLost, webglSupported, rendererFailed, acquire, release]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    previousMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !earGroupRef.current) return;
    const deltaX = e.clientX - previousMousePos.current.x;
    const deltaY = e.clientY - previousMousePos.current.y;

    earGroupRef.current.rotation.y += deltaX * 0.015;
    earGroupRef.current.rotation.x += deltaY * 0.015;

    previousMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  return (
    <div
      className={`relative w-full rounded-2xl border p-3 flex flex-col items-center justify-center select-none overflow-hidden transition-colors ${
        isDark
          ? 'bg-[#181A15] border-[#2E3326]'
          : 'bg-[#FAF8F3] border-[#E5E2D9]'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#D4A373]">
        <span className="h-2 w-2 rounded-full bg-[#D4A373] animate-ping" />
        Visualização da Espiga
      </div>

      <div className="absolute top-2.5 right-3 text-[10px] font-mono text-[#8C897E] dark:text-[#9CA38C]">
        Arraste para girar
      </div>

      <canvas
        ref={canvasRef}
        className={`w-full h-[220px] ${
          contextLost || !webglSupported || rendererFailed ? 'hidden' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{ touchAction: 'none' }}
      />

      {(contextLost || !webglSupported || rendererFailed) && (
        <WebGLFallback variant="full" color="#D4A373" label="Visualização indisponível">
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
