'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioStreamer } from '@/lib/audioStreamer';
import { LIVE_MODEL_ID } from '@/lib/liveConfig';
import type { AvaliacaoResultado } from '@/lib/tutor/types';

export interface TutorLiveState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  errorMessage: string | null;
  lastAgentTranscript: string;
  currentActionLabel: string | null;
  userVolume: number;
  agentVolume: number;
}

/**
 * Callbacks que o TutorInteligente injeta para que o Live
 * orquestre a sessão (o estado continua no useTutorSession).
 */
export interface TutorLiveBridgeContext {
  startSession: (tema: string, subtema?: string) => Promise<{
    success: boolean;
    question?: string;
    message: string;
  }>;
  getCurrentQuestion: () => Promise<{
    success: boolean;
    question?: string;
    message: string;
  }>;
  submitAnswer: (answerText: string) => Promise<{
    success: boolean;
    statusGeral?: string;
    feedbackOral?: string;
    avaliacao?: AvaliacaoResultado;
    message: string;
  }>;
  advance: () => Promise<{ success: boolean; message: string }>;
  endSession: () => Promise<{ success: boolean; message: string }>;
}

const INITIAL_STATE: TutorLiveState = {
  isConnected: false,
  isConnecting: false,
  isMuted: false,
  status: 'idle',
  errorMessage: null,
  lastAgentTranscript: '',
  currentActionLabel: null,
  userVolume: 0,
  agentVolume: 0,
};

function buildSystemInstruction(): string {
  return `Você é o Tutor Oral de Revisão do aplicativo Agronômica N-Pro — uma monitoria particular de agronomia e ciências agrárias.
Sua voz oficial é 'Puck'. Fale português do Brasil com naturalidade, clareza e encorajamento.

REGRAS DE COMPORTAMENTO:
1. Você NÃO entrega a resposta pronta antes de o aluno tentar.
2. Faça UMA pergunta por vez. Após a resposta, use a ferramenta 'submitAnswer' e narre o feedback retornado (statusGeral + feedbackOral).
3. Se o aluno disser "não sei", dê uma dica curta relacionada ao conceito e incentive nova tentativa — não revele o gabarito.
4. Após feedback, ofereça a próxima questão ou encerre com 'endSession'.
5. Para iniciar uma sessão use 'startTutorSession' com o tema escolhido pelo usuário (ex: "Fertilidade do Solo", subtema "Calagem").
6. Para reperguntar a questão atual use 'getCurrentQuestion'.
7. Seja conciso: conversa falada em tempo real.
8. Quando o feedback indicar "dominou", parabene e suba a dificuldade naturalmente na próxima questão.
9. Quando indicar "revisar", explique o que faltou com base no feedback, não com textão.

Fluxo típico:
- Usuário: "Quero revisar calagem" → startTutorSession(tema="Fertilidade do Solo", subtema="Calagem") → leia a questão devolvida e faça a pergunta.
- Usuário responde → submitAnswer → narre feedbackOral + diga o status (dominou/parcial/precisa revisar).
- Próxima → advance → nova questão → repita.

Sempre que receber o resultado de uma ferramenta, transforme em fala natural de tutor, não leia JSON.`;
}

function buildTools() {
  return [
    {
      functionDeclarations: [
        {
          name: 'startTutorSession',
          description: 'Inicia uma sessão de revisão oral para um tema de agronomia. Carrega questões e devolve a primeira pergunta.',
          behavior: 'NON_BLOCKING',
          parameters: {
            type: 'OBJECT',
            properties: {
              tema: { type: 'STRING', description: 'Tema principal (ex: Fertilidade do Solo)' },
              subtema: { type: 'STRING', description: 'Subtema opcional (ex: Calagem)' },
            },
            required: ['tema'],
          },
        },
        {
          name: 'getCurrentQuestion',
          description: 'Retorna o enunciado da questão atual da sessão.',
          behavior: 'NON_BLOCKING',
          parameters: { type: 'OBJECT', properties: {} },
        },
        {
          name: 'submitAnswer',
          description: 'Avalia semanticamente a resposta do aluno em 4 dimensões e devolve feedback oral.',
          behavior: 'NON_BLOCKING',
          parameters: {
            type: 'OBJECT',
            properties: {
              answerText: { type: 'STRING', description: 'Resposta do aluno (transcrita ou para você narrar o contexto)' },
            },
            required: ['answerText'],
          },
        },
        {
          name: 'advance',
          description: 'Pede a próxima questão adaptativa da sessão.',
          behavior: 'NON_BLOCKING',
          parameters: { type: 'OBJECT', properties: {} },
        },
        {
          name: 'endSession',
          description: 'Encerra a sessão de revisão e grava o progresso final.',
          behavior: 'NON_BLOCKING',
          parameters: { type: 'OBJECT', properties: {} },
        },
      ],
    },
  ];
}

