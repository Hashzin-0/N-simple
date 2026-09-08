'use client';

import React from 'react';

type GeometryType =
  | 'dodecahedron'
  | 'box'
  | 'octahedron'
  | 'torusknot'
  | 'icosahedron'
  | 'cone'
  | 'torus'
  | 'sphere'
  | 'cylinder';

interface NavSvgIconProps {
  geometry: GeometryType;
  color?: string;
  isActive?: boolean;
  className?: string;
}

function DodecahedronIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L21.5 7.5L18.5 17.5L5.5 17.5L2.5 7.5L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.15"
      />
      <path d="M12 2L12 12" stroke={color} strokeWidth="1" opacity="0.5" />
      <path d="M2.5 7.5L12 12" stroke={color} strokeWidth="1" opacity="0.5" />
      <path d="M21.5 7.5L12 12" stroke={color} strokeWidth="1" opacity="0.5" />
      <path d="M18.5 17.5L12 12" stroke={color} strokeWidth="1" opacity="0.4" />
      <path d="M5.5 17.5L12 12" stroke={color} strokeWidth="1" opacity="0.4" />
      <circle cx="12" cy="12" r="1.5" fill={color} opacity="0.6" />
    </svg>
  );
}

function BoxIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3L21 8V16L12 21L3 16V8L12 3Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.1"
      />
      <path
        d="M12 12L21 8"
        stroke={color}
        strokeWidth="1"
        opacity="0.4"
      />
      <path
        d="M12 12L3 8"
        stroke={color}
        strokeWidth="1"
        opacity="0.4"
      />
      <path
        d="M12 12V21"
        stroke={color}
        strokeWidth="1"
        opacity="0.3"
      />
      <path
        d="M7.5 5.5L16.5 10.5"
        stroke={color}
        strokeWidth="1"
        opacity="0.3"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function OctahedronIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L22 12L12 22L2 12L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.12"
      />
      <path d="M12 2L7 12" stroke={color} strokeWidth="1" opacity="0.4" />
      <path d="M12 2L17 12" stroke={color} strokeWidth="1" opacity="0.4" />
      <path d="M12 22L7 12" stroke={color} strokeWidth="1" opacity="0.3" />
      <path d="M12 22L17 12" stroke={color} strokeWidth="1" opacity="0.3" />
      <circle cx="12" cy="12" r="1.2" fill={color} opacity="0.5" />
    </svg>
  );
}

function TorusKnotIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 4C8 4 4 7 4 10C4 13 7 14 9 13C11 12 10 9 12 8C14 7 16 9 16 11C16 13 14 14 12 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 14C10 14 8 16 8 18C8 20 10 20 12 19C14 18 16 16 14 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <circle cx="12" cy="11" r="1" fill={color} opacity="0.5" />
    </svg>
  );
}

function IcosahedronIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L20 8L18 18L6 18L4 8L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.1"
      />
      <path d="M12 2L12 12" stroke={color} strokeWidth="1" opacity="0.5" />
      <path d="M4 8L12 12" stroke={color} strokeWidth="1" opacity="0.4" />
      <path d="M20 8L12 12" stroke={color} strokeWidth="1" opacity="0.4" />
      <path d="M6 18L12 12" stroke={color} strokeWidth="1" opacity="0.3" />
      <path d="M18 18L12 12" stroke={color} strokeWidth="1" opacity="0.3" />
      <path d="M8 10L16 10" stroke={color} strokeWidth="0.8" opacity="0.3" />
      <path d="M7 14L17 14" stroke={color} strokeWidth="0.8" opacity="0.25" />
      <circle cx="12" cy="12" r="1" fill={color} opacity="0.5" />
    </svg>
  );
}

function ConeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3L20 18H4L12 3Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={color}
        fillOpacity="0.12"
      />
      <ellipse
        cx="12"
        cy="18"
        rx="8"
        ry="3"
        stroke={color}
        strokeWidth="1.2"
        fill={color}
        fillOpacity="0.08"
      />
      <path d="M12 3L12 18" stroke={color} strokeWidth="0.8" opacity="0.3" strokeDasharray="2 2" />
    </svg>
  );
}

function TorusIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="5"
        ry="2.5"
        stroke={color}
        strokeWidth="1.2"
        fill={color}
        fillOpacity="0.08"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="3 4"
        opacity="0.3"
      />
    </svg>
  );
}

function SphereIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity="0.06"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4"
        stroke={color}
        strokeWidth="1"
        opacity="0.4"
        fill="none"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4"
        ry="9"
        stroke={color}
        strokeWidth="1"
        opacity="0.4"
        fill="none"
      />
      <path
        d="M3 12C3 12 7 8 12 8C17 8 21 12 21 12"
        stroke={color}
        strokeWidth="0.8"
        opacity="0.3"
        fill="none"
      />
    </svg>
  );
}

function CylinderIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse
        cx="12"
        cy="6"
        rx="7"
        ry="3"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity="0.1"
      />
      <path
        d="M5 6V18C5 19.66 8.13 21 12 21C15.87 21 19 19.66 19 18V6"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity="0.06"
      />
      <ellipse
        cx="12"
        cy="18"
        rx="7"
        ry="3"
        stroke={color}
        strokeWidth="1"
        opacity="0.4"
        fill="none"
      />
    </svg>
  );
}

const ICON_MAP: Record<GeometryType, React.FC<{ color: string }>> = {
  dodecahedron: DodecahedronIcon,
  box: BoxIcon,
  octahedron: OctahedronIcon,
  torusknot: TorusKnotIcon,
  icosahedron: IcosahedronIcon,
  cone: ConeIcon,
  torus: TorusIcon,
  sphere: SphereIcon,
  cylinder: CylinderIcon,
};

export default function NavSvgIcon({
  geometry,
  color = '#5A5A40',
  isActive = false,
  className = '',
}: NavSvgIconProps) {
  const Icon = ICON_MAP[geometry];

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <span
        className="block"
        style={{
          width: '1em',
          height: '1em',
          transition: 'filter 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter: isActive
            ? `drop-shadow(0 0 5px ${color})`
            : 'none',
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <Icon color={color} />
      </span>
    </span>
  );
}
