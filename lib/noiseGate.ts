'use client';

import { useSyncExternalStore } from 'react';

/**
 * Supressor de ruído "modo próximo" do microfone da voz.
 *
 * Duas camadas:
 * 1. Store module-level (`VoiceNoiseState`) — fonte única da preferência
 *    (localStorage + sync de nuvem via hooks/useVoiceSettings), consumida pela
 *    tool de voz, pelo AudioStreamer e pela HUD (partículas roxas).
 * 2. `NoiseGateProcessor` — DSP per-sample aplicado ao PCM capturado: piso de
 *    ruído adaptativo + gate com histerese que deixa passar só quem está perto
 *    do microfone (~30 cm no modo automático/manual).
 */

export type NoiseGateMode = 'automatico' | 'manual' | 'desligado';

export interface VoiceNoiseState {
  modo: NoiseGateMode;
  /** Distância de corte em cm (referência do modo manual / piso do automático). */
  distancia_cm: number;
  /** Epoch ms da última gravação — usado para reconciliar local × nuvem. */
  updatedAt: number;
}

export const NOISE_STORAGE_KEY = 'agronomic_voice_noise_v1';
export const NOISE_EVENT = 'agronomic_voice_noise_update';
export const NOISE_GATE_MODES: readonly NoiseGateMode[] = [
  'automatico',
  'manual',
  'desligado',
];
export const DEFAULT_DISTANCIA_CM = 30;
export const MIN_DISTANCIA_CM = 5;
export const MAX_DISTANCIA_CM = 120;

/** Ganho de compensação com o AGC desligado no modo ativo (limitado por tanh). */
const NOISE_MAKEUP = 2;
/** Margem inicial do modo automático (dB acima do piso). */
const DEFAULT_AUTO_MARGIN_DB = 12;

const DEFAULT_STATE: VoiceNoiseState = {
  modo: 'automatico',
  distancia_cm: DEFAULT_DISTANCIA_CM,
  updatedAt: 0,
};

export function clampDistancia(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DISTANCIA_CM;
  return Math.min(MAX_DISTANCIA_CM, Math.max(MIN_DISTANCIA_CM, Math.round(value)));
}

function sanitize(raw: unknown): VoiceNoiseState | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const modo = String(rec.modo ?? '') as NoiseGateMode;
  if (!NOISE_GATE_MODES.includes(modo)) return null;
  const updatedAt = Number(rec.updatedAt);
  return {
    modo,
    distancia_cm: clampDistancia(Number(rec.distancia_cm)),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

// ---- store (padrão useLibrasSettings: cache + evento custom + storage) ----

let cachedRaw: string | null = null;
let cachedState: VoiceNoiseState = DEFAULT_STATE;

function loadState(): VoiceNoiseState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(NOISE_STORAGE_KEY);
    if (raw === null) {
      if (cachedRaw !== null) {
        cachedRaw = null;
        cachedState = DEFAULT_STATE;
      }
      return cachedState;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedState = sanitize(JSON.parse(raw)) ?? DEFAULT_STATE;
    }
    return cachedState;
  } catch {
    return DEFAULT_STATE;
  }
}

/** Snapshot não-React (tools de voz, AudioStreamer, sync de nuvem). */
export function getVoiceNoiseState(): VoiceNoiseState {
  return loadState();
}

