'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { CheckCircle, Circle, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LibrasSearch from './LibrasSearch';
import LibrasVideoCard from './LibrasVideoCard';
import { stripSentenceEnding } from '@/lib/libras-search-utils';
import type {
  LibrasModule,
  LibrasWord,
  LibrasVideoResult,
  LibrasSignGroup,
} from '@/lib/libras-types';
import type { useLibrasProgress } from '@/hooks/useLibrasProgress';

interface LibrasModuleViewProps {
  module: LibrasModule;
  progress: ReturnType<typeof useLibrasProgress>;
  onBack: () => void;
  onStartQuiz: (moduleId: string) => void;
}

export default React.memo(function LibrasModuleView({
  module,
  progress,
  onBack,
  onStartQuiz,
}: LibrasModuleViewProps) {
  const { isDark } = useTheme();
  const [selectedWord, setSelectedWord] = useState<LibrasWord | null>(null);
  const [wordVideos, setWordVideos] = useState<LibrasVideoResult[]>([]);
  const [signGroups, setSignGroups] = useState<LibrasSignGroup[]>([]);
  const [loadingWord, setLoadingWord] = useState<string | null>(null);

  const moduleProgress = progress.getModuleProgress(module.id);

  const handleWordClick = useCallback(async (word: LibrasWord & { breakdown?: string[] }) => {
    setSelectedWord(word as LibrasWord);
    setWordVideos([]);
    setSignGroups([]);
    setLoadingWord(word.id);

    try {
      const baseQuery =
        stripSentenceEnding(word.searchQueries[0] || `${word.word} em libras`) ||
        `${word.word} em libras`;
      const signs = word.breakdown?.length ? word.breakdown : [];
      const params = new URLSearchParams({ q: baseQuery, limit: '3' });
      if (signs.length > 0) params.set('signs', signs.join(','));

      const res = await fetch(`/api/libras/search?${params.toString()}`);
      const data = await res.json();
      setWordVideos(data.phraseResults || data.results || []);
      setSignGroups(data.signGroups || []);
    } catch {
      setWordVideos([]);
      setSignGroups([]);
    } finally {
      setLoadingWord(null);
    }
  }, []);

  const handleMarkLearned = useCallback(
    (wordId: string) => {
      progress.markLearned(wordId, module.id);
    },
    [progress, module.id]
  );

  interface WordItem {
    id: string;
    word: string;
    emoji: string;
    category: LibrasWord['category'];
    searchQueries: string[];
    breakdown?: string[];
  }

  const wordsToShow = useMemo<WordItem[]>(() => {
    if (module.type === 'phrases' && module.phrases) {
      return module.phrases.map((p) => ({
        id: p.id,
        word: p.phrase,
        emoji: '💬',
        category: module.id as LibrasWord['category'],
        searchQueries: [stripSentenceEnding(p.phrase) + ' em libras'],
        breakdown: p.breakdown,
      }));
    }
    return module.words;
  }, [module]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className={`text-sm font-medium transition-colors ${
            isDark
              ? 'text-[#9CB386] hover:text-[#86efac]'
              : 'text-[#2E6F40] hover:text-[#1a5c2e]'
          }`}
        >
          ← Voltar
        </button>
        <div className="flex-1">
          <h3
            className={`text-lg font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}
          >
            {module.emoji} {module.title}
          </h3>
          <p
            className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}
          >
            {module.description}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className={`p-3 rounded-xl border ${
          isDark
            ? 'bg-[#242720] border-[#393E32]'
            : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-medium ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}
          >
            Progresso do módulo
          </span>
          <span
            className={`text-xs font-bold ${
              moduleProgress.completed
                ? isDark
                  ? 'text-[#86efac]'
                  : 'text-[#2E6F40]'
                : isDark
                ? 'text-[#D4A373]'
                : 'text-[#8D6E63]'
            }`}
          >
            {moduleProgress.learnedWords}/{moduleProgress.totalWords}
          </span>
        </div>
        <div
          className={`h-2 rounded-full overflow-hidden ${
            isDark ? 'bg-[#1C201A]' : 'bg-[#E5E2D9]'
          }`}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#2E6F40] to-[#86efac] dark:from-[#9CB386] dark:to-[#86efac]"
            initial={{ width: 0 }}
            animate={{
              width: `${
                moduleProgress.totalWords > 0
                  ? (moduleProgress.learnedWords / moduleProgress.totalWords) * 100
                  : 0
              }%`,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Words/Phrases Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {wordsToShow.map((item) => {
          const isLearned = progress.isLearned(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleWordClick(item)}
              className={`relative p-3 rounded-xl border text-left transition-all ${
                selectedWord?.id === item.id
                  ? isDark
                    ? 'bg-[#2C3328] border-[#9CB386] shadow-lg'
                    : 'bg-[#F0EDE5] border-[#5A5A40] shadow-lg'
                  : isDark
                  ? 'bg-[#1C201A] border-[#2C3328] hover:border-[#393E32]'
                  : 'bg-white border-[#E5E2D9] hover:border-[#D0CCC0]'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-lg">{item.emoji}</span>
                {isLearned ? (
                  <CheckCircle className="size-4 text-[#2E6F40] dark:text-[#86efac] flex-shrink-0" />
                ) : (
                  <Circle className="size-4 text-[#D0CCC0] dark:text-[#393E32] flex-shrink-0" />
                )}
              </div>
              <p
                className={`text-sm font-semibold mt-1 ${
                  isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
                }`}
              >
                {item.word}
              </p>
              {item.breakdown && item.breakdown.length > 0 && (
                <p
                  className={`text-[10px] mt-1 ${
                    isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                  }`}
                >
                  {item.breakdown.join(' + ')}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Word Detail */}
      <AnimatePresence mode="wait">
        {selectedWord && (
          <motion.div
            key={selectedWord.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark
                ? 'bg-[#1C201A] border-[#2C3328]'
                : 'bg-white border-[#E5E2D9]'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4
                className={`text-base font-bold ${
                  isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
                }`}
              >
                {selectedWord.emoji}{' '}
                {selectedWord.word.charAt(0).toUpperCase() +
                  selectedWord.word.slice(1)}
              </h4>
              <button
                onClick={() => handleMarkLearned(selectedWord.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  progress.isLearned(selectedWord.id)
                    ? isDark
                      ? 'bg-[#2E6F40]/20 text-[#86efac]'
                      : 'bg-[#2E6F40]/10 text-[#2E6F40]'
                    : isDark
                    ? 'bg-[#9CB386]/10 text-[#9CB386] hover:bg-[#9CB386]/20'
                    : 'bg-[#2E6F40]/10 text-[#2E6F40] hover:bg-[#2E6F40]/20'
                }`}
              >
                {progress.isLearned(selectedWord.id) ? (
                  <>
                    <CheckCircle className="size-3" /> Aprendido
                  </>
                ) : (
                  <>
                    <Circle className="size-3" /> Marcar como aprendido
                  </>
                )}
              </button>
            </div>

            {loadingWord === selectedWord.id ? (
              <div
                className={`text-center py-4 text-sm ${
                  isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                }`}
              >
                Buscando vídeos...
              </div>
            ) : (
              <div className="space-y-4">
                {wordVideos.length > 0 && (
                  <div>
                    {signGroups.length > 0 && (
                      <p
                        className={`text-xs font-semibold mb-2 ${
                          isDark ? 'text-[#9CB386]' : 'text-[#2E6F40]'
                        }`}
                      >
                        Frase completa
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {wordVideos.map((video) => (
                        <LibrasVideoCard key={video.videoId} video={video} compact />
                      ))}
                    </div>
                  </div>
                )}

                {signGroups.map((group) => (
                  <div key={group.sign}>
                    <p
                      className={`text-xs font-semibold mb-2 ${
                        isDark ? 'text-[#9CB386]' : 'text-[#2E6F40]'
                      }`}
                    >
                      Sinal: {group.sign}
                    </p>
                    {group.results.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {group.results.map((video) => (
                          <LibrasVideoCard key={video.videoId} video={video} compact />
                        ))}
                      </div>
                    ) : (
                      <p
                        className={`text-sm ${
                          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                        }`}
                      >
                        Nenhum vídeo encontrado para este sinal
                      </p>
                    )}
                  </div>
                ))}

                {wordVideos.length === 0 && signGroups.length === 0 && (
                  <p
                    className={`text-sm text-center py-4 ${
                      isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                    }`}
                  >
                    Nenhum vídeo encontrado para este sinal
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz Button */}
      {moduleProgress.learnedWords > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => onStartQuiz(module.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              isDark
                ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
                : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
            }`}
          >
            {moduleProgress.completed ? (
              <>
                <RotateCcw className="size-4" /> Refazer Quiz
              </>
            ) : (
              <>
                Testar Conhecimento <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});
