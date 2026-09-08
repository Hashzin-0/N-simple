'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useWebGLManager } from '@/hooks/useWebGLManager';
import { getDeviceTier, getParticleCount, getGeometryDetail } from '@/lib/webglManager';
import WebGLFallback from './WebGLFallback';

interface LiveVoiceOrb3DProps {
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  userVolume: number;
  agentVolume: number;
  audioFrequencyData?: Uint8Array;
  className?: string;
  size?: number;
}

export default function LiveVoiceOrb3D({
  status,
  userVolume,
  agentVolume,
  className = '',
  size = 180,
}: LiveVoiceOrb3DProps) {
  const [contextLost, setContextLost] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const wireframeMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const ring1Ref = useRef<THREE.Mesh | null>(null);
  const ring2Ref = useRef<THREE.Mesh | null>(null);
  const pointLightRef = useRef<THREE.PointLight | null>(null);

  const targetColorCore = useRef<THREE.Color>(new THREE.Color('#5A5A40'));
  const targetColorGlow = useRef<THREE.Color>(new THREE.Color('#C5A880'));

  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const dynamicStateRef = useRef({ status, userVolume, agentVolume });
  useEffect(() => {
    dynamicStateRef.current = { status, userVolume, agentVolume };
  }, [status, userVolume, agentVolume]);

  const { webglSupported, acquire, release } = useWebGLManager();

  useEffect(() => {
    if (status === 'speaking') {
      targetColorCore.current.set('#2E6F40');
      targetColorGlow.current.set('#68D391');
    } else if (status === 'listening') {
      targetColorCore.current.set('#C5832B');
      targetColorGlow.current.set('#F6E05E');
    } else if (status === 'thinking') {
      targetColorCore.current.set('#319795');
      targetColorGlow.current.set('#81E6D9');
    } else if (status === 'error') {
      targetColorCore.current.set('#E53E3E');
      targetColorGlow.current.set('#FEB2B2');
    } else {
      targetColorCore.current.set('#5A5A40');
      targetColorGlow.current.set('#C5A880');
    }
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !webglSupported || contextLost) return;

    const width = size;
    const height = size;
    const tier = getDeviceTier();

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.8;

    const renderer = acquire(canvas, { powerPreference: 'high-performance' });
    if (!renderer) {
      setTimeout(() => setRendererFailed(true), 0);
      return;
    }

    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };

    const onContextRestored = () => {
      setContextLost(false);
    };

    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xd4a373, 3, 10);
    pointLight.position.set(2, 2, 3);
    scene.add(pointLight);
    pointLightRef.current = pointLight;

    const backLight = new THREE.PointLight(0x5a5a40, 2, 10);
    backLight.position.set(-2, -2, -2);
    scene.add(backLight);

    const coreDetail = getGeometryDetail(4, tier);
    const coreGeo = new THREE.IcosahedronGeometry(1.2, coreDetail);
    const positionAttr = coreGeo.attributes.position;
    const originalPositions = new Float32Array(positionAttr.array.length);
    originalPositions.set(positionAttr.array);
    coreGeo.userData = { originalPositions };

    const coreMat = new THREE.MeshStandardMaterial({
      color: targetColorCore.current,
      roughness: 0.25,
      metalness: 0.15,
      flatShading: false,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);
    coreMeshRef.current = coreMesh;

    const wireGeo = new THREE.IcosahedronGeometry(1.4, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: targetColorGlow.current,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);
    wireframeMeshRef.current = wireMesh;

    const ring1Geo = new THREE.TorusGeometry(1.65, 0.02, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: targetColorGlow.current,
      transparent: true,
      opacity: 0.4,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);
    ring1Ref.current = ring1;

    const ring2Geo = new THREE.TorusGeometry(1.85, 0.015, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: targetColorCore.current,
      transparent: true,
      opacity: 0.3,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);
    ring2Ref.current = ring2;

    const particleCount = getParticleCount(70, tier);
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 1.6 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.75,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

      const { status: curStatus, userVolume: curUserVol, agentVolume: curAgentVol } = dynamicStateRef.current;
      const effectiveVol = curStatus === 'speaking' ? curAgentVol : curUserVol;
      const audioPulse = Math.min(1.5, 1.0 + effectiveVol * 1.8);

      if (coreMat.color) {
        coreMat.color.lerp(targetColorCore.current, 0.06);
      }
      if (wireMat.color) {
        wireMat.color.lerp(targetColorGlow.current, 0.06);
      }
      if (pointLightRef.current) {
        pointLightRef.current.color.lerp(targetColorGlow.current, 0.06);
        pointLightRef.current.intensity = 2.0 + effectiveVol * 4.0;
      }

      if (coreMeshRef.current) {
        const geo = coreMeshRef.current.geometry as THREE.BufferGeometry;
        const pos = geo.attributes.position;
        const orig = geo.userData.originalPositions as Float32Array;

        const waveSpeed = curStatus === 'speaking' ? 4.5 : curStatus === 'listening' ? 3.0 : 1.2;
        const waveAmp = (curStatus === 'speaking' ? 0.22 : curStatus === 'listening' ? 0.16 : 0.06) * audioPulse;

        for (let i = 0; i < pos.count; i++) {
          const ox = orig[i * 3];
          const oy = orig[i * 3 + 1];
          const oz = orig[i * 3 + 2];

          const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
          const nx = ox / len;
          const ny = oy / len;
          const nz = oz / len;

          const displacement =
            Math.sin(nx * 4.0 + elapsedTime * waveSpeed) *
            Math.cos(ny * 4.0 + elapsedTime * waveSpeed) *
            Math.sin(nz * 4.0 + elapsedTime * waveSpeed) *
            waveAmp;

          const factor = (len + displacement) / len;
          pos.setXYZ(i, ox * factor, oy * factor, oz * factor);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        coreMeshRef.current.rotation.y += 0.008 + (curStatus === 'thinking' ? 0.03 : 0);
        coreMeshRef.current.rotation.x = mousePos.current.y * 0.4;
        coreMeshRef.current.rotation.z = mousePos.current.x * 0.4;
      }

      if (wireframeMeshRef.current) {
        wireframeMeshRef.current.rotation.y -= 0.005;
        wireframeMeshRef.current.rotation.z += 0.003;
        wireframeMeshRef.current.scale.setScalar(1.0 + (audioPulse - 1.0) * 0.5);
      }

      if (ring1Ref.current) {
        ring1Ref.current.rotation.z += curStatus === 'thinking' ? 0.04 : 0.01;
        ring1Ref.current.rotation.x = Math.PI / 3 + Math.sin(elapsedTime * 1.5) * 0.1;
      }
      if (ring2Ref.current) {
        ring2Ref.current.rotation.z -= curStatus === 'thinking' ? 0.03 : 0.008;
        ring2Ref.current.rotation.y = Math.PI / 4 + Math.cos(elapsedTime * 1.2) * 0.1;
      }

      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.003;
        particlesRef.current.rotation.x = Math.sin(elapsedTime * 0.5) * 0.1;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      release(renderer);
      rendererRef.current = null;
    };
  }, [size, webglSupported, contextLost, rendererFailed, acquire, release]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (!rect) return;
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 0.8;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 0.8;
      mousePos.current.targetX = nx;
      mousePos.current.targetY = ny;
      return;
    }
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (coreMeshRef.current) {
      coreMeshRef.current.rotation.y += dx * 0.01;
      coreMeshRef.current.rotation.x += dy * 0.01;
    }
    if (wireframeMeshRef.current) {
      wireframeMeshRef.current.rotation.y += dx * 0.01;
      wireframeMeshRef.current.rotation.x += dy * 0.01;
    }
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  if (!webglSupported || contextLost || rendererFailed) {
    const glowColor =
      status === 'speaking' ? '#2E6F40' :
      status === 'listening' ? '#D4A373' :
      status === 'thinking' ? '#319795' :
      status === 'error' ? '#E53E3E' :
      '#5A5A40';

    return (
      <div
        className={`relative select-none flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <WebGLFallback variant="orb" color={glowColor} size={size} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative select-none cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center ${className}`}
      style={{ width: size, height: size, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      title="Assistente de Voz Puck (Arraste para girar)"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