export function subscribeVoiceNoise(
  callback: (state: VoiceNoiseState) => void
): () => void {
  const handler = () => callback(loadState());
  window.addEventListener(NOISE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(NOISE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Atualiza o estado. `partial.updatedAt` só é passado ao aplicar um valor
 * vindo da nuvem; mudanças locais recebem Date.now().
 */
export function setVoiceNoiseState(partial: {
  modo?: NoiseGateMode;
  distancia_cm?: number;
  updatedAt?: number;
}): VoiceNoiseState {
  const current = loadState();
  const next: VoiceNoiseState = {
    modo: partial.modo ?? current.modo,
    distancia_cm: clampDistancia(
      partial.distancia_cm !== undefined ? partial.distancia_cm : current.distancia_cm
    ),
    updatedAt:
      partial.updatedAt !== undefined && Number.isFinite(partial.updatedAt)
        ? partial.updatedAt
        : Date.now(),
  };
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cachedState = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(NOISE_STORAGE_KEY, raw);
    } catch {
      // storage indisponível (modo privado) — a memória continua válida
    }
    window.dispatchEvent(new Event(NOISE_EVENT));
  }
  return next;
}

export function useVoiceNoiseState(): VoiceNoiseState {
  return useSyncExternalStore(
    subscribeVoiceNoise,
    getVoiceNoiseState,
    getVoiceNoiseState
  );
}

// ---- tool de voz (compartilhada por agente global e Tutor) ----

export type NoiseGateToolResult =
  | {
      ok: true;
      state: Pick<VoiceNoiseState, 'modo' | 'distancia_cm'>;
      label: string;
      message: string;
    }
  | { ok: false; error: string };

/** Valida os args de `setSupressorRuido`, grava o estado e monta a resposta falada. */
export function applyNoiseGateToolArgs(args: Record<string, unknown>): NoiseGateToolResult {
  const modoRaw = String(args.modo ?? '').trim() as NoiseGateMode;
  if (!NOISE_GATE_MODES.includes(modoRaw)) {
    return { ok: false, error: `Modo inválido. Use: ${NOISE_GATE_MODES.join(', ')}.` };
  }

  const rawDist = args.distancia_cm;
  let distancia: number;
  if (rawDist !== undefined && rawDist !== null && String(rawDist).trim() !== '') {
    const d = Number(rawDist);
    if (!Number.isFinite(d)) {
      return { ok: false, error: 'distancia_cm inválida (use um número em centímetros).' };
    }
    distancia = clampDistancia(d);
  } else {
    // Sem parâmetro: mantém a distância atual (padrão 30 cm em uso novo).
    distancia = loadState().distancia_cm;
  }

  setVoiceNoiseState({ modo: modoRaw, distancia_cm: distancia });
  const state: Pick<VoiceNoiseState, 'modo' | 'distancia_cm'> = {
    modo: modoRaw,
    distancia_cm: distancia,
  };

  if (modoRaw === 'automatico') {
    return {
      ok: true,
      state,
      label: 'Supressor automático',
      message: `Supressor de ruído em modo AUTOMÁTICO: o áudio se ajusta sozinho ao ruído de fundo (trânsito, escola, parque) e só deixa passar quem está perto do microfone (referência de ${distancia} cm).`,
    };
  }
  if (modoRaw === 'manual') {
    return {
      ok: true,
      state,
      label: `Supressor fixo em ${distancia} cm`,
      message: `Modo manual fixado em ${distancia} cm: o ajuste automático parou e o microfone corta o que estiver além dessa distância. Peça "modo supressor automático" para voltar ao ajuste automático.`,
    };
  }
  return {
    ok: true,
    state,
    label: 'Supressor desligado',
    message:
      'Supressor de ruído desligado: o microfone volta a captar tudo normalmente, inclusive o ruído de fundo.',
  };
}

// ---- DSP ----

/**
 * Margem (dB acima do piso de ruído) do modo manual por distância de corte.
 * 15 cm ≈ 18 dB · 30 cm ≈ 12 dB · 60 cm ≈ 6 dB · 100 cm ≈ 3 dB.
 */
export function distanciaToMarginDb(cm: number): number {
  const value = clampDistancia(cm);
  const db = 20 * Math.log10(60 / value) + 6;
  return Math.min(24, Math.max(3, db));
}

/**
 * Gate de proximidade adaptativo (per-sample, in-place).
 *
 * - Estima continuamente o piso de ruído ambiente (RMS com tempos assimétricos:
 *   desce rápido quando fica quieto, sobe devagar — fala contínua não dispara).
 * - Modo `automatico`: margem = f(piso) — ambiente calmo quase transparente
 *   (6 dB), ambiente ruidoso mais agressivo (até 18 dB), suavizada no tempo.
 * - Modo `manual`: margem fixa pela distância (`distanciaToMarginDb`).
 * - Gate com histerese (abre acima do limiar, fecha ~4 dB abaixo), envelope de
 *   ataque rápido (~8 ms) e release suave (~180 ms) para não cortar sílabas.
 * - Modo `desligado`: bypass total (só mantém o piso estimado p/ reativar já
 *   calibrado).
 */
export class NoiseGateProcessor {
  private readonly sampleRate: number;
  private modo: NoiseGateMode;
  private distanciaCm: number;

  private floor = 0.001;
  private floorInitialized = false;
  private marginDb: number;
  private hpX = 0;
  private hpY = 0;
  private env = 0;
  private gain = 1;
  private target = 1;

  private readonly hpCoef: number;
  private readonly envReleaseCoef: number;
  private readonly gainAttackCoef: number;
  private readonly gainReleaseCoef: number;

  constructor(
    sampleRate: number,
    state: Pick<VoiceNoiseState, 'modo' | 'distancia_cm'>
  ) {
    const sr = sampleRate > 0 ? sampleRate : 16000;
    this.sampleRate = sr;
    this.modo = state.modo;
    this.distanciaCm = state.distancia_cm;
    this.marginDb =
      state.modo === 'manual'
        ? distanciaToMarginDb(state.distancia_cm)
        : DEFAULT_AUTO_MARGIN_DB;

    // High-pass one-pole ~80 Hz (remove vento/tremores graves).
    const rc = 1 / (2 * Math.PI * 80);
    const dt = 1 / sr;
    this.hpCoef = rc / (rc + dt);

    this.envReleaseCoef = 1 - Math.exp(-dt / 0.04);
    this.gainAttackCoef = 1 - Math.exp(-dt / 0.008);
    this.gainReleaseCoef = 1 - Math.exp(-dt / 0.18);
  }

  setConfig(modo: NoiseGateMode, distanciaCm: number): void {
    this.modo = modo;
    this.distanciaCm = distanciaCm;
  }

  process(data: Float32Array): void {
    const n = data.length;
    if (n === 0) return;
    const dt = n / this.sampleRate;

    // 1) Piso de ruído — estimado sempre (inclusive no bypass), sobre o sinal
    //    cru: high-pass/gate alterariam a leitura do ambiente.
    let sum = 0;
    for (let i = 0; i < n; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / n);
    if (!this.floorInitialized) {
      this.floor = Math.max(rms, 1e-5);
      this.floorInitialized = true;
    } else {
      const coef =
        rms < this.floor
          ? 1 - Math.exp(-dt / 0.8) // desce rápido em silêncio (~0,8 s)
          : 1 - Math.exp(-dt / 3.0); // sobe devagar com ruído sustentado (~3 s)
      this.floor += (rms - this.floor) * coef;
      if (this.floor < 1e-5) this.floor = 1e-5;
    }

    if (this.modo === 'desligado') return;

    // 2) Margem (automática adaptativa ou fixa por distância).
    const floorDb = 20 * Math.log10(this.floor + 1e-9);
    const targetMargin =
      this.modo === 'manual'
        ? distanciaToMarginDb(this.distanciaCm)
        : Math.min(18, Math.max(6, 6 + (floorDb + 60) * 0.55));
    this.marginDb += (targetMargin - this.marginDb) * (1 - Math.exp(-dt / 2.0));
    const threshold = this.floor * Math.pow(10, this.marginDb / 20);
    const closeThreshold = threshold * 0.6; // histerese (~-4,4 dB)

    // 3) High-pass + envelope + gate + ganho, por amostra (in-place).
    for (let i = 0; i < n; i++) {
      const x = data[i];
      this.hpY = this.hpCoef * (this.hpY + x - this.hpX);
      this.hpX = x;
      const y = this.hpY;

      const abs = y < 0 ? -y : y;
      this.env =
        abs > this.env ? abs : this.env + (abs - this.env) * this.envReleaseCoef;

      if (this.env > threshold) this.target = 1;
      else if (this.env < closeThreshold) this.target = 0;

      const coef = this.target > this.gain ? this.gainAttackCoef : this.gainReleaseCoef;
      this.gain += (this.target - this.gain) * coef;

      data[i] = Math.tanh(y * this.gain * NOISE_MAKEUP);
    }
  }
}
