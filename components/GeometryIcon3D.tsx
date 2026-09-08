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

interface GeometryIcon3DProps {
  className?: string;
  geometry?: GeometryType;
  color?: string;
  isActive?: boolean;
}

function CubeFaces({ color }: { color: string }) {
  const s = 9;
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(30deg)' }}>
      <div className="absolute inset-[2px] rounded-sm" style={{ background: color, transform: `translateZ(${s / 2}px)`, opacity: 0.9 }} />
      <div className="absolute inset-[2px] rounded-sm" style={{ background: color, transform: `rotateY(180deg) translateZ(${s / 2}px)`, opacity: 0.7 }} />
      <div className="absolute inset-[2px] rounded-sm" style={{ background: color, transform: `rotateY(90deg) translateZ(${s / 2}px)`, opacity: 0.8 }} />
      <div className="absolute inset-[2px] rounded-sm" style={{ background: color, transform: `rotateY(-90deg) translateZ(${s / 2}px)`, opacity: 0.6 }} />
      <div className="absolute inset-[2px] rounded-sm" style={{ background: color, transform: `rotateX(90deg) translateZ(${s / 2}px)`, opacity: 0.85 }} />
      <div className="absolute inset-[2px] rounded-sm" style={{ background: color, transform: `rotateX(-90deg) translateZ(${s / 2}px)`, opacity: 0.55 }} />
    </div>
  );
}

function OctahedronFaces({ color }: { color: string }) {
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-15deg) rotateY(25deg)' }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `10px solid ${color}`, transform: 'rotateX(35deg) translateZ(3px)', opacity: 0.9 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `10px solid ${color}`, transform: 'rotateX(35deg) translateZ(3px)', opacity: 0.6 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `10px solid ${color}`, transform: 'rotateY(90deg) rotateX(35deg) translateZ(3px)', opacity: 0.75 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `10px solid ${color}`, transform: 'rotateY(180deg) rotateX(35deg) translateZ(3px)', opacity: 0.85 }} />
    </div>
  );
}

function DodecahedronFaces({ color }: { color: string }) {
  const pentagon = `polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)`;
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(20deg)' }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 13, height: 13, clipPath: pentagon, background: color, transform: 'translateZ(5px)', opacity: 0.9 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 13, height: 13, clipPath: pentagon, background: color, transform: 'rotateY(72deg) translateZ(5px)', opacity: 0.7 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 13, height: 13, clipPath: pentagon, background: color, transform: 'rotateY(144deg) translateZ(5px)', opacity: 0.8 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 13, height: 13, clipPath: pentagon, background: color, transform: 'rotateY(216deg) translateZ(5px)', opacity: 0.65 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 13, height: 13, clipPath: pentagon, background: color, transform: 'rotateY(288deg) translateZ(5px)', opacity: 0.75 }} />
    </div>
  );
}

function IcosahedronFaces({ color }: { color: string }) {
  const tri = `polygon(50% 0%, 0% 100%, 100% 100%)`;
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-15deg) rotateY(30deg)' }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 12, height: 12, clipPath: tri, background: color, transform: 'translateZ(5px)', opacity: 0.9 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 12, height: 12, clipPath: tri, background: color, transform: 'rotateY(60deg) translateZ(5px)', opacity: 0.7 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 12, height: 12, clipPath: tri, background: color, transform: 'rotateY(120deg) translateZ(5px)', opacity: 0.8 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 12, height: 12, clipPath: tri, background: color, transform: 'rotateY(180deg) translateZ(5px)', opacity: 0.65 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 12, height: 12, clipPath: tri, background: color, transform: 'rotateY(240deg) translateZ(5px)', opacity: 0.85 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 12, height: 12, clipPath: tri, background: color, transform: 'rotateY(300deg) translateZ(5px)', opacity: 0.75 }} />
    </div>
  );
}