export function useTutorLiveAgent(bridge: TutorLiveBridgeContext) {
  const [state, setState] = useState<TutorLiveState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const bridgeRef = useRef(bridge);
  const isMutedRef = useRef(state.isMuted);

  useEffect(() => {
    bridgeRef.current = bridge;
  }, [bridge]);

  useEffect(() => {
    isMutedRef.current = state.isMuted;
  }, [state.isMuted]);

  const setStatus = useCallback((status: TutorLiveState['status']) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const setActionLabel = useCallback((label: string | null) => {
    setState((prev) => ({ ...prev, currentActionLabel: label }));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    if (streamerRef.current) {
      streamerRef.current.dispose();
      streamerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      status: 'idle',
      currentActionLabel: null,
      userVolume: 0,
      agentVolume: 0,
    }));
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleExecuteTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      const ctx = bridgeRef.current;
      switch (name) {
        case 'startTutorSession': {
          setActionLabel('Iniciando sessão de revisão…');
          const tema = String(args.tema || '');
          const subtema = args.subtema ? String(args.subtema) : undefined;
          if (!tema) return { success: false, error: 'Informe o tema.' };
          return ctx.startSession(tema, subtema);
        }
        case 'getCurrentQuestion': {
          setActionLabel('Lendo questão atual…');
          return ctx.getCurrentQuestion();
        }
        case 'submitAnswer': {
          setActionLabel('Avaliando resposta…');
          const answerText = String(args.answerText || '');
          if (!answerText.trim()) return { success: false, error: 'Resposta vazia.' };
          return ctx.submitAnswer(answerText);
        }
        case 'advance': {
          setActionLabel('Próxima questão…');
          return ctx.advance();
        }
        case 'endSession': {
          setActionLabel('Encerrando sessão…');
          return ctx.endSession();
        }
        default:
          return { error: `Ferramenta ${name} não reconhecida.` };
      }
    },
    [setActionLabel]
  );

  const connect = useCallback(async () => {
    setState((prev) => {
      if (prev.isConnected || prev.isConnecting) return prev;
      return {
        ...prev,
        isConnecting: true,
        status: 'connecting',
        errorMessage: null,
        currentActionLabel: 'Obtendo credencial de voz…',
      };
    });

    try {
      const tokenRes = await fetch('/api/gemini/live-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao solicitar conexão com o Gemini');
      }
      const { token, wsBaseUrl } = await tokenRes.json();
      if (!token) throw new Error('Token de voz não retornado pelo servidor.');

      setActionLabel('Conectando ao Gemini Live…');
      const streamer = new AudioStreamer();
      streamerRef.current = streamer;

      const fullWsUrl = `${wsBaseUrl}?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setActionLabel('Configurando tutor oral…');
        const setupMsg = {
          setup: {
            model: LIVE_MODEL_ID,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.4,
              thinkingConfig: {
                thinkingLevel: 'high',
              },
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
              },
            },
            systemInstruction: {
              parts: [{ text: buildSystemInstruction() }],
            },
            tools: buildTools(),
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                silenceDurationMs: 1500,
                prefixPaddingMs: 400,
                endOfSpeechSensitivity: 'END_OF_SPEECH_SENSITIVITY_UNSPECIFIED' as never,
                startOfSpeechSensitivity: 'START_OF_SPEECH_SENSITIVITY_HIGH' as never,
              },
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS' as never,
              turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY' as never,
            },
            sessionResumption: { transparent: true },
          },
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event) => {
        try {
          const rawData = event.data instanceof Blob ? await event.data.text() : event.data;
          if (typeof rawData !== 'string') return;
          const msg = JSON.parse(rawData);

          if (msg.setupComplete) {
            setState((prev) => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              status: 'listening',
              currentActionLabel: 'Tutor pronto • Pode falar',
            }));

            await streamer.startRecording(
              (base64Pcm) => {
                if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
                  ws.send(
                    JSON.stringify({
                      realtimeInput: {
                        audio: {
                          mimeType: 'audio/pcm;rate=16000',
                          data: base64Pcm,
                        },
                      },
                    })
                  );
                }
              },
              (userVol) => setState((prev) => ({ ...prev, userVolume: userVol })),
              (agentVol) => setState((prev) => ({ ...prev, agentVolume: agentVol }))
            );
          }

          const parts = msg.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                setStatus('speaking');
                await streamer.playPcmChunk(part.inlineData.data);
              }
              if (part.text) {
                setState((prev) => ({ ...prev, lastAgentTranscript: part.text }));
              }
            }
          }

          if (msg.serverContent?.interrupted) {
            streamer.stopPlayback();
            setStatus('listening');
            setActionLabel('Ouvindo…');
          }

          if (msg.serverContent?.turnComplete) {
            if (!streamer.getIsPlaying()) {
              setStatus('listening');
            }
          }

          const interactionStatus = msg.serverContent?.interactionStatus;
          if (interactionStatus === 'IN_PROGRESS') {
            setStatus('thinking');
            setActionLabel('Pensando…');
          } else if (interactionStatus === 'IDLE' && !streamer.getIsPlaying()) {
            setStatus('listening');
            setActionLabel('Ouvindo…');
          }

          if (msg.toolCall?.functionCalls) {
            setStatus('thinking');
            const functionResponses = [];
            for (const call of msg.toolCall.functionCalls) {
              const { name, args, id } = call;
              const result = await handleExecuteTool(name, args || {});
              functionResponses.push({ response: { output: result }, id });
            }
            ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
          }
        } catch (err) {
          console.error('[TutorLive] Error handling message:', err);
        }
      };

      ws.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Erro na conexão de voz com o Gemini.',
        }));
      };

      ws.onclose = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          status: 'idle',
          currentActionLabel: null,
          userVolume: 0,
          agentVolume: 0,
        }));
        if (streamerRef.current) {
          streamerRef.current.stopRecording();
          streamerRef.current.stopPlayback();
        }
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao iniciar conversa de voz';
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        status: 'error',
        errorMessage: msg,
        currentActionLabel: null,
      }));
    }
  }, [handleExecuteTool, setActionLabel, setStatus]);

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const toggleConnection = useCallback(() => {
    if (state.isConnected || state.isConnecting) {
      disconnect();
    } else {
      void connect();
    }
  }, [state.isConnected, state.isConnecting, disconnect, connect]);

  return {
    state,
    connect,
    disconnect,
    toggleMute,
    toggleConnection,
  };
}
