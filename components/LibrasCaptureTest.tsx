'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  Circle,
  CircleDot,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  Pause,
  Hand,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useLibrasCapture } from '@/hooks/useLibrasCapture';
import { drawHandLandmarks, drawDiagnosticOverlay } from '@/lib/libras-capture-debug';
import type { CaptureRecording, HandLabel } from '@/lib/libras-types';

interface LibrasCaptureTestProps {
  onRecordingReady?: (recording: CaptureRecording) => void;
}

export default React.memo(function LibrasCaptureTest({ onRecordingReady }: LibrasCaptureTestProps) {
  const { isDark } = useTheme();
  const {
    isReady,
    isRecording,
    diagnostic,
    recording,
    capturedFrames,
    latestLeftHand,
    latestRightHand,
    startRecording,
    stopRecording,
    clearRecording,
    processFrame,
  } = useLibrasCapture();

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            setError('Acesso à câmera negado. Permita o acesso nas configurações do navegador.');
          } else if (err.name === 'NotFoundError') {
            setError('Nenhuma câmera encontrada no dispositivo.');
          } else {
            setError(`Erro ao acessar câmera: ${err.message}`);
          }
        } else {
          setError('Erro desconhecido ao acessar câmera.');
        }
      }
    };

    init();

    frameIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
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
            drawDiagnosticOverlay(ctx, diagnostic, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
    }, 33); // ~30fps

    return () => {
      cancelled = true;
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      stopCamera();
    };
  }, [isActive, processFrame, stopCamera, diagnostic]);

  // Toggle active
  const handleToggle = useCallback(() => {
    setIsActive((prev) => !prev);
    if (isActive) {
      clearRecording();
      setShowReplay(false);
    }
  }, [isActive, clearRecording]);

  // Recording controls
  const handleStartRecording = useCallback(() => {
    clearRecording();
    setShowReplay(false);
    startRecording();
  }, [clearRecording, startRecording]);

  const handleStopRecording = useCallback(() => {
    const result = stopRecording();
    if (result) {
      onRecordingReady?.(result);
    }
  }, [stopRecording, onRecordingReady]);

  // Replay
  const handleStartReplay = useCallback(() => {
    if (!recording || recording.frames.length === 0) return;
    setShowReplay(true);
    setReplayIndex(0);
  }, [recording]);

  useEffect(() => {
    if (!showReplay || !recording) return;

    replayIntervalRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= recording.frames.length - 1) {
          if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 33);

    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, [showReplay, recording]);

  // Draw replay frame on canvas
  useEffect(() => {
    if (!showReplay || !recording || !canvasRef.current) return;
    const frame = recording.frames[replayIndex];
    if (!frame) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (frame.leftLandmarks) {
      drawHandLandmarks(ctx, frame.leftLandmarks, canvasRef.current.width, canvasRef.current.height, '#86efac');
    }
    if (frame.rightLandmarks) {
      drawHandLandmarks(ctx, frame.rightLandmarks, canvasRef.current.width, canvasRef.current.height, '#60a5fa');
    }
  }, [replayIndex, showReplay, recording]);

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handednessLabel = (h: HandLabel): string => {
    switch (h) {
      case 'left': return 'Esquerda';
      case 'right': return 'Direita';
      case 'both': return 'Ambas';
      default: return 'Não detectada';
    }
  };

  return (
    <div className="space-y-4">
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

        {/* Status indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-white/30'}`} />
          <span className="text-xs text-white/70">
            {isActive ? (isRecording ? 'Gravando...' : 'Câmera ativa') : 'Câmera inativa'}
          </span>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">
              {capturedFrames.length} frames
            </span>
          </div>
        )}

        {/* Replay indicator */}
        {showReplay && recording && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-400 font-medium">
              Replay {replayIndex + 1}/{recording.frames.length}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Camera toggle */}
      <button
        onClick={handleToggle}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
          isActive
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
            : isDark
            ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#E8E6DF] border border-[#393E32]'
            : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#3D3D3D] border border-[#E5E2D9]'
        }`}
      >
        {isActive ? (
          <>
            <CameraOff className="w-4 h-4" /> Desligar Câmera
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" /> Ligar Câmera
          </>
        )}
      </button>

      {/* Diagnostic Panel */}
      {isActive && (
        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
          }`}
        >
          <button
            onClick={() => toggleSection('diagnostic')}
            className="w-full flex items-center justify-between"
          >
            <span className={`text-sm font-medium ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
              Diagnóstico de Captura
            </span>
            {expandedSection === 'diagnostic' ? (
              <ChevronUp className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/50" />
            )}
          </button>

          <AnimatePresence>
            {expandedSection === 'diagnostic' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-3"
              >
                {/* Status grid */}
                <div className="grid grid-cols-2 gap-3">
                  <DiagnosticItem
                    label="Mãos detectadas"
                    value={`${diagnostic.handsDetected ?? 0}`}
                    ok={(diagnostic.handsDetected ?? 0) > 0}
                    isDark={isDark}
                  />
                  <DiagnosticItem
                    label="Lateralidade"
                    value={handednessLabel(diagnostic.handedness ?? 'unknown')}
                    ok={diagnostic.handedness !== 'unknown'}
                    isDark={isDark}
                  />
                  <DiagnosticItem
                    label="FPS"
                    value={`${diagnostic.fps ?? 0}`}
                    ok={(diagnostic.fps ?? 0) >= 24}
                    isDark={isDark}
                  />
                  <DiagnosticItem
                    label="Landmarks"
                    value={`${diagnostic.landmarksPerHand ?? 0}/21`}
                    ok={(diagnostic.landmarksPerHand ?? 0) === 21}
                    isDark={isDark}
                  />
                  <DiagnosticItem
                    label="Estabilidade"
                    value={`${diagnostic.stabilityPercent ?? 0}%`}
                    ok={(diagnostic.stabilityPercent ?? 0) >= 80}
                    isDark={isDark}
                  />
                  <DiagnosticItem
                    label="Duração"
                    value={`${((diagnostic.durationMs ?? 0) / 1000).toFixed(1)}s`}
                    ok={true}
                    isDark={isDark}
                  />
                </div>

                {/* Overall status */}
                <div
                  className={`p-3 rounded-lg border ${
                    isReady && (diagnostic.handsDetected ?? 0) > 0
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isReady && (diagnostic.handsDetected ?? 0) > 0 ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                    )}
                    <span className={`text-xs font-medium ${
                      isReady && (diagnostic.handsDetected ?? 0) > 0
                        ? 'text-green-300'
                        : 'text-yellow-300'
                    }`}>
                      {isReady
                        ? (diagnostic.handsDetected ?? 0) > 0
                          ? 'Captura funcionando — mãos detectadas'
                          : 'Aguardando detecção de mãos — posicione as mãos na frente da câmera'
                        : 'MediaPipe carregando...'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Recording Controls */}
      {isActive && isReady && (
        <div className="flex gap-2">
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                isDark
                  ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#86efac] border border-[#393E32]'
                  : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#2E6F40] border border-[#E5E2D9]'
              }`}
            >
              <CircleDot className="w-4 h-4" /> Gravar Teste
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all"
            >
              <Circle className="w-4 h-4" /> Parar Gravação
            </button>
          )}

          {recording && !isRecording && (
            <button
              onClick={handleStartReplay}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                isDark
                  ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#60a5fa] border border-[#393E32]'
                  : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#2563EB] border border-[#E5E2D9]'
              }`}
            >
              <Play className="w-4 h-4" /> Reproduzir
            </button>
          )}
        </div>
      )}

      {/* Recording Result */}
      <AnimatePresence>
        {recording && !isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
            }`}
          >
            <h4 className={`text-sm font-bold mb-3 ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
              Resultado da Gravação
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <DiagnosticItem
                label="Frames"
                value={`${recording.diagnostic.frameCount}`}
                ok={recording.diagnostic.frameCount >= 10}
                isDark={isDark}
              />
              <DiagnosticItem
                label="Duração"
                value={`${(recording.diagnostic.durationMs / 1000).toFixed(1)}s`}
                ok={recording.diagnostic.durationMs >= 500}
                isDark={isDark}
              />
              <DiagnosticItem
                label="FPS"
                value={`${recording.diagnostic.fps}`}
                ok={recording.diagnostic.fps >= 24}
                isDark={isDark}
              />
              <DiagnosticItem
                label="Estabilidade"
                value={`${recording.diagnostic.stabilityPercent}%`}
                ok={recording.diagnostic.stabilityPercent >= 80}
                isDark={isDark}
              />
              <DiagnosticItem
                label="Mãos"
                value={`${recording.diagnostic.handsDetected}`}
                ok={recording.diagnostic.handsDetected > 0}
                isDark={isDark}
              />
              <DiagnosticItem
                label="Landmarks"
                value={`${recording.diagnostic.landmarksPerHand}/21`}
                ok={recording.diagnostic.landmarksPerHand === 21}
                isDark={isDark}
              />
            </div>

            {/* Pass/Fail summary */}
            <div
              className={`mt-3 p-3 rounded-lg border ${
                recording.diagnostic.frameCount >= 10 &&
                recording.diagnostic.fps >= 24 &&
                recording.diagnostic.stabilityPercent >= 80 &&
                recording.diagnostic.handsDetected > 0
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <span className={`text-xs font-medium ${
                recording.diagnostic.frameCount >= 10 &&
                recording.diagnostic.fps >= 24 &&
                recording.diagnostic.stabilityPercent >= 80 &&
                recording.diagnostic.handsDetected > 0
                  ? 'text-green-300'
                  : 'text-yellow-300'
              }`}>
                {recording.diagnostic.frameCount >= 10 &&
                recording.diagnostic.fps >= 24 &&
                recording.diagnostic.stabilityPercent >= 80 &&
                recording.diagnostic.handsDetected > 0
                  ? '✓ Captura válida — pipeline funciona corretamente'
                  : '⚠ Captura com problemas — verifique os itens marcados'}
              </span>
            </div>

            <button
              onClick={clearRecording}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isDark
                  ? 'bg-[#2C3328] hover:bg-[#393E32] text-[#9EA399] border border-[#393E32]'
                  : 'bg-[#F0EDE5] hover:bg-[#E5E2D9] text-[#8C897E] border border-[#E5E2D9]'
              }`}
            >
              <RotateCcw className="w-4 h-4" /> Limpar e Gravar Novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Diagnostic Item Sub-component ───

function DiagnosticItem({
  label,
  value,
  ok,
  isDark,
}: {
  label: string;
  value: string;
  ok: boolean;
  isDark: boolean;
}) {
  return (
    <div
      className={`p-2 rounded-lg border ${
        ok
          ? isDark
            ? 'bg-green-500/5 border-green-500/20'
            : 'bg-green-500/5 border-green-500/20'
          : isDark
          ? 'bg-yellow-500/5 border-yellow-500/20'
          : 'bg-yellow-500/5 border-yellow-500/20'
      }`}
    >
      <p className={`text-[10px] ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {ok ? (
          <CheckCircle className="w-3 h-3 text-green-400" />
        ) : (
          <AlertCircle className="w-3 h-3 text-yellow-400" />
        )}
        <span className={`text-sm font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
