'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Hand,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useLibrasDTW } from '@/hooks/useLibrasDTW';
import { loadTemplates } from '@/lib/libras-templates';
import { drawHandLandmarks } from '@/lib/libras-capture-debug';
import LibrasGestureFeedback from './LibrasGestureFeedback';
import type { GestureTemplate } from '@/lib/libras-types';

interface LibrasPracticeProps {
  onBack?: () => void;
}

export default React.memo(function LibrasPractice({ onBack }: LibrasPracticeProps) {
  const { isDark } = useTheme();
  const {
    isReady,
    gestureState,
    recognition,
    evaluation,
    feedbackMessage,
    attempt,
    processFrame,
    setTargetTemplate,
    reset,
  } = useLibrasDTW();

  const [isActive, setIsActive] = useState(false);
  const [templates, setTemplates] = useState<GestureTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<GestureTemplate | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load templates
  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  // Camera management
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Process frames loop
  useEffect(() => {
    if (!isActive || !selectedTemplate) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const init = async () => {
      await startCamera();
    };
    init();

    frameIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && !cancelled) {
        const landmarks = await processFrame(videoRef.current);
        if (landmarks && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            if (landmarks.length > 0) {
              drawHandLandmarks(ctx, landmarks, canvasRef.current.width, canvasRef.current.height, '#86efac');
            }
          }
        }
      }
    }, 33);

    return () => {
      cancelled = true;
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      stopCamera();
    };
  }, [isActive, selectedTemplate, processFrame, startCamera, stopCamera]);

  // Template selection
  const handleSelectTemplate = useCallback(
    (template: GestureTemplate) => {
      setSelectedTemplate(template);
      setTargetTemplate(template);
      setCurrentIndex(templates.findIndex((t) => t.id === template.id));
      setIsActive(true);
    },
    [templates, setTargetTemplate]
  );

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const handleNext = useCallback(() => {
    const nextIdx = (currentIndex + 1) % templates.length;
    setCurrentIndex(nextIdx);
    setSelectedTemplate(templates[nextIdx]);
    setTargetTemplate(templates[nextIdx]);
    reset();
  }, [currentIndex, templates, setTargetTemplate, reset]);

  const handlePrev = useCallback(() => {
    const prevIdx = (currentIndex - 1 + templates.length) % templates.length;
    setCurrentIndex(prevIdx);
    setSelectedTemplate(templates[prevIdx]);
    setTargetTemplate(templates[prevIdx]);
    reset();
  }, [currentIndex, templates, setTargetTemplate, reset]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setSelectedTemplate(null);
    setTargetTemplate(null);
    stopCamera();
  }, [setTargetTemplate, stopCamera]);

  // Template grid view
  if (!selectedTemplate) {
    return (
      <div className="space-y-4">
        <p className={`text-sm ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
          Selecione um sinal para praticar:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isDark
                  ? 'bg-[#1C201A] border-[#2C3328] hover:border-[#393E32]'
                  : 'bg-white border-[#E5E2D9] hover:border-[#D0CCC0]'
              }`}
            >
              <span className="text-xl">{t.emoji}</span>
              <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
                {t.label}
              </p>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
                {t.isDynamic ? 'Dinâmico' : 'Estático'}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Practice view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleStop}
          className={`text-sm font-medium transition-colors ${
            isDark ? 'text-[#9CB386] hover:text-[#86efac]' : 'text-[#2E6F40] hover:text-[#1a5c2e]'
          }`}
        >
          ← Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-[#2C3328] text-[#9EA399]' : 'hover:bg-[#F0EDE5] text-[#8C897E]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
            {currentIndex + 1}/{templates.length}
          </span>
          <button
            onClick={handleNext}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-[#2C3328] text-[#9EA399]' : 'hover:bg-[#F0EDE5] text-[#8C897E]'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Template info */}
      <div
        className={`p-3 rounded-xl border ${
          isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{selectedTemplate.emoji}</span>
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
              {selectedTemplate.label}
            </h3>
            <p className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              {selectedTemplate.description}
            </p>
          </div>
        </div>
      </div>

      {/* Camera + Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm">
        {isActive ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-auto"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-40 bg-gradient-to-br from-white/5 to-white/10">
            <Camera className="w-10 h-10 text-white/40" />
          </div>
        )}

        {/* Status */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-white/30'}`} />
          <span className="text-xs text-white/70">
            {gestureState === 'active'
              ? 'Movimento detectado'
              : gestureState === 'done'
              ? 'Gesto completo'
              : gestureState === 'waiting'
              ? 'Aguardando...'
              : 'Pronto'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
            isDark
              ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#9EA399] border border-[#393E32]'
              : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#8C897E] border border-[#E5E2D9]'
          }`}
        >
          <RotateCcw className="w-4 h-4" /> Resetar
        </button>
        <button
          onClick={handleNext}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
            isDark
              ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
              : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
          }`}
        >
          Próximo sinal <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Feedback */}
      <LibrasGestureFeedback
        recognition={recognition}
        evaluation={evaluation}
        feedbackMessage={feedbackMessage}
        attempt={attempt}
      />
    </div>
  );
});
