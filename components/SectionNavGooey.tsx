'use client';

import React, { useMemo, useCallback } from 'react';
import { useTheme } from './ThemeProvider';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { useIsMobile } from '@/hooks/use-mobile';
import { MultiButton, type MultiButtonItem } from './godui/multi-button';
import {
  FolderGit2,
  Sliders,
  Sparkles,
  Layers,
  Scale,
  Calculator,
  LayoutDashboard,
  AlertTriangle,
  Eye,
  Trophy,
  Landmark,
  FileText,
  BookOpen,
  ScanSearch,
} from 'lucide-react';

interface SectionConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  colorDark: string;
}

const NITROGEN_SECTIONS: SectionConfig[] = [
  { id: 'preset_selector', label: 'Cenários', shortLabel: 'Cenários', icon: FolderGit2, color: '#5A5A40', colorDark: '#9CB386' },
  { id: 'form_section', label: 'Parâmetros', shortLabel: 'Parâmetros', icon: Sliders, color: '#5A5A40', colorDark: '#9CB386' },
  { id: 'results_section', label: 'Resultados', shortLabel: 'Resultados', icon: Sparkles, color: '#2E6F40', colorDark: '#86efac' },
  { id: 'parceling_section', label: 'Parcelamento', shortLabel: 'Parcelamento', icon: Layers, color: '#D4A373', colorDark: '#D4A373' },
  { id: 'balanco_section', label: 'Balanço', shortLabel: 'Balanço', icon: Scale, color: '#2E6F40', colorDark: '#86efac' },
  { id: 'detailed_math_panel', label: 'Fórmulas', shortLabel: 'Fórmulas', icon: Calculator, color: '#8D6E63', colorDark: '#CBB5A1' },
];

const CORN_SECTIONS: SectionConfig[] = [
  { id: 'corn_yield_header', label: 'Visão Geral', shortLabel: 'Visão', icon: LayoutDashboard, color: '#C19262', colorDark: '#D4A373' },
  { id: 'corn_yield_params', label: 'Parâmetros', shortLabel: 'Parâmetros', icon: Sliders, color: '#5A5A40', colorDark: '#9CB386' },
  { id: 'corn_yield_alerts', label: 'Alertas', shortLabel: 'Alertas', icon: AlertTriangle, color: '#D4A373', colorDark: '#E0A96D' },
  { id: 'corn_yield_visual', label: 'Visual 3D', shortLabel: 'Visual', icon: Eye, color: '#C19262', colorDark: '#D4A373' },
  { id: 'corn_yield_results', label: 'Resultados', shortLabel: 'Resultados', icon: Trophy, color: '#2E6F40', colorDark: '#86efac' },
];

const ITR_SECTIONS: SectionConfig[] = [
  { id: 'itr_section', label: 'Cálculo ITR', shortLabel: 'ITR', icon: Landmark, color: '#5A5A40', colorDark: '#9CB386' },
  { id: 'itr_params_section', label: 'Parâmetros VTN', shortLabel: 'Parâmetros', icon: Sliders, color: '#5A5A40', colorDark: '#9CB386' },
  { id: 'itr_results_section', label: 'Demonstrativo', shortLabel: 'Demonstrativo', icon: FileText, color: '#2E6F40', colorDark: '#86efac' },
];

const ABNT_SECTIONS: SectionConfig[] = [
  { id: 'abnt_section', label: 'Referências ABNT', shortLabel: 'ABNT', icon: BookOpen, color: '#5A5A40', colorDark: '#9CB386' },
  { id: 'bibliography_autodetect', label: 'Detector Fontes', shortLabel: 'Detector', icon: ScanSearch, color: '#2E6F40', colorDark: '#86efac' },
];

interface SectionNavGooeyProps {
  activeTab: string;
  activeSectionIds?: string[];
  onNavigate?: (sectionId: string) => void;
}

export default React.memo(function SectionNavGooey({ activeTab, activeSectionIds, onNavigate }: SectionNavGooeyProps) {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();

  const sections = useMemo(() => {
    switch (activeTab) {
      case 'nitrogen': return NITROGEN_SECTIONS;
      case 'productivity': return CORN_SECTIONS;
      case 'itr': return ITR_SECTIONS;
      case 'abnt': return ABNT_SECTIONS;
      default: return NITROGEN_SECTIONS;
    }
  }, [activeTab]);

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);

  const currentSection = useScrollSpy({
    sectionIds,
  });

  const selectedSectionId = useMemo(() => {
    if (activeSectionIds && activeSectionIds.length > 0) {
      return activeSectionIds[0];
    }
    return currentSection ?? sectionIds[0];
  }, [activeSectionIds, currentSection, sectionIds]);

  const handleClick = useCallback(
    (sectionId: string) => {
      const el = document.getElementById(sectionId);
      if (el) {
        const headerOffset = 80;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
        onNavigate?.(sectionId);
      }
    },
    [onNavigate],
  );

  const items: MultiButtonItem[] = useMemo(
    () =>
      sections.map((config) => {
        const Icon = config.icon;
        const isSelected = selectedSectionId === config.id;
        const colorHex = isDark ? config.colorDark : config.color;

        return {
          id: config.id,
          icon: ({ className }: { className?: string }) => (
            <Icon
              className={`${className ?? 'size-4'} transition-transform duration-200 ${
                isSelected ? 'scale-110' : 'opacity-70'
              }`}
              style={{ color: isSelected ? colorHex : undefined }}
            />
          ),
          label: isMobile ? config.shortLabel : config.label,
          ariaLabel: config.label,
          onClick: () => handleClick(config.id),
        };
      }),
    [sections, isDark, isMobile, selectedSectionId, handleClick],
  );

  const accentColor = isDark ? '#9CB386' : '#2E6F40';

  return (
    <div
      className={`relative ${isMobile ? 'w-full flex justify-center py-1' : 'h-full flex flex-col justify-start py-2'}`}
      role="navigation"
      aria-label="Navegação de seções"
    >
      {/* 
        INSET GOOEY CARD CONTAINER:
        - Preserves the exact fluid capsule / pill contour ("mantendo o formato gooey do card, o formato atual")
        - Inset well recessed into #app_header surface (darker cavity tone + subtle inner shadow)
        - Crisp edge highlight and borders reinforcing visual depth
      */}
      <div className={`relative z-10 flex ${isMobile ? 'justify-center max-w-full overflow-x-auto scrollbar-none px-1 py-1' : 'w-full py-1'}`}>
        <MultiButton
          gooey
          variant="secondary"
          size="md"
          items={items}
          selectedId={selectedSectionId}
          highlightColor={accentColor}
          enable3d
          inset
          isDark={isDark}
          edgeColor={accentColor}
          cardFill={isDark ? '#151813' : '#F9F8F6'}
          className={
            isMobile
              ? 'justify-center !gap-0 overflow-visible'
              : 'flex-col w-full items-stretch justify-start space-y-1'
          }
        />
      </div>
    </div>
  );
});

