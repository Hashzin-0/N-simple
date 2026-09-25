'use client';

import React, { useState, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Search, BookOpen, Camera, Hand, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import LibrasSearch from './LibrasSearch';
import LibrasCourse from './LibrasCourse';
import LibrasCaptureTest from '@/components/LibrasCaptureTest';
import LibrasPractice from '@/components/LibrasPractice';
import LibrasTutor from '@/components/LibrasTutor';
import { useLibrasProgress } from '@/hooks/useLibrasProgress';
import SaveProgressToggle from '@/components/auth/SaveProgressToggle';

type SubTab = 'search' | 'course' | 'practice' | 'tutor' | 'capture-test';

export type LibrasSubTab = SubTab;

const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'search', label: 'Buscar Sinais', icon: Search },
  { id: 'course', label: 'Mini-Curso', icon: BookOpen },
  { id: 'practice', label: 'Praticar', icon: Hand },
  { id: 'tutor', label: 'Tutor', icon: Sparkles },
  { id: 'capture-test', label: 'Teste Câmera', icon: Camera },
];

interface LibrasNoAgroProps {
  /** Sub-aba controlada pelo page.tsx (voz pode trocar em tempo real). */
  activeSubTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  /** Pedido externo (voz) de busca de sinal; seq monotônico evita re-execução. */
  pendingSearch?: { seq: number; query: string } | null;
}

export default React.memo(function LibrasNoAgro({
  activeSubTab: controlledSubTab,
  onSubTabChange,
  pendingSearch,
}: LibrasNoAgroProps) {
  const { isDark } = useTheme();
  const [internalSubTab, setInternalSubTab] = useState<SubTab>('search');
  const progress = useLibrasProgress();

  const isControlled = onSubTabChange !== undefined;
  const activeSubTab = isControlled ? controlledSubTab ?? 'search' : internalSubTab;

  const handleSubTabChange = useCallback(
    (tab: SubTab) => {
      if (isControlled) onSubTabChange?.(tab);
      else setInternalSubTab(tab);
    },
    [isControlled, onSubTabChange]
  );

  // Pedido externo (voz) com busca: força a sub-aba de busca (o LibrasSearch
  // consome pendingSearch e dispara a consulta).
  const effectivePendingSearch =
    pendingSearch && activeSubTab === 'search' ? pendingSearch : null;

  return (
    <div id="libras_section" className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2
          className={`text-xl sm:text-2xl font-bold ${
            isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
          }`}
        >
          🤟 Libras no Agro
        </h2>
        <p
          className={`text-sm max-w-md mx-auto ${
            isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
          }`}
        >
          Aprenda sinais em Libras relacionados ao agronegócio e à agropecuária
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <SaveProgressToggle id="libras_save_progress_toggle" />
      </div>

      {/* Sub-tabs */}
      <div className="flex justify-center">
        <div
          className={`inline-flex rounded-xl p-1 gap-1 ${
            isDark ? 'bg-[#242720]' : 'bg-[#F0EDE5]'
          }`}
        >
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSubTabChange(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-[#9CB386] text-[#121511]'
                      : 'bg-[#2E6F40] text-white'
                    : isDark
                    ? 'text-[#9EA399] hover:text-[#E8E6DF]'
                    : 'text-[#8C897E] hover:text-[#3D3D3D]'
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div
        id={
          activeSubTab === 'search'
            ? 'libras_search'
            : activeSubTab === 'course'
            ? 'librascurso'
            : activeSubTab === 'practice'
            ? 'libras_practice'
            : activeSubTab === 'tutor'
            ? 'libras_tutor'
            : 'libras_capture_test'
        }
        className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
          isDark
            ? 'bg-[#1C201A] border-[#2C3328]'
            : 'bg-white border-[#E5E2D9]'
        }`}
      >
        {activeSubTab === 'search' && (
          <LibrasSearch maxResults={3} pendingSearch={effectivePendingSearch} />
        )}
        {activeSubTab === 'course' && <LibrasCourse progress={progress} />}
        {activeSubTab === 'practice' && <LibrasPractice />}
        {activeSubTab === 'tutor' && <LibrasTutor />}
        {activeSubTab === 'capture-test' && <LibrasCaptureTest />}
      </div>
    </div>
  );
});
