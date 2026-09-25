'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  ThinkingOrb,
  MODE_FRAMES,
  resolvePreset,
  finalizeFrame,
  type Dot,
  type Line,
  type ModeOpts,
  type OrbFrame,
  type OrbSize,
  type OrbState,
  type OrbTheme,
} from 'thinking-orbs';

/** Duração do morph geométrico entre dois estados (ms). */
const MORPH_MS = 450;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Interpola dois frames com contagens de dots diferentes.
 *  O lado que não tem ponto correspondente nasce/morre com alpha 0 na
 *  posição do outro lado (finalizeFrame depois remove os invisíveis). */
function lerpDots(a: Dot[], b: Dot[], k: number): Dot[] {
  const n = Math.max(a.length, b.length);
  const out: Dot[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const da = a[i];
    const db = b[i];
    const A = da ?? { ...(db as Dot), a: 0 };
    const B = db ?? { ...(da as Dot), a: 0 };
    const aa = A.a ?? 1;
    const ba = B.a ?? 1;
    out[i] = {
      x: A.x + (B.x - A.x) * k,
      y: A.y + (B.y - A.y) * k,
      z: A.z + (B.z - A.z) * k,
      r: A.r + (B.r - A.r) * k,
      white: A.white + (B.white - A.white) * k,
      a: aa + (ba - aa) * k,
    };
  }
  return out;
}

function lerpLines(a: Line[], b: Line[], k: number): Line[] {
  const n = Math.max(a.length, b.length);
  const out: Line[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const la = a[i];
    const lb = b[i];
    const A = la ?? { ...(lb as Line), a: 0 };
    const B = lb ?? { ...(la as Line), a: 0 };
    const aa = A.a ?? 1;
    const ba = B.a ?? 1;
    out[i] = {
      x1: A.x1 + (B.x1 - A.x1) * k,
      y1: A.y1 + (B.y1 - A.y1) * k,
      x2: A.x2 + (B.x2 - A.x2) * k,
      y2: A.y2 + (B.y2 - A.y2) * k,
      w: A.w + (B.w - A.w) * k,
      white: A.white + (B.white - A.white) * k,
      a: aa + (ba - aa) * k,
    };
  }
  return out;
}

interface AgentStatusOrbProps {
  state: OrbState;
  size?: OrbSize;
  theme?: OrbTheme;
  className?: string;
  ariaLabel?: string;
  speed?: number;
}

/**
 * Orb com morph geométrico entre estados.
 *
 * A lib não interpola: ao trocar `state` ela só re-executa o draw effect e
 * pinta do relógio global (swap seco). Aqui o prop `frame` é substituído por
 * uma função que, durante MORPH_MS, mistura os frames dos dois modos
 * (MODE_FRAMES + resolvePreset + finalizeFrame, tudo exportado pela lib).
 */
export default function AgentStatusOrb({
  state,
  size = 20,
  theme,
  className,
  ariaLabel,
  speed,
}: AgentStatusOrbProps) {
  /** Estado de onde a morph partiu. */
  const fromRef = useRef<OrbState>(state);
  /** Estado atual (destino da morph). */
  const toRef = useRef<OrbState>(state);
  /** performance.now() em que a morph começou (-Infinity = sem morph). */
  const startRef = useRef<number>(-Infinity);

  // Atualizado fora do render (regra do React): o frame só é lido dentro do
  // RAF do canvas, então o ref já está certo quando a morph começa a pintar.
  useLayoutEffect(() => {
    if (toRef.current === state) return;
    fromRef.current = toRef.current;
    toRef.current = state;
    startRef.current = performance.now();
  }, [state]);

  const frame = useMemo(() => {
    const build = (s: number, t: number, _opts: ModeOpts): OrbFrame => {
      const from = fromRef.current;
      const to = toRef.current;
      const startedAt = startRef.current;
      const p = Number.isFinite(startedAt)
        ? Math.min(1, (performance.now() - startedAt) / MORPH_MS)
        : 1;
      const toRes = resolvePreset(to, size);
      if (from === to || p >= 1) {
        return MODE_FRAMES[toRes.mode](s, t, toRes.opts);
      }
      const fromRes = resolvePreset(from, size);
      const a = MODE_FRAMES[fromRes.mode](s, t, fromRes.opts);
      const b = MODE_FRAMES[toRes.mode](s, t, toRes.opts);
      const k = easeInOutCubic(p);
      return finalizeFrame(lerpDots(a.dots, b.dots, k), lerpLines(a.lines, b.lines, k));
    };
    return build;
  }, [size]);

  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={theme}
      speed={speed}
      frame={frame}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
