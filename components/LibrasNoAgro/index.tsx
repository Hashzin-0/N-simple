'use client';

import React from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Search, BookOpen, Camera, Hand, Sparkles } from 'lucide-react';
import LibrasSearch from './LibrasSearch';
import LibrasCourse from './LibrasCourse';
import LibrasCaptureTest from '@/components/LibrasCaptureTest';
import LibrasPractice from '@/components/LibrasPractice';
import LibrasTutor from '@/components/LibrasTutor';
import LibrasVideoModal from './LibrasVideoModal';
import { useLibrasProgress } from '@/hooks/useLibrasProgress';
import SaveProgressToggle from '@/components/auth/SaveProgressToggle';
import { useLibrasVideo, closeLibrasVideo } from '@/lib/librasVideoPlayer';
import { useLibrasLiveAgent, type LibrasLiveBridgeContext } from '@/hooks/useLibrasLiveAgent';
import type { LibrasVoiceSearchReport, LibrasCoachReport } from '@/lib/libras-types';

type SubTab = 'search' | 'course' | 'practice' | 'tutor' | 'capture-test';

export type LibrasSubTab = SubTab;

/**
 * Sessões empilhadas na mesma página (mesmo padrão da calculadora de nitrogênio).
 * `domId` é a âncora usada pelo SectionNavGooey (scroll-spy) e pela navegação por voz.
 */
const SECTIONS: {
  id: SubTab;
  domId: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'search', domId: 'libras_search', label: 'Buscar Sinais', icon: Search },
  { id: 'course', domId: 'librascurso', label: 'Mini-Curso', icon: BookOpen },
  { id: 'practice', domId: 'libras_practice', label: 'Praticar', icon: Hand },
  { id: 'tutor', domId: 'libras_tutor', label: 'Tutor', icon: Sparkles },
  { id: 'capture-test', domId: 'libras_capture_test', label: 'Teste Câmera', icon: Camera },
];

interface LibrasNoAgroProps {
  /** Pedido externo (voz) de busca de sinal; seq monotônico evita re-execução. */
  pendingSearch?: { seq: number; query: string } | null;
  /** Pedido externo (voz) de prática de um sinal (DTW/câmera). */
  pendingPractice?: { seq: number; templateId?: string } | null;
  /** Pedido externo (voz) de quiz do mini-curso. */
  pendingQuiz?: { seq: number; moduleId?: string } | null;
  /** Pedido externo (voz) de observação da câmera (Gemini vision). */
  pendingCoach?: { seq: number; alvo?: string; segundos: number } | null;
  /** Reporte da última busca de sinais para a tool lerResultadosSinais. */
  onSearchReport?: (report: LibrasVoiceSearchReport) => void;
  /** Reporte da avaliação visual de sinal para a tool lerFeedbackSinal. */
  onCoachReport?: (report: LibrasCoachReport) => void;
  /** Ponte do agente de voz "Libras" (montado nesta aba, padrão do Tutor). */
  voiceBridge: LibrasLiveBridgeContext;
}

export default React.memo(function LibrasNoAgro({
  pendingSearch,
  pendingPractice,
  pendingQuiz,
  pendingCoach,
  onSearchReport,
  onCoachReport,
  voiceBridge,
}: LibrasNoAgroProps) {
  const { isDark } = useTheme();
  const progress = useLibrasProgress();
  const voiceVideo = useLibrasVideo();

  // Agente de voz "Libras" (Gemini Live): só existe enquanto a aba está montada;
  // o hub de agentes (`voiceHub`) cuida do handoff com global/tutor.
  useLibrasLiveAgent(voiceBridge);

  const cardClass = `p-4 sm:p-6 rounded-3xl shadow-sm border ${
    isDark ? 'bg-[#1C201A] border-[#2C3328]' : 'bg-white border-[#E5E2D9]'
  }`;

  const headerClass = `text-lg font-bold ${
    isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
  }`;

  const renderContent = (id: SubTab) => {
    switch (id) {
      case 'search':
        return (
          <LibrasSearch
            maxResults={3}
            pendingSearch={pendingSearch ?? null}
            onReport={onSearchReport}
          />
        );
      case 'course':
        return <LibrasCourse progress={progress} pendingQuiz={pendingQuiz ?? null} />;
      case 'practice':
        return (
          <LibrasPractice
            pendingTemplate={pendingPractice ?? null}
            pendingCoach={pendingCoach ?? null}
            onCoachReport={onCoachReport}
          />
        );
      case 'tutor':
        return <LibrasTutor />;
      case 'capture-test':
        return <LibrasCaptureTest />;
    }
  };

  return (
    <div id="libras_section" className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2
          className={`text-xl sm:text-2xl font-bold ${
            isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'
          }`}
        >
          🤟 Libras no Agro
        </h2>
        <p
          className={`text-sm max-w-md mx-auto ${
            isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
          }`}
        >
          Aprenda sinais em Libras relacionados ao agronegócio e à agropecuária
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <SaveProgressToggle id="libras_save_progress_toggle" />
      </div>

      {/* Sessões empilhadas — todas montadas; o scroll-spy navega entre elas */}
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <section key={section.id} id={section.domId} className={cardClass}>
            <div className="flex items-center gap-2 mb-4">
              <Icon className="size-5 text-[#2E6F40] dark:text-[#9CB386]" />
              <h3 className={headerClass}>{section.label}</h3>
            </div>
            {renderContent(section.id)}
          </section>
        );
      })}

      {/* Player de vídeo aberto pela voz (mostrarSinal → YouTube, autoplay) */}
      {voiceVideo && (
        <LibrasVideoModal
          videoId={voiceVideo.videoId}
          title={voiceVideo.title}
          isOpen
          onClose={closeLibrasVideo}
        />
      )}
    </div>
  );
});
