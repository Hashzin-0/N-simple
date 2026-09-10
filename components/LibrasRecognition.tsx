'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hand, Volume2, VolumeX, Trash2, Save } from 'lucide-react';
import LibrasCamera from './LibrasCamera';
import { useLibrasRecognition } from '@/hooks/useLibrasRecognition';
import { useLibrasSettings } from '@/hooks/useLibrasSettings';
import type { RecognitionResult } from '@/lib/libras-model';

interface LibrasRecognitionProps {
  onSignRecognized?: (sign: string, confidence: number) => void;
}

export default function LibrasRecognition({ onSignRecognized }: LibrasRecognitionProps) {
  const { settings, addCustomSign, removeCustomSign } = useLibrasSettings();
  const { processFrame, resetClassifier } = useLibrasRecognition();
  const [isActive, setIsActive] = useState(false);
  const [currentResult, setCurrentResult] = useState<RecognitionResult | null>(null);
  const [recognizedText, setRecognizedText] = useState<string[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [learningLabel, setLearningLabel] = useState('');
  const [learningSamples, setLearningSamples] = useState<number[][]>([]);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Process frames when camera is active
  useEffect(() => {
    if (!isActive) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return;
    }

    frameIntervalRef.current = setInterval(async () => {
      if (videoRef.current) {
        const result = await processFrame(videoRef.current);
        setCurrentResult(result);

        if (result && result.confidence > 0.8) {
          // Add to recognized text with debounce
          setRecognizedText(prev => {
            const lastSign = prev[prev.length - 1];
            if (lastSign !== result.label) {
              onSignRecognized?.(result.label, result.confidence);
              return [...prev, result.label];
            }
            return prev;
          });
        }
      }
    }, 100); // Process at ~10fps

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [isActive, processFrame, onSignRecognized]);

  const handleToggle = useCallback(() => {
    setIsActive(prev => !prev);
    if (isActive) {
      setCurrentResult(null);
      resetClassifier();
    }
  }, [isActive, resetClassifier]);

  const handleClearText = useCallback(() => {
    setRecognizedText([]);
    resetClassifier();
  }, [resetClassifier]);

  const handleSaveCustomSign = useCallback(() => {
    if (learningLabel.trim() && learningSamples.length > 0) {
      addCustomSign(learningLabel.trim(), learningSamples);
      setLearningLabel('');
      setLearningSamples([]);
      setIsLearning(false);
    }
  }, [learningLabel, learningSamples, addCustomSign]);

  const handleStartLearning = useCallback(() => {
    setIsLearning(true);
    setLearningSamples([]);
  }, []);

  const handleCaptureSample = useCallback(() => {
    if (currentResult) {
      // In a real implementation, we'd capture the raw landmarks
      // For now, we'll use a placeholder
      setLearningSamples(prev => [...prev, []]);
    }
  }, [currentResult]);

  return (
    <div className="space-y-4">
      {/* Camera */}
      <LibrasCamera
        isActive={isActive}
        onToggle={handleToggle}
        onLandmarks={() => {}}
      />

      {/* Recognition Result */}
      <AnimatePresence>
        {currentResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-300">Sinal detectado:</p>
                <p className="text-lg font-bold text-white">{currentResult.label}</p>
                <p className="text-xs text-white/60">{currentResult.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">Confiança</p>
                <p className="text-lg font-bold text-green-400">
                  {Math.round(currentResult.confidence * 100)}%
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recognized Text */}
      {recognizedText.length > 0 && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/70">Texto reconhecido:</p>
            <button
              onClick={handleClearText}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              title="Limpar texto"
            >
              <Trash2 className="w-4 h-4 text-white/50" />
            </button>
          </div>
          <p className="text-white font-mono">
            {recognizedText.join(' ')}
          </p>
        </div>
      )}

      {/* Learning Mode */}
      <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white/70">Aprender novo sinal</p>
          {!isLearning ? (
            <button
              onClick={handleStartLearning}
              className="px-3 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors"
            >
              Iniciar aprendizado
            </button>
          ) : (
            <button
              onClick={() => setIsLearning(false)}
              className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>

        <AnimatePresence>
          {isLearning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <input
                type="text"
                value={learningLabel}
                onChange={(e) => setLearningLabel(e.target.value)}
                placeholder="Nome do sinal (ex: MILHO)"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleCaptureSample}
                  disabled={!currentResult}
                  className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Capturar amostra ({learningSamples.length})
                </button>

                <button
                  onClick={handleSaveCustomSign}
                  disabled={!learningLabel.trim() || learningSamples.length < 3}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>

              {learningSamples.length > 0 && (
                <p className="text-xs text-white/50">
                  {learningSamples.length} amostra(s) capturada(s). Recomendado: pelo menos 5 amostras.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom Signs List */}
      {Object.keys(settings.customSigns).length > 0 && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-sm text-white/70 mb-2">Sinais personalizados:</p>
          <div className="space-y-2">
            {Object.entries(settings.customSigns).map(([label]) => (
              <div key={label} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <span className="text-sm text-white">{label}</span>
                <button
                  onClick={() => removeCustomSign(label)}
                  className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Remover sinal"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
