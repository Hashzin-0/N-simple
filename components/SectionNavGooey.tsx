'use client';

import React, { useMemo, useCallback } from 'react';
import { useTheme } from './ThemeProvider';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { useIsMobile } from '@/hooks/use-mobile';
import { MultiButton, type MultiButtonItem } from './godui/multi-button';
import { SECTIONS_BY_TAB } from '@/lib/sectionNav';
import type { TabId } from '@/components/GooeyTabPanel';

interface SectionNavGooeyProps {
  activeTab: string;
  activeSectionIds?: string[];
  onNavigate?: (sectionId: string) => void;
}

export default React.memo(function SectionNavGooey({ activeTab, activeSectionIds, onNavigate }: SectionNavGooeyProps) {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();

  const sections = useMemo(
    () => SECTIONS_BY_TAB[activeTab as TabId] ?? SECTIONS_BY_TAB.nitrogen,
    [activeTab]
  );

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
      <div className={`relative z-10 flex ${isMobile ? 'justify-center max-w-full overflow-x-auto no-scrollbar px-1 py-1' : 'w-full py-1'}`}>
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
          style={isMobile ? undefined : { height: 'auto' }}
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
