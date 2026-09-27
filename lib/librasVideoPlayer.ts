import { useSyncExternalStore } from 'react';

/**
 * Abre/fecha o player de vídeo de Libras programaticamente (fluxo de voz:
 * "mostrar sinal no YouTube"). O modal é montado UMA vez em
 * `components/LibrasNoAgro/index.tsx` e reproduz com autoplay.
 */

export interface LibrasVideoState {
  videoId: string;
  title: string;
}

let state: LibrasVideoState | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openLibrasVideo(videoId: string, title: string): void {
  state = { videoId, title };
  emit();
}

export function closeLibrasVideo(): void {
  state = null;
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): LibrasVideoState | null {
  return state;
}

/** Hook de leitura (host do modal). */
export function useLibrasVideo(): LibrasVideoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
