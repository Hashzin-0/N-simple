'use client';

import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import { useTheme } from './ThemeProvider';
import { Sprout, TrendingUp, Landmark, BookOpen, Compass } from 'lucide-react';

export type TabId = 'nitrogen' | 'productivity' | 'itr' | 'abnt' | 'pesquisador';

interface GooeyTabPanelProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  nitrogenContent: React.ReactNode;
  productivityContent: React.ReactNode;
  itrContent?: React.ReactNode;
  abntContent?: React.ReactNode;
  pesquisadorContent?: React.ReactNode;
}

interface TabItem {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const ALL_4_TABS: TabItem[] = [
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
    badge: '3D Milho',
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
];

const TAB_INDEX: Record<TabId, number> = {
  nitrogen: 0,
  productivity: 1,
  itr: 2,
  abnt: 3,
  pesquisador: 4,
};

const TAB_ORDER: TabId[] = ['nitrogen', 'productivity', 'itr', 'abnt', 'pesquisador'];

export default function GooeyTabPanel({
  activeTab,
  onTabChange,
  nitrogenContent,
  productivityContent,
  itrContent,
  abntContent,
  pesquisadorContent,
}: GooeyTabPanelProps) {
  const { isDark } = useTheme();
  const rawId = useId();
  const activeTabIdx = TAB_INDEX[activeTab] ?? 0;

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
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
    [activeTab, changeTab],
  );

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'nitrogen':
        return nitrogenContent;
      case 'productivity':
        return productivityContent;
      case 'itr':
        return itrContent || null;
      case 'abnt':
        return abntContent || null;
      case 'pesquisador':
        return pesquisadorContent || null;
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
      {/* TABS BAR */}
      <div
        ref={tabsContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full select-none pt-2"
      >
        <div
          role="tablist"
          aria-label="Calculadoras Agronômicas N-Pro"
          className="relative flex items-end gap-0 px-0 w-full h-[52px]"
        >
          {ALL_4_TABS.map((tab) => {
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
                className={`relative z-20 flex-1 h-[48px] flex items-center justify-center gap-1.5 sm:gap-2 px-2 transition-all duration-200 focus:outline-none cursor-pointer ${
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

      {/* TAB CONTENT */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-btn-${activeTab}`}
        className="relative z-0 w-full overflow-visible"
      >
        <div
          key={activeTab}
          className={`w-full bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#2C3328] shadow-lg border-r-[4px] border-b-[4px] border-r-[#D0CCC0] dark:border-r-[#242A20] border-b-[#D0CCC0] dark:border-b-[#242A20] transition-all duration-300 ease-out ${
            activeTabIdx === 0
              ? 'rounded-b-3xl rounded-tr-3xl rounded-tl-none'
              : activeTabIdx === ALL_4_TABS.length - 1
              ? 'rounded-b-3xl rounded-tl-3xl rounded-tr-none'
              : 'rounded-3xl'
          }`}
        >
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-b from-white/70 via-transparent to-black/15 dark:from-white/10 dark:to-black/35 pointer-events-none rounded-br-3xl"
            style={{ width: 2 }}
          />
          <div
            className="absolute inset-x-0 top-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent pointer-events-none"
            style={{ height: 1 }}
          />

          <div className="w-full">
            {renderActiveContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
