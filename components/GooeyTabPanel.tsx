'use client';

import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { useTheme } from './ThemeProvider';
import { Sprout, TrendingUp, Landmark, BookOpen } from 'lucide-react';

export type TabId = 'nitrogen' | 'productivity' | 'itr' | 'abnt';

interface GooeyTabPanelProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  nitrogenContent: React.ReactNode;
  productivityContent: React.ReactNode;
  itrContent?: React.ReactNode;
  abntContent?: React.ReactNode;
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
];

const TAB_INDEX: Record<TabId, number> = {
  nitrogen: 0,
  productivity: 1,
  itr: 2,
  abnt: 3,
};

const TAB_ORDER: TabId[] = ['nitrogen', 'productivity', 'itr', 'abnt'];

/* ============================================================
   TRANSIÇÃO FÍSICA 3D ENTRE PÁGINAS:
   - Perspectiva 3D
   - Pequena rotação no eixo Y
   - Sombra da página que projeta no fundo
   - Borda lateral e sensação de espessura de papel/placa
   - Aceleração no começo e desaceleração suave no final
   - Página nova ficando ATRÁS da antiga (z-index 10 vs 30)
   - Página antiga saindo ligeiramente inclinada (rotateZ + rotateX)
============================================================ */

const CUBIC_EASE = [0.35, 0.0, 0.1, 1.0] as const;

const physicalPageVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '50%' : '-50%',
    scale: 0.92,
    rotateY: direction > 0 ? 10 : -10,
    rotateZ: 0,
    rotateX: 0,
    opacity: 0.65,
    zIndex: 10, // FICA ATRÁS DA ANTIGA
    filter: 'brightness(0.92)',
  }),
  center: {
    x: '0%',
    scale: 1,
    rotateY: 0,
    rotateZ: 0,
    rotateX: 0,
    opacity: 1,
    zIndex: 20,
    filter: 'brightness(1)',
    transition: {
      x: { duration: 0.55, ease: CUBIC_EASE },
      scale: { duration: 0.55, ease: CUBIC_EASE },
      rotateY: { duration: 0.55, ease: CUBIC_EASE },
      opacity: { duration: 0.35, ease: 'easeOut' },
      filter: { duration: 0.35, ease: 'easeOut' },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-110%' : '110%',
    scale: 0.98,
    rotateY: direction > 0 ? -14 : 14, // Rotação no eixo Y
    rotateZ: direction > 0 ? -3 : 3, // Saindo ligeiramente inclinada
    rotateX: 2.5,
    opacity: 0,
    zIndex: 30, // FICA NA FRENTE ENQUANTO SAI
    transition: {
      x: { duration: 0.55, ease: CUBIC_EASE },
      rotateY: { duration: 0.55, ease: CUBIC_EASE },
      rotateZ: { duration: 0.55, ease: CUBIC_EASE },
      rotateX: { duration: 0.55, ease: CUBIC_EASE },
      opacity: { duration: 0.4, ease: CUBIC_EASE },
    },
  }),
};

