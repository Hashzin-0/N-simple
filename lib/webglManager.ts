import * as THREE from 'three';

let webglAvailable: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (webglAvailable !== null) return webglAvailable;
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    webglAvailable = !!gl;
    if (gl) {
      const loseCtx = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    }
  } catch {
    webglAvailable = false;
  }
  return webglAvailable;
}

export type DeviceTier = 'mobile-low' | 'mobile-mid' | 'desktop';

export function getDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'desktop';
  const isMobile = window.innerWidth < 768;
  if (!isMobile) return 'desktop';
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as Record<string, unknown>['deviceMemory']) as number | undefined;
  if (cores <= 4 && (!memory || memory <= 2)) return 'mobile-low';
  return 'mobile-mid';
}

export function getMaxDPR(tier?: DeviceTier): number {
  const t = tier || getDeviceTier();
  switch (t) {
    case 'mobile-low': return 1.0;
    case 'mobile-mid': return 1.5;
    case 'desktop': return 2.0;
  }
}

export function getParticleCount(base: number, tier?: DeviceTier): number {
  const t = tier || getDeviceTier();
  switch (t) {
    case 'mobile-low': return Math.floor(base * 0.5);
    case 'mobile-mid': return Math.floor(base * 0.75);
    case 'desktop': return base;
  }
}

export function getGeometryDetail(base: number, tier?: DeviceTier): number {
  const t = tier || getDeviceTier();
  switch (t) {
    case 'mobile-low': return Math.max(0, base - 2);
    case 'mobile-mid': return Math.max(0, base - 1);
    case 'desktop': return base;
  }
}

export interface ManagedRenderer {
  renderer: THREE.WebGLRenderer;
  inUse: boolean;
  canvas: HTMLCanvasElement;
}

const MAX_RENDERERS = 4;
const activeRenderers: ManagedRenderer[] = [];

export interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  maxDPR?: number;
}

export function acquireRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions = {}
): THREE.WebGLRenderer | null {
  if (!isWebGLAvailable()) return null;

  const existing = activeRenderers.find((r) => r.canvas === canvas && r.inUse);
  if (existing) return existing.renderer;

  const free = activeRenderers.find((r) => !r.inUse);
  if (free) {
    free.inUse = true;
    free.canvas = canvas;
    try {
      try {
        free.renderer.dispose();
      } catch {}
      const renderer = createRenderer(canvas, options);
      free.renderer = renderer;
      return renderer;
    } catch {
      free.inUse = false;
      const idx = activeRenderers.indexOf(free);
      if (idx !== -1) activeRenderers.splice(idx, 1);
      return null;
    }
  }

  if (activeRenderers.length >= MAX_RENDERERS) {
    const oldest = activeRenderers.shift();
    if (oldest) {
      try {
        const loseCtx = oldest.renderer.getContext()?.getExtension('WEBGL_lose_context');
        if (loseCtx) loseCtx.loseContext();
        oldest.renderer.dispose();
      } catch {}
      oldest.inUse = false;
    }
  }

  try {
    const renderer = createRenderer(canvas, options);
    const entry: ManagedRenderer = { renderer, inUse: true, canvas };
    activeRenderers.push(entry);
    return renderer;
  } catch {
    return null;
  }
}

export function releaseRenderer(renderer: THREE.WebGLRenderer): void {
  const idx = activeRenderers.findIndex((r) => r.renderer === renderer);
  if (idx !== -1) {
    activeRenderers.splice(idx, 1);
  }
  try {
    const loseCtx = renderer.getContext()?.getExtension('WEBGL_lose_context');
    if (loseCtx) loseCtx.loseContext();
    renderer.dispose();
  } catch {}
}

function createRenderer(canvas: HTMLCanvasElement, options: RendererOptions): THREE.WebGLRenderer {
  const maxDPR = options.maxDPR ?? getMaxDPR();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha ?? true,
    powerPreference: options.powerPreference ?? 'default',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  return renderer;
}

export function getActiveRendererCount(): number {
  return activeRenderers.filter((r) => r.inUse).length;
}

export function disposeAllRenderers(): void {
  for (const entry of activeRenderers) {
    try {
      const loseCtx = entry.renderer.getContext()?.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
      entry.renderer.dispose();
    } catch {}
    entry.inUse = false;
  }
  activeRenderers.length = 0;
}
