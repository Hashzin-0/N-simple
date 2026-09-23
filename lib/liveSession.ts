'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioStreamer } from '@/lib/audioStreamer';
import {
  LIVE_MODEL_ID,
  LIVE_VOICE_NAME,
  type LiveStatus,
  type LiveThinkingLevel,
} from '@/lib/liveConfig';

export interface LiveSessionState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: LiveStatus;
  errorMessage: string | null;
  lastAgentTranscript: string;
  currentActionLabel: string | null;
  userVolume: number;
  agentVolume: number;
}

export interface LiveSessionLabels {
  obtainingToken: string;
  connecting: string;
  configuring: string;
  ready: string;
  listening: string;
  thinking: string;
}

export interface LiveSessionConfig {
  systemInstruction: string;
  tools: Array<{ functionDeclarations: unknown[] }>;
  temperature: number;
  thinkingLevel: LiveThinkingLevel;
  labels: LiveSessionLabels;
  logPrefix?: string;
}

export type ExecuteToolFn = (
  name: string,
  args: Record<string, unknown>,
  setActionLabel: (label: string | null) => void
) => Promise<unknown>;

const DEFAULT_LABELS: LiveSessionLabels = {
  obtainingToken: 'Obtendo credencial de voz…',
  connecting: 'Conectando ao Gemini Live…',
  configuring: 'Configurando…',
  ready: 'Pronto • Pode falar',
  listening: 'Ouvindo…',
  thinking: 'Pensando…',
};

const INITIAL_STATE: LiveSessionState = {
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

export interface UseLiveSessionOptions {
  config: LiveSessionConfig;
  executeTool: ExecuteToolFn;
}

export function useLiveSession({ config, executeTool }: UseLiveSessionOptions) {
  const [state, setState] = useState<LiveSessionState>(INITIAL_STATE);

  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const isMutedRef = useRef(state.isMuted);
  const configRef = useRef(config);
  const executeToolRef = useRef(executeTool);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    executeToolRef.current = executeTool;
  }, [executeTool]);

  useEffect(() => {
    isMutedRef.current = state.isMuted;
  }, [state.isMuted]);

  const setStatus = useCallback((status: LiveStatus) => {
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

  const connect = useCallback(async () => {
    setState((prev) => {
      if (prev.isConnected || prev.isConnecting) return prev;
      const labels = configRef.current.labels;
      return {
        ...prev,
        isConnecting: true,
        status: 'connecting' as LiveStatus,
        errorMessage: null,
        currentActionLabel: labels.obtainingToken ?? DEFAULT_LABELS.obtainingToken,
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

      const labels = configRef.current.labels;
      setActionLabel(labels.connecting ?? DEFAULT_LABELS.connecting);

      const streamer = new AudioStreamer();
      streamerRef.current = streamer;

      const fullWsUrl = `${wsBaseUrl}?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const cfg = configRef.current;
        setActionLabel(cfg.labels.configuring ?? DEFAULT_LABELS.configuring);

        const setupMsg = {
          setup: {
            model: LIVE_MODEL_ID,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: cfg.temperature,
              thinkingConfig: {
                thinkingLevel: cfg.thinkingLevel,
              },
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: LIVE_VOICE_NAME,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: cfg.systemInstruction }],
            },
            tools: cfg.tools,
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                silenceDurationMs: 1500,
                prefixPaddingMs: 400,
                endOfSpeechSensitivity: 'END_OF_SPEECH_SENSITIVITY_UNSPECIFIED',
                startOfSpeechSensitivity: 'START_OF_SPEECH_SENSITIVITY_HIGH',
              },
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
              turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
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
          const labelsNow = configRef.current.labels;

          if (msg.setupComplete) {
            setState((prev) => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              status: 'listening',
              currentActionLabel: labelsNow.ready ?? DEFAULT_LABELS.ready,
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
            setActionLabel(labelsNow.listening ?? DEFAULT_LABELS.listening);
          }

          if (msg.serverContent?.turnComplete) {
            if (!streamer.getIsPlaying()) {
              setStatus('listening');
            }
          }

          const interactionStatus = msg.serverContent?.interactionStatus;
          if (interactionStatus === 'IN_PROGRESS') {
            setStatus('thinking');
            setActionLabel(labelsNow.thinking ?? DEFAULT_LABELS.thinking);
          } else if (interactionStatus === 'IDLE' && !streamer.getIsPlaying()) {
            setStatus('listening');
            setActionLabel(labelsNow.listening ?? DEFAULT_LABELS.listening);
          }

          if (msg.toolCall?.functionCalls) {
            setStatus('thinking');
            const functionResponses = [];
            for (const call of msg.toolCall.functionCalls) {
              const { name, args, id } = call;
              const result = await executeToolRef.current(name, args || {}, setActionLabel);
              functionResponses.push({ response: { output: result }, id });
            }
            ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
          }
        } catch (err) {
          const prefix = configRef.current.logPrefix || 'Live';
          console.error(`[${prefix}] Error handling message:`, err);
        }
      };

      ws.onerror = (err) => {
        const prefix = configRef.current.logPrefix || 'Live';
        console.error(`[${prefix}] WebSocket error:`, err);
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
  }, [setActionLabel, setStatus]);

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
    setActionLabel,
    setStatus,
  };
}
