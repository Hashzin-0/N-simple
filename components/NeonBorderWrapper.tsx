'use client';

import React, { ReactNode } from 'react';
import { neonBorderLayers } from '@/lib/utils';

interface NeonBorderWrapperProps {
  children: ReactNode;
  className?: string;
}

export default function NeonBorderWrapper({ children, className = '' }: NeonBorderWrapperProps) {
  return (
    <div className={`relative neon-input-wrapper ${className}`}>
      {neonBorderLayers.map((layer, i) => (
        <div key={i} className={layer} />
      ))}
      {children}
    </div>
  );
}
