'use client';

import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import { useTheme } from './ThemeProvider';
import { Sprout, TrendingUp, Landmark, BookOpen, Compass, Hand, PenTool, GraduationCap, Tractor, FileText, CloudSun, BarChart3 } from 'lucide-react';

export type TabId = 'nitrogen' | 'productivity' | 'soja' | 'itr' | 'abnt' | 'pesquisador' | 'libras' | 'redacao' | 'tutor' | 'tratorista' | 'professor' | 'ibge' | 'weather';

interface GooeyTabPanelProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  showToolTabs?: boolean;
  nitrogenContent: React.ReactNode;
  productivityContent: React.ReactNode;
  sojaContent?: React.ReactNode;
  itrContent?: React.ReactNode;
  abntContent?: React.ReactNode;
  pesquisadorContent?: React.ReactNode;
  librasContent?: React.ReactNode;
  redacaoContent?: React.ReactNode;
  tutorContent?: React.ReactNode;
  tratoristaContent?: React.ReactNode;
  professorContent?: React.ReactNode;
  ibgeContent?: React.ReactNode;
  weatherContent?: React.ReactNode;
}

interface TabItem {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const ALL_TABS: TabItem[] = [
  {
    id: 'nitrogen',
    label: 'Adubação Nitrogenada',
    shortLabel: 'Adubação N',
    icon: Sprout,
    badge: 'Solo & Doses',
  },
  {
    id: 'productivity',
    label: 'Estimativa de Produtividade',
    shortLabel: 'Produtividade',
    icon: TrendingUp,
    badge: '9 Culturas',
  },
  {
    id: 'soja',
    label: 'Estimativa de Soja',
    shortLabel: 'Soja',
    icon: Sprout,
    badge: 'Soja',
  },
  {
    id: 'itr',
    label: 'Cálculo de ITR',
    shortLabel: 'ITR',
    icon: Landmark,
    badge: 'Imposto Rural',
  },
  {
    id: 'abnt',
    label: 'Normas & Referências ABNT',
    shortLabel: 'ABNT',
    icon: BookOpen,
    badge: 'NBR 6023',
  },
  {
    id: 'pesquisador',
    label: 'Pesquisador Agro',
    shortLabel: 'Pesquisador',
    icon: Compass,
    badge: 'Fontes & Artigos',
  },
  {
    id: 'libras',
    label: 'Libras no Agro',
    shortLabel: 'Libras',
    icon: Hand,
    badge: 'Libras',
  },
  {
    id: 'redacao',
    label: 'Pesquisador de Redação',
    shortLabel: 'Redação',
    icon: PenTool,
    badge: 'Redação',
  },
  {
    id: 'tutor',
    label: 'Tutor Inteligente',
    shortLabel: 'Tutor',
    icon: GraduationCap,
    badge: 'Revisão Oral',
  },
  {
    id: 'tratorista',
    label: 'Mecanização Agrícola',
    shortLabel: 'Tratores',
    icon: Tractor,
    badge: 'Curso & Tração',
  },
  {
    id: 'professor',
    label: 'Professor de Documentos',
    shortLabel: 'Professor',
    icon: FileText,
    badge: 'Word & PowerPoint',
  },
  { id: 'ibge', label: 'Dados Agropecuários IBGE', shortLabel: 'IBGE', icon: BarChart3, badge: 'PAM & PPM' },
  { id: 'weather', label: 'Meteorologia Agrícola', shortLabel: 'Meteorologia', icon: CloudSun, badge: 'Previsão' },
];

const TAB_INDEX: Record<TabId, number> = {
  nitrogen: 0,
  productivity: 1,
  soja: 2,
  itr: 3,
  abnt: 4,
  pesquisador: 5,
  libras: 6,
  redacao: 7,
  tutor: 8,
  tratorista: 9,
  professor: 10,
  ibge: 11,
  weather: 12,
};

const TAB_ORDER: TabId[] = ['nitrogen', 'productivity', 'soja', 'itr', 'abnt', 'pesquisador', 'libras', 'redacao', 'tutor', 'tratorista', 'professor', 'ibge', 'weather'];

export default function GooeyTabPanel({
  activeTab,
  onTabChange,
  showToolTabs = true,
  nitrogenContent,
  productivityContent,
  sojaContent,
  itrContent,
  abntContent,
  pesquisadorContent,
  librasContent,
  redacaoContent,
  tutorContent,
  tratoristaContent,
  professorContent,
  ibgeContent,
  weatherContent,
}: GooeyTabPanelProps) {
  const { isDark } = useTheme();
  const rawId = useId();
  const activeTabIdx = TAB_INDEX[activeTab] ?? 0;

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tablistScrollRef = useRef<HTMLDivElement>(null);
  const tabpanelScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartScrollLeft = useRef(0);
  const lastSwapTime = useRef(0);

  const changeTab = useCallback(
    (nextTab: TabId) => {
      if (nextTab === activeTab) return;
      onTabChange(nextTab);
    },
    [activeTab, onTabChange],
  );

  const goToNextTab = useCallback(() => {
    const currentIndex = TAB_INDEX[activeTab] ?? 0;
    if (currentIndex < TAB_ORDER.length - 1) {
      changeTab(TAB_ORDER[currentIndex + 1]);
    }
  }, [activeTab, changeTab]);

  const goToPrevTab = useCallback(() => {
    const currentIndex = TAB_INDEX[activeTab] ?? 0;
    if (currentIndex > 0) {
      changeTab(TAB_ORDER[currentIndex - 1]);
    }
  }, [activeTab, changeTab]);

  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const delta = absX >= absY ? e.deltaX : (e.shiftKey ? e.deltaY : 0);

      if (Math.abs(delta) > 10) {
        const tablist = tablistScrollRef.current;
        const tabpanel = tabpanelScrollRef.current;
        const target = e.target as Node;

        const canNativeScroll = (el: HTMLElement | null) =>
          !!el &&
          el.contains(target) &&
          el.scrollWidth - el.clientWidth > 4;

        if (absX >= absY && (canNativeScroll(tablist) || canNativeScroll(tabpanel))) {
          return;
        }

        e.preventDefault();
        const now = performance.now();
        if (now - lastSwapTime.current > 260) {
          lastSwapTime.current = now;
          if (delta > 0) {
            goToNextTab();
          } else {
            goToPrevTab();
          }
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [goToNextTab, goToPrevTab]);

  useEffect(() => {
    const tablist = tablistScrollRef.current;
    if (!tablist) return;
    const activeBtn = tablist.querySelector<HTMLElement>(`#tab-btn-${activeTab}`);
    activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartScrollLeft.current = tablistScrollRef.current?.scrollLeft ?? 0;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const tablist = tablistScrollRef.current;
    const scrolledBar =
      !!tablist && Math.abs(tablist.scrollLeft - touchStartScrollLeft.current) > 4;
    if (scrolledBar) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 25 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      const now = performance.now();
      if (now - lastSwapTime.current > 260) {
        lastSwapTime.current = now;
        if (deltaX < 0) {
          goToNextTab();
        } else {
          goToPrevTab();
        }
      }
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showToolTabs) return;
      const currentIndex = TAB_INDEX[activeTab] ?? 0;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (currentIndex + 1) % TAB_ORDER.length;
        changeTab(TAB_ORDER[next]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
        changeTab(TAB_ORDER[prev]);
      }
    },
    [activeTab, changeTab, showToolTabs],
  );

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'nitrogen':
        return nitrogenContent;
      case 'productivity':
        return productivityContent;
      case 'soja':
        return sojaContent || productivityContent;
      case 'itr':
        return itrContent || null;
      case 'abnt':
        return abntContent || null;
      case 'pesquisador':
        return pesquisadorContent || null;
      case 'libras':
        return librasContent || null;
      case 'redacao':
        return redacaoContent || null;
      case 'tutor':
        return tutorContent || null;
      case 'tratorista':
        return tratoristaContent || null;
      case 'professor':
        return professorContent || null;
      case 'ibge':
        return ibgeContent || null;
      case 'weather':
        return weatherContent || null;
      default:
        return nitrogenContent;
    }
  };

  return (
    <div
      className="relative w-full focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {showToolTabs && (
        <div
          ref={tabsContainerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full select-none pt-2"
        >
          <div
            ref={tablistScrollRef}
            role="tablist"
            aria-label="Ferramentas do N-simple"
            className="relative flex items-end gap-0 px-0 w-full h-[52px] overflow-x-auto no-scrollbar"
          >
            {ALL_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
  
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => changeTab(tab.id)}
                  className={`relative z-20 min-w-[92px] sm:min-w-[104px] flex-1 h-[48px] flex items-center justify-center gap-1.5 sm:gap-2 px-2 transition-all duration-200 focus:outline-none cursor-pointer ${
                    isActive
                      ? 'text-[#242A20] dark:text-[#F3F1EC] font-semibold'
                      : 'text-[#8C897E] dark:text-[#9EA399] hover:text-[#3D3D3D] dark:hover:text-[#E8E6DF] font-medium'
                  }`}
                >
                  <Icon
                    className={`size-4 sm:size-[18px] transition-transform duration-200 ${
                      isActive ? 'scale-110 text-[#2E6F40] dark:text-[#9CB386]' : 'opacity-75'
                    }`}
                  />
                  <span className="text-xs sm:text-sm tracking-tight truncate">
                    {tab.shortLabel}
                  </span>
  
                  {tab.badge && (
                    <span
                      className={`hidden xl:inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                        isActive
                          ? 'bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]'
                          : 'bg-black/5 dark:bg-white/5 text-[#8C897E] dark:text-[#9EA399]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
  
  
      )}

      {/* TAB CONTENT */}
      <div
        ref={tabpanelScrollRef}
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={showToolTabs ? `tab-btn-${activeTab}` : undefined}
        aria-label={!showToolTabs ? 'Conteúdo da ferramenta' : undefined}
        className="relative z-0 w-full overflow-x-auto no-scrollbar"
      >
        <div key={activeTab} className="w-full min-w-0 py-2">
          {renderActiveContent()}
        </div>
      </div>
    </div>
  );
}
