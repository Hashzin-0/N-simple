'use client';

import { useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleDot,
  Gauge,
  Lock,
  RotateCw,
  Settings,
  Tractor,
} from 'lucide-react';
import type { TractorSymbol } from '@/lib/tratoristaSimbolos';

const FALLBACK_ICONS = {
  rockshaft: ArrowUpDown,
  'rockshaft-up': ArrowUp,
  'rockshaft-down': ArrowDown,
  'remote-cylinder': Settings,
  'remote-extend': ArrowUp,
  'remote-retract': ArrowDown,
  'diff-lock': Lock,
  'pto-cw': RotateCw,
  'wheel-slip': Activity,
  'position-lights': CircleDot,
  'parking-brake': Lock,
  'parking-lights': CircleDot,
  'tractor-side': Tractor,
  'tractor-top': Tractor,
  'slip-axle': Lock,
  'inter-axle-lock': Lock,
  'hood-open': ArrowUp,
  'pto-stop': CircleDot,
} as const;

type Props = {
  symbol: TractorSymbol;
  className?: string;
};

export function TractorSymbolImage({ symbol, className = 'h-20 w-20' }: Props) {
  const [failed, setFailed] = useState(false);
  const Icon = FALLBACK_ICONS[symbol.id as keyof typeof FALLBACK_ICONS] ?? Gauge;

  if (failed) {
    return (
      <span
        role="img"
        aria-label={symbol.title + ' — pictograma ilustrativo; imagem ISO externa indisponível'}
        title="Pictograma ilustrativo: a imagem de referência externa não carregou"
        className="inline-flex h-full w-full flex-col items-center justify-center gap-1 text-[#42533D] dark:text-[#D1DEC9]"
      >
        <Icon className="h-9 w-9" strokeWidth={1.8} aria-hidden="true" />
        <span className="text-[8px] font-bold tracking-wide">{symbol.iso.replace('ISO 7000-', '')}</span>
      </span>
    );
  }

  return (
    <img
      src={symbol.imageUrl}
      alt={symbol.title + ' — ' + symbol.iso}
      className={className + ' object-contain'}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
