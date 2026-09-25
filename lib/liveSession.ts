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
  /** Identificador do agente dono desta persona (ex.: 'global' | 'tutor'). */
  id?: string;
  systemInstruction: string;
  tools: Array<{ functionDeclarations: unknown[] }>;
  temperature: number;
  thinkingLevel: LiveThinkingLevel;
  labels: LiveSessionLabels;
  logPrefix?: string;
}

export interface LiveConnectOptions {
  /**
   * Handle de session resumption de uma sessão anterior (inclusive de OUTRO
   * agente). Retomar com config nova troca systemInstruction/tools mantendo o
   * contexto conversacional — é o mecanismo documentado de "trocar de agente"
   * no meio da sessão (live.md#sessions).
   */
  resumeHandle?: string | null;
  /** Mensagem de transição injetada via clientContent após o setupComplete. */
  transitionText?: string;
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

const SETUP_TIMEOUT_MS = 10_000;

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
  const stateRef = useRef(state);
  const setupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Último handle de session resumption recebido do servidor (2h de validade). */
  const resumptionHandleRef = useRef<string | null>(null);
  /** Handle a usar no próximo setup (venha de switch de agente ou reconnect). */
  const pendingResumeHandleRef = useRef<string | null>(null);
  /** Texto de transição a injetar via clientContent quando o setup completar. */
  const pendingTransitionRef = useRef<string | null>(null);
  /** true enquanto uma sessão ainda não completou o setup (evita falso "connected"). */
  const setupCompletedRef = useRef(false);
  /** true enquanto uma tool está executando (impede o label da tool de ser
   *  sobrescrito por "Pensando…" no meio da execução). */
  const toolBusyRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearSetupTimeout = useCallback(() => {
    if (setupTimeoutRef.current) {
      clearTimeout(setupTimeoutRef.current);
      setupTimeoutRef.current = null;
    }
  }, []);

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
    clearSetupTimeout();
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
  }, [clearSetupTimeout]);

  useEffect(() => {
    return () => {
      clearSetupTimeout();
      disconnect();
    };
  }, [disconnect, clearSetupTimeout]);

  /**
   * Abre o socket + setup. Usado por connect() e pela troca de persona
   * (switch de agente no meio da sessão via session resumption).
   */
  const openSocket = useCallback(
    async (options?: LiveConnectOptions) => {
      const isSwitch = stateRef.current.isConnected;
      pendingResumeHandleRef.current = options?.resumeHandle ?? null;
      pendingTransitionRef.current = options?.transitionText ?? null;
      setupCompletedRef.current = false;

      setState((prev) => ({
        ...prev,
        isConnecting: true,
        // Durante handoff de agente mantém isConnected para a orb não cair
        isConnected: isSwitch || prev.isConnected,
        status: 'connecting' as LiveStatus,
        errorMessage: null,
        currentActionLabel: configRef.current.labels.obtainingToken ?? DEFAULT_LABELS.obtainingToken,
      }));

      // Reinicia captação de áudio da sessão anterior (se houver)
      if (streamerRef.current) {
        try {
          streamerRef.current.dispose();
        } catch {
          // ignore
        }
        streamerRef.current = null;
      }

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

          const resumeHandle = pendingResumeHandleRef.current;
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
              // Session resumption: permite trocar systemInstruction/tools na
              // reconexão mantendo o contexto (live.md#sessions).
              sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  silenceDurationMs: 2000,
                  prefixPaddingMs: 500,
                  endOfSpeechSensitivity: 'END_SENSITIVITY_UNSPECIFIED',
                  startOfSpeechSensitivity: 'START_SENSITIVITY_UNSPECIFIED',
                },
                activityHandling: 'ACTIVITY_HANDLING_UNSPECIFIED',
                turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
              },
            },
          };

          ws.send(JSON.stringify(setupMsg));

          setupTimeoutRef.current = setTimeout(() => {
            if (!setupCompletedRef.current) {
              const prefix = configRef.current.logPrefix || 'Live';
              console.error(`[${prefix}] Setup timeout: setupComplete não recebido em 10s`);
              setState((prev) => ({
                ...prev,
                isConnecting: false,
                isConnected: false,
                status: 'error',
                errorMessage: 'Tempo esgotado aguardando configuração da voz com o Gemini.',
              }));
              try {
                ws.close();
              } catch {
                // ignore
              }
            }
          }, SETUP_TIMEOUT_MS);
        };

        ws.onmessage = async (event) => {
          if (wsRef.current !== ws) return; // socket antigo (pós-troca) é ignorado
          try {
            const rawData = event.data instanceof Blob ? await event.data.text() : event.data;
            if (typeof rawData !== 'string') return;
            const msg = JSON.parse(rawData);
            const labelsNow = configRef.current.labels;

            if (msg.error) {
              const errDetail =
                msg.error.message || msg.error.code || JSON.stringify(msg.error);
              const prefix = configRef.current.logPrefix || 'Live';
              console.error(`[${prefix}] Setup/server error:`, errDetail);
              clearSetupTimeout();
              setState((prev) => ({
                ...prev,
                isConnecting: false,
                isConnected: false,
                status: 'error',
                errorMessage: `Gemini recusou a sessão de voz: ${errDetail}`,
                currentActionLabel: null,
              }));
              try {
                ws.close();
              } catch {
                // ignore
              }
              return;
            }

            // Handle de resumption (usado para trocar de persona/retomar depois)
            const resumption = msg.sessionResumptionUpdate;
            if (resumption) {
              if (resumption.resumable && resumption.newHandle) {
                resumptionHandleRef.current = resumption.newHandle;
              }
            }

            if (msg.setupComplete) {
              clearSetupTimeout();
              setupCompletedRef.current = true;
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

              // Injeta a transição de agente via clientContent (papel "user")
              const transition = pendingTransitionRef.current;
              if (transition) {
                pendingTransitionRef.current = null;
                ws.send(
                  JSON.stringify({
                    clientContent: {
                      turns: { role: 'user', parts: [{ text: transition }] },
                      turnComplete: true,
                    },
                  })
                );
              }
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
              // Fim do turno: o label da tool expirou — sem isso ele fica
              // "Consultando data local" eternamente enquanto o app ouve.
              setActionLabel(null);
              if (!streamer.getIsPlaying()) {
                setStatus('listening');
              }
            }

            const interactionStatus = msg.serverContent?.interactionStatus;
            if (interactionStatus === 'IN_PROGRESS') {
              setStatus('thinking');
              // Durante a execução de uma tool, o label dela manda.
              if (!toolBusyRef.current) {
                setActionLabel(labelsNow.thinking ?? DEFAULT_LABELS.thinking);
              }
            } else if (interactionStatus === 'IDLE' && !streamer.getIsPlaying()) {
              setStatus('listening');
              setActionLabel(labelsNow.listening ?? DEFAULT_LABELS.listening);
            }

            if (msg.toolCall?.functionCalls) {
              setStatus('thinking');
              toolBusyRef.current = true;
              const functionResponses = [];
              for (const call of msg.toolCall.functionCalls) {
                const { name, args, id } = call;
                // Uma tool que lança exceção SEMPRE precisa devolver resposta:
                // sem functionResponse o modelo fica sem retorno e inventa
                // um "houve um erro técnico" para o usuário.
                let output: unknown;
                try {
                  output = await executeToolRef.current(name, args || {}, setActionLabel);
                } catch (toolErr) {
                  const prefix = configRef.current.logPrefix || 'Live';
                  console.error(`[${prefix}] Tool ${name} falhou:`, toolErr);
                  output = {
                    success: false,
                    error:
                      toolErr instanceof Error
                        ? toolErr.message
                        : 'Erro interno ao executar a ferramenta.',
                  };
                }
                functionResponses.push({ response: { output }, id });
              }
              toolBusyRef.current = false;
              setActionLabel(labelsNow.thinking ?? DEFAULT_LABELS.thinking);
              ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
            }
          } catch (err) {
            const prefix = configRef.current.logPrefix || 'Live';
            console.error(`[${prefix}] Error handling message:`, err);
          }
        };

        ws.onerror = (err) => {
          if (wsRef.current !== ws) return;
          const prefix = configRef.current.logPrefix || 'Live';
          console.error(`[${prefix}] WebSocket error:`, err);
          clearSetupTimeout();
          setState((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
            status: 'error',
            errorMessage: 'Erro na conexão de voz com o Gemini.',
          }));
        };

        ws.onclose = (event) => {
          if (wsRef.current !== ws) return; // close do socket anterior (troca de agente)
          clearSetupTimeout();
          const prefix = configRef.current.logPrefix || 'Live';
          if (event.code !== 1000 || event.reason) {
            console.warn(
              `[${prefix}] WebSocket closed: code=${event.code} reason=${event.reason || '(sem motivo)'}`
            );
          }
          setState((prev) => {
            if (prev.status === 'error') return prev;
            return {
              ...prev,
              isConnected: false,
              isConnecting: false,
              status: 'idle',
              currentActionLabel: null,
              userVolume: 0,
              agentVolume: 0,
            };
          });
          if (streamerRef.current) {
            streamerRef.current.stopRecording();
            streamerRef.current.stopPlayback();
          }
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Falha ao iniciar conversa de voz';
        clearSetupTimeout();
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: false,
          status: 'error',
          errorMessage: msg,
          currentActionLabel: null,
        }));
      }
    },
    [setActionLabel, setStatus, clearSetupTimeout]
  );

  const connect = useCallback(
    (options?: LiveConnectOptions) => {
      if (state.isConnected || state.isConnecting) return;
      void openSocket(options);
    },
    [state.isConnected, state.isConnecting, openSocket]
  );

  /**
   * Troca de persona/agentes mantendo a sessão viva na UI: fecha o socket
   * atual, retoma com o handle de resumption (de qualquer agente) e o NOVO
   * systemInstruction/tools. A orb não desligue no meio.
   */
  const switchPersona = useCallback(
    (options: LiveConnectOptions = {}) => {
      const handle = options.resumeHandle ?? resumptionHandleRef.current;
      if (wsRef.current) {
        const old = wsRef.current;
        wsRef.current = null; // impede que onclose/onerror do antigo resetem o estado
        try {
          old.close();
        } catch {
          // ignore
        }
      }
      void openSocket({
        resumeHandle: handle,
        transitionText: options.transitionText,
      });
    },
    [openSocket]
  );

  /** Handle atual de resumption (para repassar a outro agente no hub). */
  const getResumptionHandle = useCallback(() => resumptionHandleRef.current, []);

  /** Zera o contexto retomado (usado quando o usuário desconecta manualmente). */
  const clearResumption = useCallback(() => {
    resumptionHandleRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const toggleConnection = useCallback(() => {
    if (state.isConnected || state.isConnecting) {
      disconnect();
    } else {
      void openSocket();
    }
  }, [state.isConnected, state.isConnecting, disconnect, openSocket]);

  return {
    state,
    connect,
    disconnect,
    switchPersona,
    getResumptionHandle,
    clearResumption,
    toggleMute,
    toggleConnection,
    setActionLabel,
    setStatus,
  };
}
