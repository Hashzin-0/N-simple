'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff } from 'lucide-react';
import LiveVoiceOrb3D from './LiveVoiceOrb3D';
import AsciiSphere from './AsciiSphere';
import { useAnimationLock } from '@/lib/useAnimationLock';
import { useAuth } from '@/components/auth/AuthProvider';
import { useVoiceNoiseState } from '@/lib/noiseGate';

/** Estado mínimo que a HUD precisa (compatível com global e tutor). */
export interface VoiceHUDState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  errorMessage: string | null;
  /** Rótulo livre da tool em execução (ex: "Consultando data local"). */
  currentActionLabel: string | null;
  userVolume: number;
  agentVolume: number;
}

interface VoiceAssistantHUDProps {
  agentState: VoiceHUDState;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
}

const LONG_PRESS_MS = 700;
const LONG_PRESS_GRACE_MS = 300;
const MUTE_INDICATOR_DURATION_MS = 2000;

export default function VoiceAssistantHUD({
  agentState,
  onConnect,
  onDisconnect,
  onToggleMute,
}: VoiceAssistantHUDProps) {
  const { withLock } = useAnimationLock(400);
  const { islandVisible, islandHeight } = useAuth();
  // Supressor de ruído ativo (automático/manual) → partículas roxas na orbe.
  const noiseState = useVoiceNoiseState();
  const nearModeActive = noiseState.modo !== 'desligado';
  const {
    isConnected,
    isConnecting,
    isMuted,
    status,
    errorMessage,
    userVolume,
    agentVolume,
  } = agentState;

  const [showMuteIndicator, setShowMuteIndicator] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);
  const longPressGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const muteIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMutedRef = useRef(isMuted);

  const flashMuteIndicator = useCallback(() => {
    setShowMuteIndicator(true);
    if (muteIndicatorTimerRef.current) clearTimeout(muteIndicatorTimerRef.current);
    muteIndicatorTimerRef.current = setTimeout(
      () => setShowMuteIndicator(false),
      MUTE_INDICATOR_DURATION_MS
    );
  }, []);

  useEffect(() => {
    if (isMuted !== prevMutedRef.current) {
      prevMutedRef.current = isMuted;
      flashMuteIndicator();
    }
  }, [isMuted, flashMuteIndicator]);

  useEffect(() => {
    return () => {
      if (longPressGraceRef.current) clearTimeout(longPressGraceRef.current);
    };
  }, []);

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (longPressGraceRef.current) {
      clearTimeout(longPressGraceRef.current);
      longPressGraceRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isConnected) return;
      didLongPressRef.current = false;
      pressStartRef.current = { x: e.clientX, y: e.clientY };

      pressTimerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        onToggleMute();
        flashMuteIndicator();
        longPressGraceRef.current = setTimeout(() => {
          longPressGraceRef.current = null;
        }, LONG_PRESS_GRACE_MS);
      }, LONG_PRESS_MS);
    },
    [isConnected, onToggleMute, flashMuteIndicator]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pressStartRef.current) return;
    const dx = e.clientX - pressStartRef.current.x;
    const dy = e.clientY - pressStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearPressTimer();
      pressStartRef.current = null;
    }
  }, [clearPressTimer]);

  const handlePointerUp = useCallback(() => {
    if (didLongPressRef.current || longPressGraceRef.current) {
      didLongPressRef.current = false;
      pressStartRef.current = null;
      clearPressTimer();
      return;
    }
    clearPressTimer();
    pressStartRef.current = null;
    if (isConnected) {
      withLock(onDisconnect)();
    }
  }, [clearPressTimer, isConnected, onDisconnect, withLock]);

  const handleAsciiClick = useCallback(() => {
    if (isConnecting) return;
    withLock(onConnect)();
  }, [isConnecting, onConnect, withLock]);

  const orbSize = 120;
  const bottomOffset = islandVisible && islandHeight > 0 ? islandHeight + 4 : 0;

  return (
    <div
      id="voice_assistant_hud_container"
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none transition-[bottom] duration-300 ease-out"
      style={{ bottom: bottomOffset }}
    >
      {status === 'error' && errorMessage && (
        <div
          className="pointer-events-auto mb-2 max-w-[min(90vw,24rem)] rounded-lg bg-red-600/95 px-3 py-2 text-center text-xs font-medium text-white shadow-lg"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      <AnimatePresence mode="wait">
        {!(isConnected || isConnecting) ? (
          <motion.div
            key="ascii-sphere"
            initial={{ opacity: 0, scale: 0.3, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.6, filter: 'blur(12px)' }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="pointer-events-auto pb-4"
          >
            <AsciiSphere
              size={112}
              onClick={handleAsciiClick}
              isConnecting={isConnecting}
            />
          </motion.div>
        ) : (
          <motion.div
            key="orb-3d"
            initial={{ opacity: 0, scale: 0.3, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.3, filter: 'blur(8px)' }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="pointer-events-auto relative pb-2"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ touchAction: 'none' }}
          >
            <div
              className="cursor-pointer active:cursor-grabbing"
              title={isMuted ? 'Segurar para desmutar · Clique para desconectar' : 'Segurar para mutar · Clique para desconectar'}
            >
              <LiveVoiceOrb3D
                status={status}
                userVolume={userVolume}
                agentVolume={agentVolume}
                nearModeActive={nearModeActive}
                size={orbSize}
                className="drop-shadow-[0_0_20px_rgba(90,90,64,0.3)]"
              />
            </div>

            <AnimatePresence>
              {showMuteIndicator && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg whitespace-nowrap ${
                    isMuted
                      ? 'bg-[#E53E3E] text-white'
                      : 'bg-[#2E6F40] text-white'
                  }`}
                >
                  {isMuted ? (
                    <MicOff className="h-2.5 w-2.5" />
                  ) : (
                    <Mic className="h-2.5 w-2.5" />
                  )}
                  {isMuted ? 'Mudo' : 'Mic Ativo'}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
