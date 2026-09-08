'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import { ReferenceType } from '@/lib/abnt/types';
import { REFERENCE_TYPES } from '@/lib/abnt/constants';
import {
  BookOpen, BookMarked, Laptop, FileText, Newspaper, Globe,
  GraduationCap, CalendarDays, FileCheck, Scale, Shield, Film, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="h-5 w-5" />,
  BookMarked: <BookMarked className="h-5 w-5" />,
  Laptop: <Laptop className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Newspaper: <Newspaper className="h-5 w-5" />,
  Globe: <Globe className="h-5 w-5" />,
  GraduationCap: <GraduationCap className="h-5 w-5" />,
  CalendarDays: <CalendarDays className="h-5 w-5" />,
  FileCheck: <FileCheck className="h-5 w-5" />,
  Scale: <Scale className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  Film: <Film className="h-5 w-5" />,
  Brain: <Brain className="h-5 w-5" />,
};

interface ReferenceTypeSelectorProps {
  onSelect: (type: ReferenceType) => void;
  isConnected?: boolean;
}

export default function ReferenceTypeSelector({ onSelect, isConnected }: ReferenceTypeSelectorProps) {
  const { isDark } = useTheme();

  return (
    <div className={cn(
      `${isConnected ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'} border p-5 transition-colors`,
      isDark ? 'bg-[#1A1E18] border-[#2C3328]' : 'bg-[#FDFBF7] border-[#E5E2D9]'
    )}>
      <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E8E6DF] uppercase tracking-wider mb-4">
        Tipo de Documento
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {REFERENCE_TYPES.map((config) => (
          <motion.button
            key={config.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(config.id)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all',
              'hover:border-[#5A5A40] dark:hover:border-[#9CB386]',
              'hover:shadow-md',
              isDark
                ? 'bg-[#242720] border-[#393E32] text-[#E8E6DF]'
                : 'bg-white border-[#E5E2D9] text-[#5A5A40]'
            )}
          >
            <div className={cn(
              'p-2 rounded-lg',
              isDark ? 'bg-[#9CB386]/10 text-[#9CB386]' : 'bg-[#5A5A40]/10 text-[#5A5A40]'
            )}>
              {ICONS[config.icon]}
            </div>
            <span className="text-xs font-bold leading-tight">{config.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