function TorusFaces({ color }: { color: string }) {
  const segments = 8;
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-55deg) rotateZ(15deg)' }}>
      {Array.from({ length: segments }).map((_, i) => {
        const angle = (i / segments) * 360;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: 4,
              height: 4,
              background: color,
              transform: `rotateY(${angle}deg) translateX(7px) translateZ(0px)`,
              opacity: 0.5 + (i % 3) * 0.15,
            }}
          />
        );
      })}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px]" style={{ width: 16, height: 16, borderColor: color, transform: 'rotateX(90deg)', opacity: 0.7 }} />
    </div>
  );
}

function ConeFaces({ color }: { color: string }) {
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-10deg) rotateY(20deg)' }}>
      <div className="absolute left-1/2 top-[3px] -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: `14px solid ${color}`, opacity: 0.9 }} />
      <div className="absolute left-1/2 bottom-[3px] -translate-x-1/2 rounded-full" style={{ width: 14, height: 6, background: color, transform: 'rotateX(70deg)', opacity: 0.5 }} />
    </div>
  );
}

function TorusKnotFaces({ color }: { color: string }) {
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-25deg) rotateY(35deg)' }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px]" style={{ width: 14, height: 14, borderColor: color, transform: 'rotateX(60deg)', opacity: 0.8 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px]" style={{ width: 14, height: 14, borderColor: color, transform: 'rotateY(60deg)', opacity: 0.65 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px]" style={{ width: 10, height: 10, borderColor: color, transform: 'rotateX(30deg) rotateZ(45deg)', opacity: 0.75 }} />
    </div>
  );
}

function SphereFaces({ color }: { color: string }) {
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-15deg) rotateY(20deg)' }}>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]" style={{ width: 15, height: 15, borderColor: color, opacity: 0.9 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]" style={{ width: 15, height: 15, borderColor: color, transform: 'rotateY(90deg)', opacity: 0.6 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]" style={{ width: 15, height: 15, borderColor: color, transform: 'rotateX(90deg)', opacity: 0.5 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1px]" style={{ width: 10, height: 10, borderColor: color, transform: 'rotateY(45deg)', opacity: 0.4 }} />
    </div>
  );
}

function CylinderFaces({ color }: { color: string }) {
  return (
    <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-15deg) rotateY(25deg)' }}>
      <div className="absolute left-1/2 top-[2px] -translate-x-1/2 rounded-full" style={{ width: 14, height: 7, background: color, opacity: 0.85 }} />
      <div className="absolute left-1/2 bottom-[2px] -translate-x-1/2 rounded-full" style={{ width: 14, height: 7, background: color, opacity: 0.5 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm" style={{ width: 14, height: 12, background: color, opacity: 0.3 }} />
    </div>
  );
}

const GEOMETRY_MAP: Record<GeometryType, React.FC<{ color: string }>> = {
  dodecahedron: DodecahedronFaces,
  box: CubeFaces,
  octahedron: OctahedronFaces,
  torusknot: TorusKnotFaces,
  icosahedron: IcosahedronFaces,
  cone: ConeFaces,
  torus: TorusFaces,
  sphere: SphereFaces,
  cylinder: CylinderFaces,
};

export default function GeometryIcon3D({
  className = '',
  geometry = 'octahedron',
  color = '#5A5A40',
  isActive = false,
}: GeometryIcon3DProps) {
  const Shape = GEOMETRY_MAP[geometry];

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ perspective: '200px' }}
      aria-hidden="true"
    >
      <span
        className="relative block"
        style={{
          width: '1em',
          height: '1em',
          transformStyle: 'preserve-3d',
          filter: isActive ? `drop-shadow(0 0 4px ${color})` : 'none',
          animation: isActive ? 'icon3d-spin 4s linear infinite' : 'icon3d-spin 8s linear infinite',
        }}
      >
        <Shape color={color} />
      </span>
      <style jsx>{`
        @keyframes icon3d-spin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
      `}</style>
    </span>
  );
}
