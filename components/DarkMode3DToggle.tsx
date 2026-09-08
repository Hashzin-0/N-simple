'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTheme } from './ThemeProvider';
import { useWebGLManager } from '@/hooks/useWebGLManager';
import WebGLFallback from './WebGLFallback';
import { Sun, Moon } from 'lucide-react';

export default function DarkMode3DToggle() {
  const { isDark, toggleTheme, mounted } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereGroupRef = useRef<THREE.Group | null>(null);
  const targetRotationY = useRef<number>(0);
  const currentRotationY = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isHovered = useRef<boolean>(false);
  const animFrameId = useRef<number | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);

  const { webglSupported, acquire, release } = useWebGLManager();

  const isDarkActive = mounted ? isDark : false;
  const isDarkRef = useRef<boolean>(isDarkActive);

  useEffect(() => {
    isDarkRef.current = isDarkActive;
    targetRotationY.current = isDarkActive ? Math.PI : 0;
  }, [isDarkActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || contextLost || !webglSupported || rendererFailed) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let clock: THREE.Clock | null = null;

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
      const width = 48;
      const height = 48;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.z = 2.8;

      renderer = acquire(canvas, { powerPreference: 'high-performance' });
      if (!renderer) {
        setTimeout(() => setRendererFailed(true), 0);
        return () => {
          canvas.removeEventListener('webglcontextlost', onContextLost);
          canvas.removeEventListener('webglcontextrestored', onContextRestored);
        };
      }
      renderer.setSize(width, height);
      rendererRef.current = renderer;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
      dirLight.position.set(2, 2, 3);
      scene.add(dirLight);

      const dirLightBack = new THREE.DirectionalLight(0xa5c9eb, 1.2);
      dirLightBack.position.set(-2, -1, -3);
      scene.add(dirLightBack);

      const celestialGroup = new THREE.Group();
      sphereGroupRef.current = celestialGroup;
      scene.add(celestialGroup);

      const sunGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const sunMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.2,
      });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.rotation.x = Math.PI / 2;
      celestialGroup.add(sunMesh);

      const moonGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const moonMat = new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        emissive: 0x475569,
        emissiveIntensity: 0.4,
        roughness: 0.8,
        metalness: 0.1,
      });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.rotation.x = -Math.PI / 2;
      celestialGroup.add(moonMesh);

      const ringGeo = new THREE.TorusGeometry(1.3, 0.05, 8, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isDarkRef.current ? 0x93c5fd : 0xfbbf24,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 3;
      celestialGroup.add(ringMesh);

      currentRotationY.current = isDarkRef.current ? Math.PI : 0;
      celestialGroup.rotation.y = currentRotationY.current;

      clock = new THREE.Clock();
      const animate = () => {
        animFrameId.current = requestAnimationFrame(animate);
        const delta = clock!.getDelta();

        const diff = targetRotationY.current - currentRotationY.current;
        currentRotationY.current += diff * 0.12;
        celestialGroup.rotation.y = currentRotationY.current;

        const targetTiltX = mouseRef.current.y * 0.4;
        const targetTiltZ = -mouseRef.current.x * 0.4;
        celestialGroup.rotation.x += (targetTiltX - celestialGroup.rotation.x) * 0.1;
        celestialGroup.rotation.z += (targetTiltZ - celestialGroup.rotation.z) * 0.1;

        ringMesh.rotation.z += isHovered.current ? delta * 3 : delta * 0.8;
        ringMat.color.setHex(isDarkRef.current ? 0x93c5fd : 0xfbbf24);

        renderer!.render(scene, camera);
      };
      animate();
    } catch {
      // WebGL renderer creation failed
    }

    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (renderer) release(renderer);
    };
  }, [contextLost, webglSupported, rendererFailed, acquire, release]);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouseRef.current = { x, y };
  };

  const handlePointerEnter = () => {
    isHovered.current = true;
  };

  const handlePointerLeave = () => {
    isHovered.current = false;
    mouseRef.current = { x: 0, y: 0 };
  };

  return (
    <button
      id="btn_dark_mode_3d_toggle"
      onClick={toggleTheme}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      suppressHydrationWarning
      className={`relative group flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all duration-300 select-none shadow-sm active:scale-95 ${
        isDarkActive
          ? 'bg-[#1E201B] border-[#3E4334] text-[#F4F3EE] hover:border-[#6B7552] hover:bg-[#252820]'
          : 'bg-white border-[#E5E2D9] text-[#5A5A40] hover:border-[#5A5A40] hover:bg-[#FAF9F5]'
      }`}
      title={isDarkActive ? 'Mudar para Modo Claro (Diurno)' : 'Mudar para Modo Escuro (Noturno Agronômico)'}
      aria-label="Alternar tema claro e escuro"
    >
      <div className="relative w-8 h-8 flex items-center justify-center overflow-visible">
        {!webglSupported || contextLost || rendererFailed ? (
          <WebGLFallback
            variant="icon"
            color={isDarkActive ? '#1e293b' : '#fef3c7'}
            size={32}
          >
            {isDarkActive ? (
              <Moon className="w-4 h-4 text-[#93c5fd]" />
            ) : (
              <Sun className="w-4 h-4 text-[#f59e0b]" />
            )}
          </WebGLFallback>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-8 h-8 rounded-full pointer-events-none filter drop-shadow-md"
            suppressHydrationWarning
          />
        )}
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 text-xs font-bold leading-none">
          {isDarkActive ? (
            <>
              <Moon className="w-3.5 h-3.5 text-[#93c5fd] animate-pulse" />
              <span className="text-[#E0E7FF]">Noite</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-[#f59e0b] animate-spin-slow" />
              <span className="text-[#5A5A40]">Dia</span>
            </>
          )}
        </div>
        <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">
          {isDarkActive ? 'Modo Campo' : 'Natural'}
        </span>
      </div>

      <div
        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${
          isDarkActive
            ? 'bg-[#2E3326] text-[#A3B18A] border-[#414736]'
            : 'bg-[#F0EDE5] text-[#5A5A40] border-[#E5E2D9]'
        }`}
      >
      </div>
    </button>
  );
}
