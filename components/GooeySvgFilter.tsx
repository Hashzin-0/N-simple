'use client';

import { useId } from 'react';

interface GooeySvgFilterProps {
  id?: string;
  strength?: number;
}

export default function GooeySvgFilter({ id: customId, strength = 12 }: GooeySvgFilterProps) {
  const uid = useId().replace(/:/g, '');
  const filterId = customId ?? `gooey-svg-${uid}`;

  return (
    <svg
      className="absolute pointer-events-none overflow-hidden"
      style={{ width: 0, height: 0, position: 'absolute', zIndex: -10 }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={filterId}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          {/* Gaussian blur to melt shapes together */}
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={strength}
            result="blur"
          />
          {/* Color matrix with steep alpha slope for crisp liquid metaball edges */}
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 22 -9"
            result="goo"
          />
        </filter>
      </defs>
    </svg>
  );
}
