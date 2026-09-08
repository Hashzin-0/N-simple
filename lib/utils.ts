import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const neonFocusClasses = cn(
  'focus:outline-none focus:ring-0',
  'focus:border-[#9CB386]/50 dark:focus:border-[#9CB386]',
  'transition-all duration-200',
);

export const neonBorderLayers = [
  'neon-glow-layer',
  'neon-border-layer',
  'neon-dark-border',
  'neon-white-layer',
  'neon-inner-layer',
];
