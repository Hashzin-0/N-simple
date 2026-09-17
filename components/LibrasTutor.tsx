'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Video, Hand, BookOpen, Target, RotateCcw, Sparkles } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useLibrasTutor } from '@/hooks/useLibrasTutor';
import type { TutorMessage, DemonstrationMethod } from '@/lib/libras-tutor';

interface LibrasTutorProps {
  onOpenPractice?: (signId: string) => void;
  onOpenRecorder?: (templateId: string) => void;
}

const MODE_INFO = {
  conversar: { icon: Sparkles, label: 'Conversar', color: 'text-blue-400' },
  ensinar: { icon: BookOpen, label: 'Ensinar', color: 'text-green-400' },
  praticar: { icon: Hand, label: 'Praticar', color: 'text-yellow-400' },
  desafiar: { icon: Target, label: 'Desafiar', color: 'text-red-400' },
  revisar: { icon: RotateCcw, label: 'Revisar', color: 'text-purple-400' },
  contextualizar: { icon: Video, label: 'Contextualizar', color: 'text-orange-400' },
} as const;

export default React.memo(function LibrasTutor({ onOpenPractice, onOpenRecorder }: LibrasTutorProps) {
  const { isDark } = useTheme();
  const { state, templates, sendMessage, setMode, setDemonstrationMethod, clearHistory } = useLibrasTutor();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.conversationHistory]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickAction = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const modeInfo = MODE_INFO[state.mode];
  const ModeIcon = modeInfo.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className={`p-4 rounded-xl border ${
          isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-[#2C3328]' : 'bg-[#F0EDE5]'}`}>
            <ModeIcon className={`w-5 h-5 ${modeInfo.color}`} />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-bold ${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'}`}>
              Tutor AgroLibras
            </h3>
            <p className={`text-xs ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Modo: {modeInfo.label} · {state.signsPracticed} sinais praticados
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {(Object.keys(MODE_INFO) as Array<keyof typeof MODE_INFO>).map((mode) => {
            const info = MODE_INFO[mode];
            const Icon = info.icon;
            return (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
                  state.mode === mode
                    ? isDark
                      ? 'bg-[#9CB386] text-[#121511]'
                      : 'bg-[#2E6F40] text-white'
                    : isDark
                    ? 'bg-[#2C3328] text-[#9EA399] hover:bg-[#393E32]'
                    : 'bg-[#F0EDE5] text-[#8C897E] hover:bg-[#E5E2D9]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div
        className={`p-3 rounded-xl border h-64 overflow-y-auto ${
          isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'
        }`}
      >
        {state.conversationHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className={`w-8 h-8 mb-2 ${isDark ? 'text-[#5A5A40]' : 'text-[#D0CCC0]'}`} />
            <p className={`text-sm ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Olá! Sou seu tutor de Libras no agronegócio.
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'}`}>
              Pergunte sobre sinais ou peça para eu ensinar algum.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {state.conversationHistory.map((msg, i) => (
            <MessageBubble key={i} message={msg} isDark={isDark} />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {[
          'Me ensina milho',
          'Vamos praticar gado',
          'Qual é o sinal de trator?',
          'Me desafia!',
          'Revisar o que aprendi',
        ].map((action) => (
          <button
            key={action}
            onClick={() => handleQuickAction(action)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
              isDark
                ? 'bg-[#2C3328] text-[#9CB386] hover:bg-[#393E32]'
                : 'bg-[#F0EDE5] text-[#2E6F40] hover:bg-[#E5E2D9]'
            }`}
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
            isDark
              ? 'bg-[#242720] border-[#393E32] text-[#E8E6DF] placeholder-[#5A5A40]'
              : 'bg-white border-[#E5E2D9] text-[#3D3D3D] placeholder-[#D0CCC0]'
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className={`px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
            isDark
              ? 'bg-[#9CB386] text-[#121511] hover:bg-[#86efac]'
              : 'bg-[#2E6F40] text-white hover:bg-[#245a33]'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

// ─── Message Bubble ───

function MessageBubble({ message, isDark }: { message: TutorMessage; isDark: boolean }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
          isUser
            ? isDark
              ? 'bg-[#9CB386] text-[#121511]'
              : 'bg-[#2E6F40] text-white'
            : isDark
            ? 'bg-[#2C3328] text-[#E8E6DF]'
            : 'bg-[#F0EDE5] text-[#3D3D3D]'
        }`}
      >
        <p>{message.content}</p>
        {message.metadata?.sign && (
          <p className={`text-[10px] mt-1 ${isUser ? 'opacity-70' : 'opacity-50'}`}>
            Sinal: {message.metadata.sign}
            {message.metadata.confidence && ` (${Math.round(message.metadata.confidence * 100)}%)`}
          </p>
        )}
      </div>
    </motion.div>
  );
}
