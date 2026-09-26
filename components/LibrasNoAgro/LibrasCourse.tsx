'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { ChevronRight, CheckCircle, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LibrasModuleView from './LibrasModuleView';
import LibrasQuiz from './LibrasQuiz';
import { MODULO_VOCABULARIO, MODULO_FRASES, AREAS } from '@/lib/libras-course-data';
import type { LibrasModule } from '@/lib/libras-types';
import type { useLibrasProgress } from '@/hooks/useLibrasProgress';

interface LibrasCourseProps {
  progress: ReturnType<typeof useLibrasProgress>;
  /** Pedido externo (voz) para iniciar o quiz de um módulo; seq monotônico evita re-execução. */
  pendingQuiz?: { seq: number; moduleId?: string } | null;
}

type ViewMode = 'modules' | 'module' | 'quiz';

export default React.memo(function LibrasCourse({ progress, pendingQuiz }: LibrasCourseProps) {
  const { isDark } = useTheme();
  const [view, setView] = useState<ViewMode>('modules');
  const [activeModule, setActiveModule] = useState<LibrasModule | null>(null);

  const handleOpenModule = useCallback((module: LibrasModule) => {
    setActiveModule(module);
    setView('module');
  }, []);

  const handleStartQuiz = useCallback((moduleId: string) => {
    const allModules = [MODULO_VOCABULARIO, MODULO_FRASES, ...AREAS.flatMap((a) => a.modules)];
    const mod = allModules.find((m) => m.id === moduleId);
    if (mod) {
      setActiveModule(mod);
      setView('quiz');
    }
  }, []);

  // Pedido externo (voz): inicia o quiz do módulo pedido. O setState sai do
  // corpo do efeito (microtask) para não causar re-render em cascata.
  const lastPendingQuizSeqRef = useRef(0);
  useEffect(() => {
    if (!pendingQuiz || pendingQuiz.seq === lastPendingQuizSeqRef.current) return;
    lastPendingQuizSeqRef.current = pendingQuiz.seq;
    const moduleId = pendingQuiz.moduleId;
    if (!moduleId) return;
    setTimeout(() => handleStartQuiz(moduleId), 0);
  }, [pendingQuiz, handleStartQuiz]);

  const handleBackToModules = useCallback(() => {
    setView('modules');
    setActiveModule(null);
  }, []);

  const handleQuizDone = useCallback(() => {
    setView('modules');
    setActiveModule(null);
  }, []);

  // Module list view
  if (view === 'modules') {
    return (
      <div className="space-y-6">
        {/* Módulo 1 */}
        <div>
          <h3
            className={`text-sm font-bold uppercase tracking-wider mb-3 ${
              isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
            }`}
          >
            Módulos Básicos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[MODULO_VOCABULARIO, MODULO_FRASES].map((mod) => {
              const prog = progress.getModuleProgress(mod.id);
              return (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  progress={prog}
                  isDark={isDark}
                  onOpen={handleOpenModule}
                />
              );
            })}
          </div>
        </div>

        {/* Áreas */}
        {AREAS.map((area) => (
          <div key={area.id}>
            <h3
              className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
                isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
              }`}
            >
              <span>{area.emoji}</span> {area.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {area.modules.map((mod) => {
                const prog = progress.getModuleProgress(mod.id);
                return (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    progress={prog}
                    isDark={isDark}
                    onOpen={handleOpenModule}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Module detail view
  if (view === 'module' && activeModule) {
    return (
      <LibrasModuleView
        module={activeModule}
        progress={progress}
        onBack={handleBackToModules}
        onStartQuiz={handleStartQuiz}
      />
    );
  }

  // Quiz view
  if (view === 'quiz' && activeModule) {
    return (
      <LibrasQuiz
        module={activeModule}
        progress={progress}
        onDone={handleQuizDone}
      />
    );
  }

  return null;
});

// --- Module Card Sub-component ---
function ModuleCard({
  module,
  progress: prog,
  isDark,
  onOpen,
}: {
  module: LibrasModule;
  progress: { learnedWords: number; totalWords: number; completed: boolean };
  isDark: boolean;
  onOpen: (m: LibrasModule) => void;
}) {
  const percent =
    prog.totalWords > 0 ? Math.round((prog.learnedWords / prog.totalWords) * 100) : 0;

  return (
    <button
      onClick={() => onOpen(module)}
      className={`relative p-4 rounded-2xl border text-left transition-all group ${
        isDark
          ? 'bg-[#1C201A] border-[#2C3328] hover:border-[#393E32]'
          : 'bg-white border-[#E5E2D9] hover:border-[#D0CCC0]'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{module.emoji}</span>
          <div>
            <h4
              className={`text-sm font-bold ${
                isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
              }`}
            >
              {module.title}
            </h4>
            <p
              className={`text-xs mt-0.5 ${
                isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
              }`}
            >
              {module.description}
            </p>
          </div>
        </div>
        {prog.completed ? (
          <CheckCircle className="size-5 text-[#2E6F40] dark:text-[#86efac] flex-shrink-0" />
        ) : (
          <ChevronRight
            className={`size-5 transition-transform group-hover:translate-x-0.5 flex-shrink-0 ${
              isDark ? 'text-[#5A5A40]' : 'text-[#D0CCC0]'
            }`}
          />
        )}
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-[10px] ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}
          >
            {prog.learnedWords}/{prog.totalWords} palavras
          </span>
          <span
            className={`text-[10px] font-bold ${
              prog.completed
                ? isDark
                  ? 'text-[#86efac]'
                  : 'text-[#2E6F40]'
                : isDark
                ? 'text-[#D4A373]'
                : 'text-[#8D6E63]'
            }`}
          >
            {percent}%
          </span>
        </div>
        <div
          className={`h-1.5 rounded-full overflow-hidden ${
            isDark ? 'bg-[#242720]' : 'bg-[#E5E2D9]'
          }`}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#2E6F40] to-[#86efac] dark:from-[#9CB386] dark:to-[#86efac]"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Word count badges */}
      {module.words.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {module.words.slice(0, 5).map((w) => (
            <span
              key={w.id}
              className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                isDark ? 'bg-[#2C3328] text-[#9EA399]' : 'bg-[#F0EDE5] text-[#8C897E]'
              }`}
            >
              {w.emoji} {w.word}
            </span>
          ))}
          {module.words.length > 5 && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                isDark ? 'bg-[#2C3328] text-[#9EA399]' : 'bg-[#F0EDE5] text-[#8C897E]'
              }`}
            >
              +{module.words.length - 5}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
