'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import type { RecognitionResult, EvaluationResult } from '@/lib/libras-types';

interface LibrasGestureFeedbackProps {
  recognition: RecognitionResult | null;
  evaluation: EvaluationResult | null;
  feedbackMessage: string;
  attempt: number;
}

const DIMENSIONS = [
  { key: 'handShape', label: 'Formato da mão', weight: 30 },
  { key: 'motion', label: 'Movimento', weight: 35 },
  { key: 'orientation', label: 'Orientação', weight: 15 },
  { key: 'relativePosition', label: 'Posição relativa', weight: 20 },
] as const;

function ScoreBar({
  label,
  score,
  weight,
  isDark,
}: {
  label: string;
  score: number;
  weight: number;
  isDark: boolean;
}) {
  const color =
    score >= 75
      ? isDark
        ? 'bg-green-400'
        : 'bg-green-600'
      : score >= 50
      ? isDark
        ? 'bg-yellow-400'
        : 'bg-yellow-600'
      : isDark
      ? 'bg-red-400'
      : 'bg-red-600';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
          {label} ({weight}%)
        </span>
        <span className={`text-xs font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
          {score}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-[#242720]' : 'bg-[#E5E2D9]'}`}>
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default React.memo(function LibrasGestureFeedback({
  recognition,
  evaluation,
  feedbackMessage,
  attempt,
}: LibrasGestureFeedbackProps) {
  const { isDark } = useTheme();

  if (!recognition) return null;

  return (
    <div className="space-y-3">
      {/* Recognition */}
      <div
        className={`p-3 rounded-xl border ${
          recognition.confidence === 'high'
            ? 'bg-green-500/10 border-green-500/30'
            : recognition.confidence === 'medium'
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Reconhecimento
            </p>
            <p className={`text-sm font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
              {recognition.candidateLabel || 'Não identificado'}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>Confiança</p>
            <p
              className={`text-sm font-bold ${
                recognition.confidence === 'high'
                  ? 'text-green-400'
                  : recognition.confidence === 'medium'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {recognition.confidence === 'high'
                ? 'Alta'
                : recognition.confidence === 'medium'
                ? 'Moderada'
                : recognition.confidence === 'low'
                ? 'Baixa'
                : 'Nenhuma'}
            </p>
          </div>
        </div>
      </div>

      {/* Evaluation breakdown */}
      {evaluation && recognition.confidence !== 'none' && (
        <div
          className={`p-3 rounded-xl border ${
            isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
          }`}
        >
          <p className={`text-xs font-bold mb-2 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
            Avaliação
          </p>
          <div className="space-y-2">
            {DIMENSIONS.map((dim) => (
              <ScoreBar
                key={dim.key}
                label={dim.label}
                score={evaluation[dim.key]}
                weight={dim.weight}
                isDark={isDark}
              />
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
                Mão correta
              </span>
              <span className={`text-xs font-bold ${evaluation.handednessMatch ? 'text-green-400' : 'text-yellow-400'}`}>
                {evaluation.handednessMatch ? '✓' : '~'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
                Velocidade
              </span>
              <span className={`text-xs font-bold ${evaluation.timingQuality >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                {evaluation.timingQuality}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Feedback message */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border ${
            isDark ? 'bg-[#242720] border-[#393E32]' : 'bg-[#F0EDE5] border-[#E5E2D9]'
          }`}
        >
          <p className={`text-sm ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
            {feedbackMessage}
          </p>
          {attempt > 1 && (
            <p className={`text-xs mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Tentativa {attempt}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