export default function GooeyTabPanel({
  activeTab,
  onTabChange,
  nitrogenContent,
  productivityContent,
  itrContent,
  abntContent,
}: GooeyTabPanelProps) {
  const [direction, setDirection] = useState(1);
  const { isDark } = useTheme();
  const rawId = useId();
  const gooeyFilterId = `unlumen-gooey-${rawId.replace(/:/g, '')}`;
  const activeTabIdx = TAB_INDEX[activeTab] ?? 0;

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastSwapTime = useRef(0);

  const changeTab = useCallback(
    (nextTab: TabId) => {
      if (nextTab === activeTab) return;
      const currentIndex = TAB_INDEX[activeTab] ?? 0;
      const nextIndex = TAB_INDEX[nextTab] ?? 0;
      setDirection(nextIndex > currentIndex ? 1 : -1);
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

  /* ============================================================
     SWAP ATIVADO POR SCROLL HORIZONTAL NAS TABS (TRACKPAD / RODA)
  ============================================================ */
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Captura scroll horizontal de trackpad, Shift+wheel ou scroll sobre as tabs
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
    // Gesto horizontal nítido
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
      {/* SVG GOOEY METABALL FILTER DEFINITION */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter
            id={gooeyFilterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      {/* 
        TABS BAR WITH SEAMLESS UNLUMEN GOOEY CONNECTION:
        - Active tab rises directly from the card top surface with matching border
        - When first tab: no left inverse fillet, smooth continuous left border with content card
        - When last tab: no right inverse fillet, smooth continuous right border with content card
        - Middle tabs: smooth concave fillets on both sides with border strokes
      */}
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
          {/* 
            GOOEY LIQUID SURFACE & ACTIVE TAB EAR:
            Fused active tab ear connected directly to the card below with matching border
          */}
          <div
            className="absolute inset-0 pointer-events-none overflow-visible flex items-end px-0"
            style={{ filter: `url(#${gooeyFilterId})` }}
          >
            {ALL_4_TABS.map((tab, idx) => {
              const isActive = activeTab === tab.id;
              const isFirst = idx === 0;
              const isLast = idx === ALL_4_TABS.length - 1;

              return (
                <div
                  key={`gooey-tab-bg-${tab.id}`}
                  className="relative flex-1 h-[48px] flex items-end justify-center"
                >
                  {isActive && (
                    <motion.div
                      layoutId="unlumen-gooey-active-ear"
                      className={`w-full h-full bg-white dark:bg-[#1C201A] border-t border-l border-r border-[#E5E2D9] dark:border-[#2C3328] translate-y-[1px] ${
                        isFirst
                          ? 'rounded-tl-2xl rounded-tr-xl'
                          : isLast
                          ? 'rounded-tl-xl rounded-tr-2xl'
                          : 'rounded-t-xl'
                      }`}
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 34,
                        mass: 0.8,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 
            CONCAVE CORNER FILLETS (CONVEX TAB TO FLAT CARD TRANSITION):
            Creates the continuous organic shoulder matching the card's border
          */}
          <div className="absolute inset-0 pointer-events-none flex items-end px-0 z-10 overflow-visible">
            {ALL_4_TABS.map((tab, idx) => {
              const isActive = activeTab === tab.id;
              if (!isActive) return <div key={`fillet-spacer-${tab.id}`} className="flex-1" />;

              const isFirst = idx === 0;
              const isLast = idx === ALL_4_TABS.length - 1;

              return (
                <div
                  key={`fillet-${tab.id}`}
                  className="relative flex-1 h-[48px] flex items-end justify-between overflow-visible"
                >
                  {/* Left Concave Fillet — omitted on first tab for seamless flat left edge */}
                  {!isFirst && (
                    <div className="absolute -left-[14px] bottom-0 w-[14px] h-[14px] overflow-visible pointer-events-none">
                      <svg viewBox="0 0 14 14" className="w-full h-full overflow-visible">
                        <path
                          d="M14,0 C14,7.73 7.73,14 0,14 L14,14 Z"
                          className="fill-white dark:fill-[#1C201A]"
                        />
                        <path
                          d="M0,14 C7.73,14 14,7.73 14,0"
                          fill="none"
                          className="stroke-[#E5E2D9] dark:stroke-[#2C3328]"
                          strokeWidth="1"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Right Concave Fillet — omitted on last tab for seamless flat right edge */}
                  {!isLast && (
                    <div className="absolute -right-[14px] bottom-0 w-[14px] h-[14px] overflow-visible pointer-events-none">
                      <svg viewBox="0 0 14 14" className="w-full h-full overflow-visible">
                        <path
                          d="M0,0 C0,7.73 6.27,14 14,14 L0,14 Z"
                          className="fill-white dark:fill-[#1C201A]"
                        />
                        <path
                          d="M0,0 C0,7.73 6.27,14 14,14"
                          fill="none"
                          className="stroke-[#E5E2D9] dark:stroke-[#2C3328]"
                          strokeWidth="1"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 
            CRISP INTERACTIVE TAB BUTTONS (Z-INDEX 20, NO BLUR)
          */}
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

      {/* 
        PHYSICAL 3D CARD CONTENT:
        - Merged directly with active tab ear (seamless integration)
        - When first tab: rounded-tl-none so tab and card left border are one single line
        - When last tab: rounded-tr-none so tab and card right border are one single line
        - 3D physical page transition with perspective, Y-rotation, and depth layering
      */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-btn-${activeTab}`}
        className="relative z-0 w-full [perspective:1600px] overflow-visible"
      >
        <AnimatePresence
          initial={false}
          custom={direction}
          mode="popLayout"
        >
          <motion.div
            key={activeTab}
            custom={direction}
            variants={physicalPageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: direction > 0 ? 'top left' : 'top right',
            }}
            className={`w-full relative bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#2C3328] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.12),0_4px_16px_-2px_rgba(0,0,0,0.04)] border-r-[4px] border-b-[4px] border-r-[#D0CCC0] dark:border-r-[#242A20] border-b-[#D0CCC0] dark:border-b-[#242A20] ${
              activeTabIdx === 0
                ? 'rounded-b-3xl rounded-tr-3xl rounded-tl-none'
                : activeTabIdx === ALL_4_TABS.length - 1
                ? 'rounded-b-3xl rounded-tl-3xl rounded-tr-none'
                : 'rounded-3xl'
            }`}
          >
            {/* Lateral light edge — creates physical slab thickness feeling */}
            <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-white/70 via-transparent to-black/15 dark:from-white/10 dark:to-black/35 pointer-events-none rounded-br-3xl" />
            
            {/* Top surface light highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent pointer-events-none" />

            {/* Panel content */}
            <div className="w-full">
              {renderActiveContent()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
