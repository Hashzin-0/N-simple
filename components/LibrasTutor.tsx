'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Video, Hand, BookOpen, Target, RotateCcw, Sparkles, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import { useLibrasTutor } from '@/hooks/useLibrasTutor';
import { useLibrasVoiceTutor } from '@/hooks/useLibrasVoiceTutor';
import type { TutorMessage, DemonstrationMethod } from '@/lib/libras-tutor';

interface LibrasTutorProps {
  onOpenPractice?: (signId: string) => void;
  onOpenRecorder?: (templateId: string) => void;
}

const MODE_INFO = {
  conversar: { icon: Sparkles, label: 'Conversar' },
  ensinar: { icon: BookOpen, label: 'Ensinar' },
  praticar: { icon: Hand, label: 'Praticar' },
  desafiar: { icon: Target, label: 'Desafiar' },
  revisar: { icon: RotateCcw, label: 'Revisar' },
  contextualizar: { icon: Video, label: 'Contextualizar' },
} as const;

export default React.memo(function LibrasTutor({ onOpenPractice }: LibrasTutorProps) {
  const { isDark } = useTheme();
  const { state, sendMessage, setMode } = useLibrasTutor();
  const [input, setInput] = useState('');
  const [demo, setDemo] = useState<{ method: DemonstrationMethod; sign: string; videoId?: string } | null>(null);
  const [vlibrasSign, setVlibrasSign] = useState<string | null>(null);

  const voice = useLibrasVoiceTutor({
    onDemonstration: (method, sign, video) => {
      setDemo({ method, sign, videoId: video?.videoId });
      setVlibrasSign(null);
    },
    onPractice: (sign) => {
      onOpenPractice?.(sign);
      window.dispatchEvent(new CustomEvent('libras:voice-practice', { detail: { sign } }));
      document.getElementById('libras_practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    onVlibras: (sign) => {
      setVlibrasSign(sign);
      setDemo(null);
      window.dispatchEvent(new CustomEvent('libras:open-vlibras', { detail: { sign } }));
    },
  });

  const connectVoice = useCallback(() => {
    if (voice.state.isConnected || voice.state.isConnecting) {
      voice.disconnect();
      return;
    }
    voice.connect({
      transitionText: 'A sessão do Tutor Libras foi iniciada. Cumprindo a regra principal, pergunte primeiro ao aluno se ele quer ver o exemplo pelo YouTube ou pelo VLibras. Não escolha o método por ele.',
    });
  }, [voice]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, sendMessage]);

  return (
    <div className="space-y-4">
      <div className={\`p-4 rounded-xl border \${isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9]'}\`}>
        <div className="flex items-center gap-3">
          <div className={\`p-2 rounded-lg \${isDark ? 'bg-[#2C3328]' : 'bg-[#F0EDE5']}\`}>
            <Mic className={\`w-5 h-5 \${voice.state.isConnected ? 'text-green-400' : 'text-[#2E6F40]'}\`} />
          </div>
          <div className="flex-1">
            <h3 className={\`text-sm font-bold \${isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D']\`}>Tutor Libras por voz</h3>
            <p className={\`text-xs \${isDark ? 'text-[#9EA399]' : 'text-[#8C897E']\`}>
              {voice.state.isConnected ? voice.state.currentActionLabel || 'Ouvindo…' : 'Converse, escolha a demonstração e pratique pela câmera.'}
            </p>
          </div>
          <button
            onClick={connectVoice}
            className={\`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 \${voice.state.isConnected ? 'bg-red-500/15 text-red-500' : isDark ? 'bg-[#9CB386] text-[#121511]' : 'bg-[#2E6F40] text-white'}\`}
          >
            {voice.state.isConnected ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {voice.state.isConnected ? 'Encerrar' : 'Falar com Tutor'}
          </button>
        </div>

        {voice.state.lastAgentTranscript && (
          <div className={\`mt-3 p-3 rounded-lg text-xs \${isDark ? 'bg-[#242720] text-[#E8E6DF]' : 'bg-white text-[#3D3D3D']\`}>
            {voice.state.lastAgentTranscript}
          </div>
        )}

        {voice.state.errorMessage && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 text-red-500 text-xs">
            {voice.state.errorMessage}
          </div>
        )}
      </div>

      {demo?.method === 'youtube' && demo.videoId && (
        <div className={\`rounded-xl overflow-hidden border \${isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9']}\`}>
          <div className="flex items-center justify-between px-3 py-2 bg-black/5 dark:bg-white/5">
            <span className="text-xs font-semibold">Demonstração: {demo.sign} · YouTube</span>
            <Play className="w-4 h-4" />
          </div>
          <div className="aspect-video bg-black">
            <iframe
              title={\`Demonstração do sinal \${demo.sign}\`}
              src={\`https://www.youtube.com/embed/\${demo.videoId}?autoplay=1&mute=1&rel=0\`}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {vlibrasSign && (
        <div className={\`p-3 rounded-xl border text-xs \${isDark ? 'bg-[#1C201A] border-[#2C3328] text-[#E8E6DF]' : 'bg-[#FAF9F5] border-[#E5E2D9] text-[#3D3D3D']\`}>
          <strong>VLibras:</strong> demonstração preparada para <strong>{vlibrasSign}</strong>. O widget foi aberto; use o controle de reprodução do próprio VLibras para iniciar a animação.
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto">
        {(Object.keys(MODE_INFO) as Array<keyof typeof MODE_INFO>).map((mode) => {
          const info = MODE_INFO[mode];
          const Icon = info.icon;
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className={\`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap \${state.mode === mode ? 'bg-[#2E6F40] text-white' : isDark ? 'bg-[#2C3328] text-[#9EA399]' : 'bg-[#F0EDE5] text-[#8C897E]'}\`}
            >
              <Icon className="w-3 h-3" />{info.label}
            </button>
          );
        })}
      </div>

      <div className={\`p-3 rounded-xl border h-56 overflow-y-auto \${isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-[#FAF9F5] border-[#E5E2D9']\`}>
        {state.conversationHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className={\`w-8 h-8 mb-2 \${isDark ? 'text-[#5A5A40]' : 'text-[#D0CCC0']\`} />
            <p className={\`text-sm \${isDark ? 'text-[#9EA399]' : 'text-[#8C897E']\`}>Olá! Sou seu tutor de Libras no agronegócio.</p>
            <p className={\`text-xs mt-1 \${isDark ? 'text-[#9EA399]' : 'text-[#8C897E']\`}>Você também pode usar o Tutor por voz acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.conversationHistory.map((msg, i) => <MessageBubble key={i} message={msg} isDark={isDark} />)}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Digite sua mensagem..."
          className={\`flex-1 px-3 py-2 rounded-lg border text-sm \${isDark ? 'bg-[#242720] border-[#393E32] text-[#E8E6DF]' : 'bg-white border-[#E5E2D9] text-[#3D3D3D']\`}
        />
        <button onClick={handleSend} disabled={!input.trim()} className="px-3 py-2 rounded-lg bg-[#2E6F40] text-white disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

function MessageBubble({ message, isDark }: { message: TutorMessage; isDark: boolean }) {
  const isUser = message.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={\`flex \${isUser ? 'justify-end' : 'justify-start'}\`}>
      <div className={\`max-w-[80%] px-3 py-2 rounded-xl text-sm \${isUser ? isDark ? 'bg-[#9CB386] text-[#121511]' : 'bg-[#2E6F40] text-white' : isDark ? 'bg-[#2C3328] text-[#E8E6DF]' : 'bg-[#F0EDE5] text-[#3D3D3D]'}\`}>
        <p>{message.content}</p>
        {message.metadata?.sign && <p className="text-[10px] mt-1 opacity-60">Sinal: {message.metadata.sign}</p>}
      </div>
    </motion.div>
  );
}
