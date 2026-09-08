'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface WebGLFallbackProps {
  variant: 'orb' | 'icon' | 'full';
  color?: string;
  size?: number;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

function OrbFallback({ color, size, className }: { color: string; size: number; className?: string }) {
  return (
    <div
      className={cn('relative select-none flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="rounded-full animate-pulse"
        style={{
          width: size * 0.5,
          height: size * 0.5,
          backgroundColor: color,
          boxShadow: `0 0 ${size * 0.25}px ${size * 0.12}px ${color}60`,
        }}
      />
    </div>
  );
}

function IconFallback({ color, size, className }: { color: string; size: number; className?: string }) {
  return (
    <div
      className={cn('w-[56px] h-[56px] flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="w-8 h-8 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}60`,
        }}
      />
    </div>
  );
}

function FullFallback({ color, label, className, children }: { color: string; label?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        'w-full h-[220px] flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed',
        className
      )}
      style={{ borderColor: `${color}40` }}
    >
      {children}
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9CA38C]">
          {label}
        </span>
      )}
    </div>
  );
}

export default function WebGLFallback({ variant, color = '#5A5A40', size = 56, label, className, children }: WebGLFallbackProps) {
  switch (variant) {
    case 'orb':
      return <OrbFallback color={color} size={size} className={className} />;
    case 'icon':
      return <IconFallback color={color} size={size} className={className} />;
    case 'full':
      return (
        <FullFallback color={color} label={label} className={className}>
          {children}
        </FullFallback>
      );
    default:
      return null;
  }
}
