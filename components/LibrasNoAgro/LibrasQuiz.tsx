'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { CheckCircle, XCircle, Trophy, ArrowRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LibrasVideoCard from './LibrasVideoCard';
import { normalizeText, includesWholeWord } from '@/lib/libras-search-utils';
import type { LibrasModule, LibrasWord, LibrasVideoResult, LibrasQuizQuestion } from '@/lib/libras-types';
import type { useLibrasProgress } from '@/hooks/useLibrasProgress';

interface LibrasQuizProps {
  module: LibrasModule;
  progress: ReturnType<typeof useLibrasProgress>;
  onDone: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default React.memo(function LibrasQuiz({
  module,
  progress,
  onDone,
}: LibrasQuizProps) {
  const { isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [videoCache, setVideoCache] = useState<Record<string, LibrasVideoResult[]>>({});
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [quizFinished, setQuizFinished] = useState(false);

  const quizWords = useMemo(() => shuffleArray(module.words), [module.words]);

  // Pre-fetch videos for quiz questions
  useEffect(() => {
    let cancelled = false;
    const loadVideos = async () => {
      setLoadingVideos(true);
      const cache: Record<string, LibrasVideoResult[]> = {};

      for (const word of quizWords) {
        const query = word.searchQueries[0] || `${word.word} em libras`;
        try {
          const res = await fetch(
            `/api/libras/search?q=${encodeURIComponent(query)}&limit=6`
          );
          const data = await res.json();
          cache[word.id] = data.results || [];
        } catch {
          cache[word.id] = [];
        }
      }

      if (!cancelled) {
        setVideoCache(cache);
        setLoadingVideos(false);
      }
    };

    loadVideos();
    return () => { cancelled = true; };
  }, [quizWords]);

  const currentQuestion = quizWords[currentIndex];

  // Build quiz options: correct video + random wrong videos from other words
  const quizOptions = useMemo(() => {
    if (!currentQuestion || !videoCache[currentQuestion.id]) return [];

    const correctVideos = videoCache[currentQuestion.id];
    if (correctVideos.length === 0) return [];

    // Só aceita vídeo cujo título realmente contenha a palavra do quiz
    // (não bater por substring de outro termo) ou contexto de Libras.
    const targetWord = normalizeText(currentQuestion.word);
    const correct =
      correctVideos.find(
        (v) =>
          includesWholeWord(v.title, targetWord) &&
          (normalizeText(v.title).includes('libras') ||
            normalizeText(v.title).includes('sinal'))
      ) ||
      correctVideos.find((v) => includesWholeWord(v.title, targetWord)) ||
      null;
    if (!correct) return [];

    // Get wrong videos from other words
    const wrongPool: LibrasVideoResult[] = [];
    for (const other of quizWords) {
      if (other.id !== currentQuestion.id && videoCache[other.id]) {
        wrongPool.push(...videoCache[other.id].slice(0, 2));
      }
    }

    const shuffledWrong = shuffleArray(wrongPool).slice(0, 2);
    const options = shuffleArray([correct, ...shuffledWrong]);

    return options.map((opt) => ({
      video: opt,
      isCorrect: opt.videoId === correct.videoId,
    }));
  }, [currentQuestion, videoCache, quizWords]);

  const handleAnswer = useCallback(
    (index: number) => {
      if (selectedAnswer !== null) return;

      setSelectedAnswer(index);
      setShowResult(true);

      if (quizOptions[index]?.isCorrect) {
        setCorrectCount((c) => c + 1);
        progress.saveQuizScore(currentQuestion.id, module.id, 100);
      } else {
        progress.saveQuizScore(currentQuestion.id, module.id, 0);
      }
    },
    [selectedAnswer, quizOptions, currentQuestion, module.id, progress]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < quizWords.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizFinished(true);
    }
  }, [currentIndex, quizWords.length]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setCorrectCount(0);
    setQuizFinished(false);
  }, []);

  const scorePercent =
    quizWords.length > 0 ? Math.round((correctCount / quizWords.length) * 100) : 0;

  if (loadingVideos) {
    return (
      <div
        className={`text-center py-12 ${
          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
        }`}
      >
        <div className="size-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Preparando quiz...</p>
      </div>
    );
  }

