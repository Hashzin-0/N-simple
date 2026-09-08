'use client';

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';

interface Button3DProps {
  id?: string;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  isDark?: boolean;
  className?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  tooltip?: string;
}

const VARIANT_STYLES = {
  primary: {
    base: 'bg-[#2E6F40] text-white border-[#2E6F40]',
    active: 'bg-[#255833] shadow-lg shadow-[#2E6F40]/30',
    hover: 'hover:bg-[#255833]',
  },
  secondary: {
    base: 'bg-[#5A5A40] text-white border-[#5A5A40]',
    active: 'bg-[#454530] shadow-lg shadow-[#5A5A40]/30',
    hover: 'hover:bg-[#454530]',
  },
  accent: {
    base: 'bg-[#D4A373] text-white border-[#D4A373]',
    active: 'bg-[#C19262] shadow-lg shadow-[#D4A373]/30',
    hover: 'hover:bg-[#C19262]',
  },
  danger: {
    base: 'bg-red-500 text-white border-red-500',
    active: 'bg-red-600 shadow-lg shadow-red-500/30',
    hover: 'hover:bg-red-600',
  },
  ghost: {
    base: 'bg-transparent text-[#8C897E] border-[#E5E2D9] dark:text-[#A6A395] dark:border-[#393E32]',
    active: 'bg-[#F9F8F6] dark:bg-[#242720] text-[#5A5A40] dark:text-[#E8E7DF] border-[#5A5A40] dark:border-[#7D8861]',
    hover: 'hover:bg-[#F9F8F6] dark:hover:bg-[#242720]',
  },
};

const SIZE_STYLES = {
  sm: 'text-xs px-3 py-1.5 rounded-xl gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-sm px-5 py-3.5 rounded-2xl gap-2.5',
};

export default function Button3D({
  id,
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  active = false,
  disabled = false,
  isDark = false,
  className = '',
  icon,
  iconRight,
  tooltip,
}: Button3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  const styles = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  const computedClass = `font-bold inline-flex items-center justify-center border transition-colors relative overflow-hidden cursor-pointer select-none ${
    styles.base
  } ${sizeStyle} ${
    active ? styles.active : styles.hover
  } ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  } ${className}`;

  return (
    <motion.button
      id={id}
      onClick={disabled ? undefined : onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      className={computedClass}
      style={{ perspective: 500, transformStyle: 'preserve-3d' }}
      whileHover={
        disabled
          ? undefined
          : {
              rotateX: 5,
              rotateY: -3,
              scale: 1.04,
              z: 10,
            }
      }
      whileTap={
        disabled
          ? undefined
          : {
              scale: 0.94,
              rotateX: 0,
              rotateY: 0,
            }
      }
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 25,
      }}
      title={tooltip}
    >
      {/* Glow overlay on hover */}
      {isHovered && !disabled && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background:
              'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%)',
          }}
        />
      )}

      {icon && <span className="shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </motion.button>
  );
}
