'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface AsciiSphereProps {
  size?: number;
  onClick?: () => void;
  isConnecting?: boolean;
  className?: string;
}

const CHAR_RAMP = ' .,:;+*%#@';

export default function AsciiSphere({
  size = 112,
  onClick,
  isConnecting = false,
  className = '',
}: AsciiSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const propsRef = useRef({ size, isConnecting });

  useEffect(() => {
    propsRef.current = { size, isConnecting };
  });

  useEffect(() => {
    const draw = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { size: w, isConnecting: connecting } = propsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const elapsed = timestamp / 1000;

      const cellSize = Math.max(3, Math.round(w / 16));
      const cols = Math.floor(w / cellSize);
      const rows = Math.floor(w / cellSize);
      const cx = cols / 2;
      const cy = rows / 2;
      const radius = Math.min(cols, cy) * 0.42;

      const breathe = Math.sin(elapsed * 1.8) * 0.08 + 0.92;
      const glowPulse = Math.sin(elapsed * 1.2) * 0.15 + 0.85;

      ctx.clearRect(0, 0, w, w);

      ctx.font = `${cellSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const dx = col - cx;
          const dy = row - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > radius * breathe) continue;

          const nz = Math.sqrt(
            Math.max(0, 1 - (dx * dx + dy * dy) / (radius * radius * breathe * breathe))
          );

          const lightX = -0.3;
          const lightY = -0.4;
          const lightZ = 0.86;
          const len = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
          const nlx = lightX / len;
          const nly = lightY / len;
          const nlz = lightZ / len;
          const nx = dx / (radius * breathe);
          const ny = dy / (radius * breathe);
          const diffuse = Math.max(0, nx * nlx + ny * nly + nz * nlz);

          const edgeFade = 1 - Math.pow(1 - nz, 2);
          const brightness = diffuse * edgeFade * glowPulse;
          const idx = Math.min(
            CHAR_RAMP.length - 1,
            Math.max(0, Math.round(brightness * (CHAR_RAMP.length - 1)))
          );
          const ch = CHAR_RAMP[idx];

          const hue = connecting ? 45 : 80;
          const sat = connecting ? 60 : 35;
          const light = 25 + brightness * 40;
          const alpha = 0.4 + brightness * 0.6;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
          ctx.fillText(ch, col * cellSize + cellSize / 2, row * cellSize + cellSize / 2);
        }
      }
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <button
      onClick={onClick}
      disabled={isConnecting}
      className={`relative flex items-center justify-center rounded-full cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A5A40] dark:focus-visible:ring-[#C5A880] disabled:cursor-wait ${className}`}
      style={{ width: size, height: size }}
      title={isConnecting ? 'Conectando ao Puck...' : 'Conversar por voz com Puck'}
      id="btn_start_voice_agent"
    >
      {isConnecting && (
        <div className="absolute inset-0 rounded-full bg-[#5A5A40]/20 dark:bg-[#C5A880]/10 blur-xl animate-pulse pointer-events-none" />
      )}
      <canvas
        ref={canvasRef}
        className="pointer-events-none relative z-10"
        style={{ width: size, height: size }}
      />
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-3 h-3 border-2 border-[#C5A880] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </button>
  );
}