  if (quizFinished) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`text-center p-8 rounded-2xl border space-y-4 ${
          isDark
            ? 'bg-[#1C201A] border-[#2C3328]'
            : 'bg-white border-[#E5E2D9]'
        }`}
      >
        <Trophy
          className={`size-12 mx-auto ${
            scorePercent >= 70
              ? 'text-[#D4A373]'
              : isDark
              ? 'text-[#9EA399]'
              : 'text-[#8C897E]'
          }`}
        />
        <h3
          className={`text-xl font-bold ${
            isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
          }`}
        >
          Quiz Concluído!
        </h3>
        <div className="space-y-2">
          <p
            className={`text-3xl font-bold ${
              scorePercent >= 70
                ? isDark
                  ? 'text-[#86efac]'
                  : 'text-[#2E6F40]'
                : isDark
                ? 'text-[#D4A373]'
                : 'text-[#8D6E63]'
            }`}
          >
            {correctCount}/{quizWords.length}
          </p>
          <div
            className={`h-3 rounded-full overflow-hidden max-w-xs mx-auto ${
              isDark ? 'bg-[#242720]' : 'bg-[#E5E2D9]'
            }`}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#2E6F40] to-[#86efac] dark:from-[#9CB386] dark:to-[#86efac]"
              initial={{ width: 0 }}
              animate={{ width: `${scorePercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p
            className={`text-sm ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}
          >
            {scorePercent}% de acerto
          </p>
        </div>

        <p
          className={`text-sm ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}
        >
          Você aprendeu{' '}
          <span className="font-bold">
            {progress.getModuleProgress(module.id).learnedWords}/
            {progress.getModuleProgress(module.id).totalWords}
          </span>{' '}
          sinais deste módulo
        </p>

        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={handleRestart}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isDark
                ? 'bg-[#2C3328] text-[#E8E6DF] hover:bg-[#393E32]'
                : 'bg-[#F0EDE5] text-[#3D3D3D] hover:bg-[#E5E2D9]'
            }`}
          >
            <RotateCcw className="size-4" /> Refazer
          </button>
          <button
            onClick={onDone}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isDark
                ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
                : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
            }`}
          >
            Concluir <ArrowRight className="size-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  if (!currentQuestion || quizOptions.length === 0) {
    return (
      <div
        className={`text-center py-8 ${
          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
        }`}
      >
        <p className="text-sm">
          Não há vídeos suficientes para gerar o quiz deste módulo.
        </p>
        <button
          onClick={onDone}
          className={`mt-4 px-4 py-2 rounded-xl text-sm font-semibold ${
            isDark
              ? 'bg-[#2C3328] text-[#E8E6DF]'
              : 'bg-[#F0EDE5] text-[#3D3D3D]'
          }`}
        >
          ← Voltar ao módulo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className={`text-base font-bold ${
            isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
          }`}
        >
          🧠 Teste Rápido
        </h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            isDark
              ? 'bg-[#2C3328] text-[#D4A373]'
              : 'bg-[#F0EDE5] text-[#8D6E63]'
          }`}
        >
          {currentIndex + 1}/{quizWords.length}
        </span>
      </div>

      {/* Progress */}
      <div
        className={`h-1.5 rounded-full overflow-hidden ${
          isDark ? 'bg-[#242720]' : 'bg-[#E5E2D9]'
        }`}
      >
        <motion.div
          className="h-full rounded-full bg-[#2E6F40] dark:bg-[#9CB386]"
          animate={{
            width: `${((currentIndex + 1) / quizWords.length) * 100}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question */}
      <div
        className={`p-4 rounded-2xl border text-center ${
          isDark
            ? 'bg-[#242720] border-[#393E32]'
            : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        <p
          className={`text-sm mb-1 ${
            isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
          }`}
        >
          Qual sinal corresponde a:
        </p>
        <p
          className={`text-lg font-bold ${
            isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
          }`}
        >
          {currentQuestion.emoji} {currentQuestion.word.toUpperCase()}
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quizOptions.map((opt, idx) => {
          const isSelected = selectedAnswer === idx;
          const isCorrectAnswer = opt.isCorrect;
          const showFeedback = showResult;

          return (
            <button
              key={opt.video.videoId}
              onClick={() => handleAnswer(idx)}
              disabled={selectedAnswer !== null}
              className={`relative rounded-2xl border overflow-hidden transition-all ${
                showFeedback
                  ? isCorrectAnswer
                    ? 'border-[#2E6F40] dark:border-[#86efac] ring-2 ring-[#2E6F40]/30 dark:ring-[#86efac]/30'
                    : isSelected
                    ? 'border-red-500 dark:border-red-400 ring-2 ring-red-500/30'
                    : 'opacity-50'
                  : isDark
                  ? 'border-[#2C3328] hover:border-[#393E32]'
                  : 'border-[#E5E2D9] hover:border-[#D0CCC0]'
              }`}
            >
              <div className="aspect-video relative">
                <Image
                  src={opt.video.thumbnail}
                  alt={opt.video.title}
                  fill
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="p-2">
                <p
                  className={`text-xs font-medium line-clamp-2 ${
                    isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
                  }`}
                >
                  {opt.video.title}
                </p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
                  }`}
                >
                  {opt.video.channel}
                </p>
              </div>
              {showFeedback && (
                <div className="absolute top-2 right-2">
                  {isCorrectAnswer ? (
                    <CheckCircle className="size-6 text-[#2E6F40] dark:text-[#86efac] drop-shadow-lg" />
                  ) : isSelected ? (
                    <XCircle className="size-6 text-red-500 drop-shadow-lg" />
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Result feedback */}
      <AnimatePresence mode="wait">
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-xl border text-center space-y-3 ${
              selectedAnswer !== null && quizOptions[selectedAnswer]?.isCorrect
                ? isDark
                  ? 'bg-[#2E6F40]/10 border-[#2E6F40]/30'
                  : 'bg-[#2E6F40]/5 border-[#2E6F40]/20'
                : isDark
                ? 'bg-red-900/10 border-red-800/30'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p
              className={`text-sm font-bold ${
                selectedAnswer !== null && quizOptions[selectedAnswer]?.isCorrect
                  ? isDark
                    ? 'text-[#86efac]'
                    : 'text-[#2E6F40]'
                  : 'text-red-500'
              }`}
            >
              {selectedAnswer !== null && quizOptions[selectedAnswer]?.isCorrect
                ? '✓ Correto!'
                : '✗ Incorreto'}
            </p>
            <button
              onClick={handleNext}
              className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isDark
                  ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
                  : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
              }`}
            >
              {currentIndex < quizWords.length - 1 ? (
                <>
                  Próxima <ArrowRight className="size-3" />
                </>
              ) : (
                'Ver Resultado'
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
