'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Sparkles, 
  ChevronUp, 
  ChevronDown, 
  Radio, 
  Volume2, 
  AlertCircle,
  Clock,
  Compass,
  Zap
} from 'lucide-react';
import LiveVoiceOrb3D from './LiveVoiceOrb3D';
import { LiveAgentState } from '@/hooks/useGeminiLiveAgent';
import { useAnimationLock } from '@/lib/useAnimationLock';

interface VoiceAssistantHUDProps {
  agentState: LiveAgentState;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
}

export default function VoiceAssistantHUD({
  agentState,
  onConnect,
  onDisconnect,
  onToggleMute,
}: VoiceAssistantHUDProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { withLock } = useAnimationLock(400);

  const {
    isConnected,
    isConnecting,
    isMuted,
    status,
    errorMessage,
    lastAgentTranscript,
    currentActionLabel,
    userVolume,
    agentVolume,
  } = agentState;

  // Status text display
  const getStatusBadge = () => {
    if (isConnecting) {
      return { text: 'Conectando ao Gemini Live...', color: 'bg-[#C5A880] text-white animate-pulse' };
    }
    if (status === 'speaking') {
      return { text: 'Puck falando...', color: 'bg-[#2E6F40] text-white shadow-md' };
    }
    if (status === 'thinking') {
      return { text: currentActionLabel || 'Executando no site...', color: 'bg-[#319795] text-white animate-pulse' };
    }
    if (status === 'listening') {
      if (isMuted) {
        return { text: 'Microfone Mutado', color: 'bg-[#E53E3E] text-white' };
      }
      return { text: 'Ouvindo você • Fale naturalmente', color: 'bg-[#5A5A40] text-white' };
    }
    if (status === 'error') {
      return { text: errorMessage || 'Erro de conexão', color: 'bg-[#E53E3E] text-white' };
    }
    return { text: 'Voz Puck Desconectada', color: 'bg-[#8C897E] text-white' };
  };

  const badge = getStatusBadge();

  return (
    <div
      id="voice_assistant_hud_container"
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)] pointer-events-none"
    >
      {/* EXPANDED 3D VOICE HUD CARD */}
      <AnimatePresence>
        {isConnected && isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="pointer-events-auto w-full bg-white/95 dark:bg-[#1A1C16]/95 backdrop-blur-md rounded-3xl p-5 shadow-2xl border border-[#E5E2D9] dark:border-[#333829] space-y-4 overflow-hidden relative"
          >
            {/* Ambient Background Glow */}
            <div 
              className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 transition-colors duration-700 pointer-events-none ${
                status === 'speaking' ? 'bg-[#2E6F40]' : status === 'listening' ? 'bg-[#D4A373]' : 'bg-[#5A5A40]'
              }`} 
            />

            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-[#F0EDE5] dark:border-[#2F3329] pb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-[#2E6F40]' : 'bg-[#8C897E]'}`} />
                  {isConnected && (
                    <span className="absolute h-4 w-4 rounded-full bg-[#2E6F40] opacity-40 animate-ping" />
                  )}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#5A5A40] dark:text-[#E8E7DF] flex items-center gap-1.5">
                    Assistente Agrônomo Puck
                    <span className="text-[10px] uppercase font-sans font-extrabold bg-[#F0EDE5] dark:bg-[#282B22] text-[#5A5A40] dark:text-[#A3B18A] px-1.5 py-0.5 rounded">
                      Live API
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#8C897E] dark:text-[#A6A395]">Controle de voz & navegação em tempo real</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  id="btn_hud_minimize"
                  onClick={withLock(() => setIsExpanded(false))}
                  className="p-1.5 text-[#8C897E] hover:text-[#5A5A40] dark:hover:text-[#E8E7DF] rounded-lg hover:bg-[#F9F8F6] dark:hover:bg-[#242720] transition-colors"
                  title="Minimizar HUD"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 3D Orb Interactive Stage */}
            <div className="relative flex flex-col items-center justify-center py-2">
              <LiveVoiceOrb3D
                status={status}
                userVolume={userVolume}
                agentVolume={agentVolume}
                size={160}
                className="drop-shadow-lg"
              />

              {/* Status Pill */}
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-tight transition-all duration-300 ${badge.color}`}>
                  {status === 'speaking' ? (
                    <Volume2 className="h-3 w-3 animate-pulse shrink-0" />
                  ) : status === 'listening' ? (
                    <Radio className="h-3 w-3 shrink-0" />
                  ) : status === 'thinking' ? (
                    <Zap className="h-3 w-3 animate-spin shrink-0" />
                  ) : (
                    <Sparkles className="h-3 w-3 shrink-0" />
                  )}
                  <span>{badge.text}</span>
                </span>
              </div>

              {/* Action Banner (e.g. Scrollando para resultados) */}
              <AnimatePresence>
                {currentActionLabel && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-2 text-[11px] font-bold text-[#5A5A40] dark:text-[#E8E7DF] bg-[#F9F8F6] dark:bg-[#242720] border border-[#E5E2D9] dark:border-[#363C2C] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <Compass className="h-3 w-3 text-[#D4A373] animate-spin" />
                    <span>{currentActionLabel}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Puck Spoken Transcript Ticker */}
            {lastAgentTranscript && (
              <div className="bg-[#FDFBF7] dark:bg-[#20231C] p-3 rounded-2xl border border-[#E5E2D9] dark:border-[#333829] text-xs text-[#5A5A40] dark:text-[#E8E7DF] leading-relaxed max-h-24 overflow-y-auto italic font-serif">
                &ldquo;{lastAgentTranscript}&rdquo;
              </div>
            )}

            {/* Quick Voice Hints */}
            <div className="space-y-1.5 border-t border-[#F0EDE5] dark:border-[#2F3329] pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#A6A395] flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#D4A373]" /> Dicas de comandos de voz:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Mude a meta para 160 sc/ha',
                  'Qual é a data e hora de hoje?',
                  'Mostre os resultados',
                  'Carregue alta produtividade',
                ].map((hint, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-[#F9F8F6] dark:bg-[#242720] text-[#5A5A40] dark:text-[#D5D4CB] px-2 py-1 rounded-md border border-[#E5E2D9] dark:border-[#363C2C] font-medium"
                  >
                    &ldquo;{hint}&rdquo;
                  </span>
                ))}
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F0EDE5] dark:border-[#2F3329]">
              <button
                id="btn_voice_mute_toggle"
                onClick={withLock(onToggleMute)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isMuted 
                    ? 'bg-[#E53E3E] text-white shadow-md' 
                    : 'bg-[#F9F8F6] hover:bg-[#F0EDE5] dark:bg-[#242720] dark:hover:bg-[#2F3329] text-[#5A5A40] dark:text-[#E8E7DF] border border-[#E5E2D9] dark:border-[#363C2C]'
                }`}
                title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-[#5A5A40] dark:text-[#E8E7DF]" />}
                <span>{isMuted ? 'Mudo Ativado' : 'Mutar Mic'}</span>
              </button>

              <button
                id="btn_voice_disconnect"
                onClick={withLock(onDisconnect)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#F9F8F6] dark:bg-[#242720] hover:bg-[#E53E3E] text-[#8C897E] hover:text-white border border-[#E5E2D9] dark:border-[#363C2C] hover:border-[#E53E3E] transition-all"
                title="Encerrar conversa de voz com Puck"
              >
                <PhoneOff className="h-4 w-4" />
                <span>Desconectar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING TRIGGER BUTTON (When disconnected or minimized) */}
      <div className="pointer-events-auto flex items-center gap-2">
        {isConnected && !isExpanded && (
          <button
            id="btn_hud_expand"
            onClick={withLock(() => setIsExpanded(true))}
            className="flex items-center gap-2 bg-white dark:bg-[#1A1C16] text-[#5A5A40] dark:text-[#E8E7DF] px-4 py-3 rounded-2xl shadow-xl border border-[#E5E2D9] dark:border-[#333829] font-bold text-xs hover:bg-[#F9F8F6] dark:hover:bg-[#242720] transition-all active:scale-95"
          >
            <div className="relative">
              <span className="h-2 w-2 rounded-full bg-[#2E6F40] inline-block" />
              <span className="absolute -inset-0.5 rounded-full bg-[#2E6F40] opacity-40 animate-ping" />
            </div>
            <span>Puck Ativo ({status === 'speaking' ? 'Falando' : 'Ouvindo'})</span>
            <ChevronUp className="h-4 w-4 text-[#8C897E]" />
          </button>
        )}

        {!isConnected && (
          <motion.button
            id="btn_start_voice_agent"
            onClick={withLock(onConnect)}
            disabled={isConnecting}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-sm transition-all border ${
              isConnecting
                ? 'bg-[#8C897E] text-white border-transparent cursor-wait'
                : 'bg-[#5A5A40] hover:bg-[#484833] text-white border-white/20 shadow-[#5A5A4040]'
            }`}
            title="Conversar por voz com o Especialista Agrônomo Puck (Gemini Live API)"
          >
            <div className="p-1.5 rounded-xl bg-white/10 text-white">
              {isConnecting ? (
                <Radio className="h-5 w-5 animate-spin" />
              ) : (
                <Mic className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="leading-tight">Falar com Puck</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-[#D4A373] text-white rounded font-extrabold">
                  Gemini Live
                </span>
              </div>
              <p className="text-[10px] text-white/80 font-normal leading-tight">
                {isConnecting ? 'Conectando...' : 'Voz em tempo real com controle do site'}
              </p>
            </div>
          </motion.button>
        )}
      </div>
    </div>
  );
}
