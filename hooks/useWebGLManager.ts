'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  isWebGLAvailable,
  acquireRenderer,
  releaseRenderer,
  getDeviceTier,
  getMaxDPR,
  type RendererOptions,
  type DeviceTier,
} from '@/lib/webglManager';

export interface UseWebGLManagerReturn {
  webglSupported: boolean;
  deviceTier: DeviceTier;
  maxDPR: number;
  acquire: (canvas: HTMLCanvasElement, options?: RendererOptions) => THREE.WebGLRenderer | null;
  release: (renderer: THREE.WebGLRenderer) => void;
}

export function useWebGLManager(): UseWebGLManagerReturn {
  const webglSupported = isWebGLAvailable();
  const deviceTier = getDeviceTier();
  const maxDPR = getMaxDPR(deviceTier);
  const acquiredRef = useRef<THREE.WebGLRenderer[]>([]);

  const acquire = useCallback(
    (canvas: HTMLCanvasElement, options?: RendererOptions): THREE.WebGLRenderer | null => {
      if (!webglSupported) return null;
      const renderer = acquireRenderer(canvas, { maxDPR, ...options });
      if (renderer) acquiredRef.current.push(renderer);
      return renderer;
    },
    [webglSupported, maxDPR]
  );

  const release = useCallback((renderer: THREE.WebGLRenderer) => {
    releaseRenderer(renderer);
    acquiredRef.current = acquiredRef.current.filter((r) => r !== renderer);
  }, []);

  useEffect(() => {
    return () => {
      for (const r of acquiredRef.current) {
        releaseRenderer(r);
      }
      acquiredRef.current = [];
    };
  }, []);

  return { webglSupported, deviceTier, maxDPR, acquire, release };
}
