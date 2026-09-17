'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, CameraOff, CircleDot, CheckCircle, Trash2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useLibrasCapture } from '@/hooks/useLibrasCapture';
import { extractFeatures, flattenFeatures } from '@/lib/libras-features';
import { addExampleToTemplate, loadTemplates } from '@/lib/libras-templates';
import { drawHandLandmarks } from '@/lib/libras-capture-debug';
import type { GestureTemplate, GestureExample } from '@/lib/libras-types';

interface LibrasTemplateRecorderProps {
  templateId: string;
  onDone?: () => void;
}

export default React.memo(function LibrasTemplateRecorder({
  templateId,
  onDone,
}: LibrasTemplateRecorderProps) {
  const { isDark } = useTheme();
  const {
    isReady,
    diagnostic,
    latestLeftHand,
    latestRightHand,
    startRecording,
    stopRecording,
    clearRecording,
    processFrame,
  } = useLibrasCapture();

  const [isActive, setIsActive] = useState(false);
  const [signerLabel, setSignerLabel] = useState('Sinalizante A');
  const [signerId, setSignerId] = useState('signer_a');
  const [exampleCount, setExampleCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureCountdown, setCaptureCountdown] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);

  const template = loadTemplates().find((t) => t.id === templateId);

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
    if (!isActive) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return;
    }

    let cancelled = false;
    startCamera();

    frameIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && !cancelled) {
        const frame = await processFrame(videoRef.current);
        if (frame && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            if (frame.leftLandmarks) {
              drawHandLandmarks(ctx, frame.leftLandmarks, canvasRef.current.width, canvasRef.current.height, '#86efac');
            }
            if (frame.rightLandmarks) {
              drawHandLandmarks(ctx, frame.rightLandmarks, canvasRef.current.width, canvasRef.current.height, '#60a5fa');
            }
          }
        }
      }
    }, 33);

    return () => {
      cancelled = true;
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      stopCamera();
    };
  }, [isActive, processFrame, startCamera, stopCamera]);

  // Auto-capture: record for 2 seconds then save
  const handleCapture = useCallback(() => {
    if (isCapturing) return;

    setIsCapturing(true);
    setCaptureCountdown(2);
    clearRecording();
    startRecording();

    // Countdown
    let count = 2;
    captureTimerRef.current = setInterval(() => {
      count--;
      setCaptureCountdown(count);
      if (count <= 0) {
        if (captureTimerRef.current) clearInterval(captureTimerRef.current);

        // Stop and save
        const recording = stopRecording();
        if (recording && recording.frames.length > 0) {
          // Extract features from all frames
          const features = recording.frames.map((frame) => {
            const fv = extractFeatures(frame.leftLandmarks, frame.rightLandmarks);
            return flattenFeatures(fv);
          });

          const example: GestureExample = {
            features,
            rawLandmarks: recording.frames.map((f) => ({
              left: f.leftLandmarks,
              right: f.rightLandmarks,
            })),
            metadata: {
              frameCount: recording.diagnostic.frameCount,
              durationMs: recording.diagnostic.durationMs,
              recordedAt: recording.recordedAt,
              motionDetected: recording.diagnostic.handsDetected > 0,
            },
          };

          addExampleToTemplate(templateId, signerId, signerLabel, example);
          setExampleCount((prev) => prev + 1);
        }

        setIsCapturing(false);
      }
    }, 1000);
  }, [isCapturing, templateId, signerId, signerLabel, startRecording, stopRecording, clearRecording]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    };
  }, []);

  if (!template) {
    return (
      <p className={`text-sm ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
        Template não encontrado.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template info */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{template.emoji}</span>
        <div>
          <h3 className={`text-base font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
            Gravar: {template.label}
          </h3>
          <p className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
            {template.description}
          </p>
        </div>
      </div>

      {/* Signer selector */}
      <div
        className={`p-3 rounded-xl border ${
          isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        <label className={`text-xs font-medium ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
          Sinalizante
        </label>
        <div className="flex gap-2 mt-2">
          {[
            { id: 'signer_a', label: 'Sinalizante A' },
            { id: 'signer_b', label: 'Sinalizante B' },
            { id: 'signer_c', label: 'Sinalizante C' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSignerId(s.id);
                setSignerLabel(s.label);
                setExampleCount(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                signerId === s.id
                  ? isDark
                    ? 'bg-[#9CB386] text-[#121511]'
                    : 'bg-[#2E6F40] text-white'
                  : isDark
                  ? 'bg-[#2C3328] text-[#9EA399] hover:bg-[#393E32]'
                  : 'bg-[#F0EDE5] text-[#8C897E] hover:bg-[#E5E2D9]'
              }`}
            >
              {s.label}
            </button>
          ))}
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
            {isCapturing
              ? `Gravando... ${captureCountdown}s`
              : isActive
              ? 'Câmera ativa'
              : 'Câmera inativa'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsActive((prev) => !prev)}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
            isActive
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
              : isDark
              ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#E8E6DF] border border-[#393E32]'
              : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#3D3D3D] border border-[#E5E2D9]'
          }`}
        >
          {isActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {isActive ? 'Desligar' : 'Ligar'}
        </button>

        {isActive && isReady && (
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 ${
              isDark
                ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
                : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
            }`}
          >
            <CircleDot className="w-4 h-4" />
            {isCapturing ? `Gravando ${captureCountdown}s...` : 'Gravar Exemplo'}
          </button>
        )}
      </div>

      {/* Examples captured */}
      <div
        className={`p-3 rounded-xl border ${
          isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className={`text-sm font-medium ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
            Exemplos capturados: {exampleCount}
          </p>
          {exampleCount >= 3 && (
            <div className="flex items-center gap-1 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Suficiente</span>
            </div>
          )}
        </div>
        <p className={`text-xs mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
          {exampleCount < 3
            ? `Capture pelo menos 3 exemplos. Recomendado: 5 por sinalizante.`
            : `Você pode capturar mais exemplos para melhorar a precisão.`}
        </p>
      </div>

      {/* Done button */}
      {exampleCount > 0 && (
        <button
          onClick={onDone}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
            isDark
              ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#86efac] border border-[#393E32]'
              : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#2E6F40] border border-[#E5E2D9]'
          }`}
        >
          Concluir Gravação
        </button>
      )}
    </div>
  );
});
