'use client';

import React from 'react';
import { SplitFlapDisplay, type SplitFlapSize, type SplitFlapAlign } from './split-flap-display';

interface SplitFlapValueProps {
  value: number;
  decimalPlaces?: number;
  size?: SplitFlapSize;
  align?: SplitFlapAlign;
  unit?: string;
  className?: string;
  charset?: string;
  stagger?: number;
  maxFlaps?: number;
}

const DIGIT_CHARSET = " 0123456789.,-";

function formatNumber(value: number, decimalPlaces: number): string {
  const fixed = value.toFixed(decimalPlaces);
  return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, '');
}

export function SplitFlapValue({
  value,
  decimalPlaces = 2,
  size = 'sm',
  align = 'right',
  unit,
  className,
  charset = DIGIT_CHARSET,
  stagger = 0.06,
  maxFlaps = 12,
}: SplitFlapValueProps) {
  const display = formatNumber(value, decimalPlaces);
  const len = display.length;

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className ?? ''}`}>
      <SplitFlapDisplay
        value={display}
        length={len}
        size={size}
        align={align}
        charset={charset}
        stagger={stagger}
        maxFlaps={maxFlaps}
        className="!bg-[#5A5A40] dark:!bg-[#3D4C37] [&_[data-slot=split-flap-display]]:!bg-[#5A5A40]"
      />
      {unit && (
        <span className="text-[10px] font-semibold text-[#8C897E] dark:text-[#9EA399] whitespace-nowrap">
          {unit}
        </span>
      )}
    </span>
  );
}
