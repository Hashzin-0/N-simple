'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import type { DemonstrationMethod } from '@/lib/libras-tutor';

export interface LibrasVoiceTutorState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  errorMessage: string | null;
  lastAgentTranscript: string;
  currentActionLabel: string | null;
  userVolume: number;
  agentVolume: number;
  demonstrationMethod: DemonstrationMethod | null;
  currentSign: string | null;
  videos: Array<{ videoId: string; title: string; channel: string; thumbnail: string; url: string }>;
}

export interface LibrasVoiceTutorBridge {
  onDemonstration: (method: DemonstrationMethod, sign: string, video?: LibrasVoiceTutorState['videos'][number]) => void;
  onPractice: (sign: string) => void;
  onVlibras: (sign: string) => void;
}

const SYSTEM_INSTRUCTION = \`Você é o Tutor Oral de Libras no Agronegócio do aplicativo Agronômica N-Pro.
Fale português do Brasil, de forma curta, clara e pedagógica. Você é um agente de voz em tempo real.

REGRA PRINCIPAL DA DEMONSTRAÇÃO:
1. Quando o aluno pedir para aprender, ensinar ou mostrar um sinal, PRIMEIRO pergunte:
"Você quer ver o exemplo pelo YouTube ou pelo VLibras?"
2. NÃO escolha o método pelo aluno.
3. Depois que ele escolher YouTube ou VLibras, use a ferramenta correspondente.
4. Se escolher YouTube, pesquise o sinal, escolha um resultado relevante e abra o vídeo com reprodução automática.
5. Se escolher VLibras, abra o widget e prepare o sinal solicitado.
6. Depois da demonstração, pergunte se ele quer tentar fazer o sinal.
7. Quando o aluno aceitar, use iniciarPratica e aguarde o resultado da câmera.
8. Quando receber o resultado da prática, explique o que ficou bom e o que precisa melhorar. Nunca reduza a avaliação a apenas "certo" ou "errado".
9. Se a confiança for baixa, diga exatamente qual aspecto precisa ser repetido: configuração da mão, orientação, posição, movimento ou ritmo.
10. O usuário pode pedir outro exemplo ou trocar YouTube/VLibras a qualquer momento.
11. Seja conciso: isto é uma conversa falada em tempo real.
12. Não invente sinais nem resultados de reconhecimento.

FERRAMENTAS:
- buscarSinal: pesquisa os vídeos disponíveis para um sinal.
- mostrarNoYouTube: abre o vídeo escolhido e tenta iniciar o autoplay.
- mostrarNoVLibras: abre o widget VLibras e prepara a palavra/sinal solicitado.
- iniciarPratica: abre a prática com câmera frontal para o sinal.
- encerrarTutorLibras: encerra a sessão de voz.\`;

function buildTools() {
  return [{
    functionDeclarations: [
      {
        name: 'buscarSinal',
        description: 'Pesquisa vídeos do sinal solicitado usando o pesquisador de sinais existente.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: { sinal: { type: 'STRING', description: 'Palavra ou sinal a pesquisar.' } },
          required: ['sinal'],
        },
      },
      {
        name: 'mostrarNoYouTube',
        description: 'Abre o vídeo escolhido para demonstração e tenta reproduzi-lo automaticamente.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            sinal: { type: 'STRING' },
            videoId: { type: 'STRING' },
          },
          required: ['sinal', 'videoId'],
        },
      },
      {
        name: 'mostrarNoVLibras',
        description: 'Abre o widget VLibras para demonstrar o sinal solicitado.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: { sinal: { type: 'STRING' } },
          required: ['sinal'],
        },
      },
      {
        name: 'iniciarPratica',
        description: 'Abre a prática do sinal e ativa a câmera frontal para o usuário fazer o sinal.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: { sinal: { type: 'STRING' } },
          required: ['sinal'],
        },
      },
      {
        name: 'encerrarTutorLibras',
        description: 'Encerra a sessão de voz do Tutor de Libras.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
    ],
  }];
}

export function useLibrasVoiceTutor(bridge: LibrasVoiceTutorBridge) {
  const bridgeRef = useRef(bridge);
  const lastPracticeResultRef = useRef('');

  useEffect(() => {
    bridgeRef.current = bridge;
  }, [bridge]);

  const executeTool: ExecuteToolFn = useCallback(async (name, args, setActionLabel) => {
    const ctx = bridgeRef.current;

    switch (name) {
      case 'buscarSinal': {
        const sinal = String(args.sinal || '').trim();
        if (!sinal) return { success: false, error: 'Sinal não informado.' };
        setActionLabel('Pesquisando sinais…');
        const response = await fetch(\`/api/libras/search?q=\${encodeURIComponent(sinal)}&limit=3\`);
        const data = await response.json();
        if (!response.ok) return { success: false, error: data.error || 'Falha ao pesquisar sinais.' };

        const videos = (data.phraseResults || data.results || []).slice(0, 3);
        return {
          success: true,
          sinal,
          videos: videos.map((v: LibrasVoiceTutorState['videos'][number]) => ({
            videoId: v.videoId,
            title: v.title,
            channel: v.channel,
            thumbnail: v.thumbnail,
            url: v.url,
          })),
          message: videos.length
            ? \`Encontrei \${videos.length} demonstrações para \${sinal}.\`
            : \`Não encontrei vídeos para \${sinal}.\`,
        };
      }

      case 'mostrarNoYouTube': {
        const sinal = String(args.sinal || '').trim();
        const videoId = String(args.videoId || '').trim();
        if (!sinal || !videoId) return { success: false, error: 'Sinal ou vídeo não informado.' };
        setActionLabel('Abrindo demonstração no YouTube…');
        const result = {
          videoId,
          title: '',
          channel: '',
          thumbnail: '',
          url: \`https://www.youtube.com/watch?v=\${videoId}\`,
        };
        ctx.onDemonstration('youtube', sinal, result);
        return { success: true, message: 'Demonstração do YouTube aberta e configurada para reprodução.' };
      }

      case 'mostrarNoVLibras': {
        const sinal = String(args.sinal || '').trim();
        if (!sinal) return { success: false, error: 'Sinal não informado.' };
        setActionLabel('Abrindo VLibras…');
        ctx.onVlibras(sinal);
        return {
          success: true,
          message: 'Widget VLibras aberto para a demonstração do sinal.',
        };
      }

      case 'iniciarPratica': {
        const sinal = String(args.sinal || '').trim();
        if (!sinal) return { success: false, error: 'Sinal não informado.' };
        setActionLabel('Preparando câmera…');
        ctx.onPractice(sinal);
        return {
          success: true,
          message: \`Prática de \${sinal} aberta. A câmera frontal será usada para analisar o movimento.\`,
        };
      }

      case 'encerrarTutorLibras':
        return { success: true, message: 'Sessão encerrada.' };

      default:
        return { success: false, error: \`Ferramenta desconhecida: \${name}\` };
    }
  }, []);

  const config = useMemo(() => ({
    id: 'libras',
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: buildTools(),
    temperature: 0.35,
    thinkingLevel: 'LOW' as const,
    labels: {
      obtainingToken: 'Obtendo voz…',
      connecting: 'Conectando Tutor Libras…',
      configuring: 'Configurando Tutor Libras…',
      ready: 'Pronto • fale com o Tutor',
      listening: 'Ouvindo…',
      thinking: 'Pensando…',
    },
    logPrefix: 'LibrasVoiceTutor',
  }), []);

  const session = useLiveSession({ config, executeTool });

  useEffect(() => {
    const onPracticeResult = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.recognition || !detail?.evaluation) return;
      const key = JSON.stringify({
        attempt: detail.attempt,
        candidate: detail.recognition.candidateLabel,
      });
      if (key === lastPracticeResultRef.current) return;
      lastPracticeResultRef.current = key;

      const r = detail.recognition;
      const e = detail.evaluation;
      session.sendText?.(
        \`Resultado da prática do sinal "\${r.candidateLabel}": confiança=\${r.confidence}; distância=\${r.distance}; formato da mão=\${e.handShape}%; movimento=\${e.motion}%; orientação=\${e.orientation}%; posição relativa=\${e.relativePosition}%; lateralidade=\${e.handednessMatch ? 'compatível' : 'incompatível'}; ritmo=\${e.timingQuality}%. Explique o feedback ao aluno de forma curta e prática.\`
      );
    };

    window.addEventListener('libras:practice-result', onPracticeResult);
    return () => window.removeEventListener('libras:practice-result', onPracticeResult);
  }, [session.sendText]);

  return session;
}
