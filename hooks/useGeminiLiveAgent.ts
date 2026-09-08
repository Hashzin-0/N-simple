'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioStreamer } from '@/lib/audioStreamer';
import { smoothScrollToSection, PageSection } from '@/lib/pageAutomator';
import { ABNTReference } from '@/lib/abnt/types';

export interface LiveAgentState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  errorMessage: string | null;
  lastUserTranscript: string;
  lastAgentTranscript: string;
  currentActionLabel: string | null;
  userVolume: number;
  agentVolume: number;
}

export interface SimulatorContext {
  yieldGoal: number;
  nRequirementPerBag: number;
  mosNContribution: number;
  soyNContribution: number;
  efficiency: number;
  baseDose: number;
  v4v6Percent: number;
  v8v10Percent: number;
  splitBase: 'dose_perdas' | 'necessidade_liquida';
  totalExtraction: number;
  liquidNeed: number;
  recommendedDose: number;
  selectedV4V6Val: number;
  selectedV8V10Val: number;
  sumOfSplits: number;
  onSetYieldGoal: (val: number) => void;
  onSetSoilParameters: (params: { mos?: number; soy?: number; efficiency?: number }) => void;
  onSetParceling: (params: { baseDose?: number; v4v6Percent?: number; v8v10Percent?: number }) => void;
  onLoadPreset: (presetId: string) => void;
  onSetITRParameters: (params: { vtn: number; areaTotal: number; areaTributavel?: number; areaAproveitavel?: number; areaUtilizada?: number }) => void;
  onSetABNTReference: (ref: { type: string; author: string; title: string; year: number; editor?: string; url?: string }) => void;
  onSetBibliographyReference: (ref: ABNTReference) => void;
}

export function useGeminiLiveAgent(simContext: SimulatorContext) {
  const [state, setState] = useState<LiveAgentState>({
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    status: 'idle',
    errorMessage: null,
    lastUserTranscript: '',
    lastAgentTranscript: '',
    currentActionLabel: null,
    userVolume: 0,
    agentVolume: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const simContextRef = useRef(simContext);
  const isMutedRef = useRef(state.isMuted);

  // Keep simulator context updated
  useEffect(() => {
    simContextRef.current = simContext;
  }, [simContext]);

  useEffect(() => {
    isMutedRef.current = state.isMuted;
  }, [state.isMuted]);

  const setStatus = useCallback((status: LiveAgentState['status']) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const setActionLabel = useCallback((label: string | null) => {
    setState((prev) => ({ ...prev, currentActionLabel: label }));
  }, []);

  // Disconnect WebSocket and microphone
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Execute function calling tools locally on the web app
  const handleExecuteTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    const ctx = simContextRef.current;

    switch (name) {
      case 'getUserLocalDateTime': {
        const now = new Date();
        const dateInfo = {
          iso: now.toISOString(),
          data_formatada: now.toLocaleDateString('pt-BR', { dateStyle: 'full' }),
          hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          dia_da_semana: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
          ano: now.getFullYear(),
          mes: now.toLocaleDateString('pt-BR', { month: 'long' }),
          fuso_horario: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        setActionLabel('Consultando data local');
        return { success: true, date: dateInfo };
      }

      case 'getCurrentSimulatorState': {
        setActionLabel('Lendo dados do simulador');
        return {
          success: true,
          inputs: {
            yieldGoal: ctx.yieldGoal,
            nRequirementPerBag: ctx.nRequirementPerBag,
            mosNContribution: ctx.mosNContribution,
            soyNContribution: ctx.soyNContribution,
            efficiency: ctx.efficiency,
            baseDose: ctx.baseDose,
            v4v6Percent: ctx.v4v6Percent,
            v8v10Percent: ctx.v8v10Percent,
            splitBase: ctx.splitBase,
          },
          results: {
            totalExtraction: ctx.totalExtraction,
            liquidNeed: ctx.liquidNeed,
            recommendedDose: ctx.recommendedDose,
            selectedV4V6Val: ctx.selectedV4V6Val,
            selectedV8V10Val: ctx.selectedV8V10Val,
            sumOfSplits: ctx.sumOfSplits,
            ureaBagsEquivalent: Number((ctx.recommendedDose / 22.5).toFixed(1)),
          },
        };
      }

      case 'setYieldGoal': {
        const goal = Number(args.yieldGoal);
        if (goal > 0) {
          setActionLabel(`Preenchendo Meta: ${goal} sc/ha`);
          // 1. Scroll to parameters section
          smoothScrollToSection('parametros', `Ajustando Meta: ${goal} sc/ha`);
          // 2. Update state
          ctx.onSetYieldGoal(goal);

          // 3. Automatically schedule scroll to results after a brief pause
          setTimeout(() => {
            smoothScrollToSection('resultados', 'Exibindo Nova Dose Recomendada');
          }, 1800);

          return {
            success: true,
            updatedYieldGoal: goal,
            message: `Produtividade atualizada para ${goal} sc/ha. A tela rolou para mostrar a alteração e o novo resultado.`,
          };
        }
        return { success: false, error: 'Valor de produtividade inválido.' };
      }

      case 'setSoilParameters': {
        const mos = args.mosNContribution !== undefined ? Number(args.mosNContribution) : undefined;
        const soy = args.soyNContribution !== undefined ? Number(args.soyNContribution) : undefined;
        const eff = args.efficiencyPercent !== undefined ? Number(args.efficiencyPercent) : undefined;

        setActionLabel('Preenchendo parâmetros de solo...');
        smoothScrollToSection('solo', 'Ajustando Solo & Eficiência');
        ctx.onSetSoilParameters({ mos, soy, efficiency: eff });

        setTimeout(() => {
          smoothScrollToSection('resultados', 'Resultado com Novo Histórico de Solo');
        }, 1800);

        return {
          success: true,
          updated: { mos, soy, efficiency: eff },
          message: 'Parâmetros de solo e eficiência atualizados.',
        };
      }

      case 'setFertilizerParceling': {
        const base = args.baseDose !== undefined ? Number(args.baseDose) : undefined;
        const v4v6 = args.v4v6Percent !== undefined ? Number(args.v4v6Percent) : undefined;
        const v8v10 = args.v8v10Percent !== undefined ? Number(args.v8v10Percent) : undefined;

        setActionLabel('Preenchendo parcelamento...');
        smoothScrollToSection('parcelamento', 'Ajustando Parcelamento');
        ctx.onSetParceling({ baseDose: base, v4v6Percent: v4v6, v8v10Percent: v8v10 });

        return {
          success: true,
          updated: { base, v4v6, v8v10 },
          message: 'Doses de parcelamento atualizadas e exibidas na tela.',
        };
      }



      case 'setITRParameters': {
        const vtn = args.vtn !== undefined ? Number(args.vtn) : 0;
        const areaTotal = args.areaTotal !== undefined ? Number(args.areaTotal) : 0;
        const areaTributavel = args.areaTributavel !== undefined ? Number(args.areaTributavel) : undefined;
        const areaAproveitavel = args.areaAproveitavel !== undefined ? Number(args.areaAproveitavel) : undefined;
        const areaUtilizada = args.areaUtilizada !== undefined ? Number(args.areaUtilizada) : undefined;

        setActionLabel('Preenchendo parâmetros do ITR...');
        smoothScrollToSection('itr', 'Ajustando Cálculo ITR');
        ctx.onSetITRParameters({ vtn, areaTotal, areaTributavel, areaAproveitavel, areaUtilizada });

        return {
          success: true,
          updated: { vtn, areaTotal, areaTributavel, areaAproveitavel, areaUtilizada },
          message: 'Parâmetros do ITR atualizados e exibidos na tela.',
        };
      }

      case 'setABNTReference': {
        const type = args.type !== undefined ? String(args.type) : 'livro';
        const author = args.author !== undefined ? String(args.author) : '';
        const title = args.title !== undefined ? String(args.title) : '';
        const year = args.year !== undefined ? Number(args.year) : new Date().getFullYear();
        const editor = args.editor !== undefined ? String(args.editor) : undefined;
        const url = args.url !== undefined ? String(args.url) : undefined;

        setActionLabel('Preenchendo referência ABNT...');
        smoothScrollToSection('abnt', 'Ajustando Referência ABNT');
        ctx.onSetABNTReference({ type, author, title, year, editor, url });

        return {
          success: true,
          updated: { type, author, title, year, editor, url },
          message: 'Referência ABNT atualizada e exibida na tela.',
        };
      }

      case 'setBibliographyReference': {
        const ref = args.ref as ABNTReference;
        setActionLabel('Preenchendo referência da bibliografia...');
        smoothScrollToSection('abnt', 'Ajustando Referência Bibliográfica');
        ctx.onSetBibliographyReference(ref);

        return {
          success: true,
          updated: { type: ref.type, title: ref.title, year: ref.year },
          message: 'Referência bibliográfica atualizada e exibida na tela.',
        };
      }

      case 'loadAgronomicPreset': {
        const presetId = String(args.presetId);
        setActionLabel(`Carregando preset: ${presetId}`);
        smoothScrollToSection('presets', `Preset ${presetId}`);
        ctx.onLoadPreset(presetId);

        setTimeout(() => {
          smoothScrollToSection('resultados', 'Resultados do Preset');
        }, 1800);

        return {
          success: true,
          presetId,
          message: `Preset ${presetId} aplicado. Tela rolada para o preset e para os resultados.`,
        };
      }

      case 'scrollToSection': {
        const section = String(args.section) as PageSection;
        const label = args.label ? String(args.label) : undefined;
        setActionLabel(`Rolando para: ${section}`);
        smoothScrollToSection(section, label);
        return { success: true, section };
      }

      case 'calculateCornYield': {
        const plantasPorMetro = Number(args.plantasPorMetro ?? 4.0);
        const espacamentoLinhas = Number(args.espacamentoLinhas ?? 0.50);
        const fileiras = Number(args.fileiras ?? 16);
        const graosPorFileira = Number(args.graosPorFileira ?? 35);
        const espigas = Number(args.espigas ?? 1.0);
        const pmg = Number(args.pmg ?? 300);
        let quebraDecimal = Number(args.quebraPercentual ?? 0.05);
        if (quebraDecimal > 1) {
          quebraDecimal = quebraDecimal / 100;
        }

        const estande = Number((plantasPorMetro / espacamentoLinhas * 10000).toFixed(2));
        const quantidadeGraos = Number((fileiras * graosPorFileira).toFixed(0));
        const pmgCorrigido = Number((pmg / 1000).toFixed(4));
        const kgHaBruta = Number(((estande * espigas * quantidadeGraos * pmgCorrigido) / 1000).toFixed(2));
        const scHaBruta = Number((kgHaBruta / 60).toFixed(2));
        const scHaLiquida = Number((scHaBruta * (1 - quebraDecimal)).toFixed(2));

        setActionLabel(`Produtividade: ${scHaLiquida} sc/ha`);
        smoothScrollToSection('estimativa_milho', `Estimativa Milho: ${scHaLiquida} sc/ha`);

        return {
          success: true,
          estande_populacao: estande,
          quantidade_graos: quantidadeGraos,
          pmg_convertido: pmgCorrigido,
          kg_ha_bruta: kgHaBruta,
          sc_ha_bruta: scHaBruta,
          sc_ha_liquida: scHaLiquida,
          quebra_percentual_aplicada: `${(quebraDecimal * 100).toFixed(1)}%`,
          message: `Estande: ${estande.toLocaleString('pt-BR')} pl/ha. Grãos por espiga: ${quantidadeGraos}. Produtividade bruta: ${scHaBruta} sc/ha (${kgHaBruta.toLocaleString('pt-BR')} kg/ha). Produtividade líquida: ${scHaLiquida} sc/ha. A tela foi rolada até a calculadora de produtividade.`,
        };
      }

      default:
        return { error: `Ferramenta ${name} não reconhecida.` };
    }
  }, [setActionLabel]);

  // Connect to Gemini Live API via Serverless Ephemeral Token
  const connect = useCallback(async () => {
    setState((prev) => {
      if (prev.isConnected || prev.isConnecting) return prev;
      return {
        ...prev,
        isConnecting: true,
        status: 'connecting',
        errorMessage: null,
        currentActionLabel: 'Obtendo credencial de voz...',
      };
    });

    try {
      // 1. Fetch ephemeral token from our serverless Next.js API route
      const tokenRes = await fetch('/api/gemini/live-token', {
        method: 'POST',
      });

      if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao solicitar conexão com o Gemini');
      }

      const { token, wsBaseUrl } = await tokenRes.json();
      if (!token) {
        throw new Error('Token de voz não retornado pelo servidor.');
      }

      setActionLabel('Conectando ao Gemini Live...');

      // 2. Initialize Web Audio Streamer
      const streamer = new AudioStreamer();
      streamerRef.current = streamer;

      // 3. Connect to Google Generative Language WebSocket
      const fullWsUrl = `${wsBaseUrl}?access_token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setActionLabel('Configurando assistente Puck...');

        // Build setup message with voice "Puck" and function declarations
        const setupMsg = {
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: `Você é o Engenheiro Agrônomo e Especialista em Nutrição de Milho Assistente por Voz do aplicativo 'Agronômica N-Pro'.
Sua voz oficial é 'Puck'.
Você fala em português do Brasil com naturalidade, clareza, simpatia e precisão técnica.

Suas capacidades:
1. Você tem acesso em tempo real à DATA e HORA local do usuário através da ferramenta 'getUserLocalDateTime'. Quando o usuário perguntar sobre data, que dia é hoje, época de plantio ou safra, use essa ferramenta.
2. Você tem acesso completo a TODAS as variáveis e cálculos agronômicos da tela pela ferramenta 'getCurrentSimulatorState'.
3. Você pode preencher e alterar parâmetros no simulador como se fosse o usuário (produtividade alvo, matéria orgânica do solo, crédito de N da soja, eficiência e parcelamento em base, V4-V6 e V8-V10).
4. Você também pode acessar a Calculadora ITR (Imposto Territorial Rural) com parâmetros de VTN, área total, área tributável, área aproveitável e área utilizada.
5. Você também pode acessar o Formatter de Referências ABNT com dados de tipo, autor, título, ano, editor e URL.
6. IMPORTANTE: Sempre que você alterar um valor no simulador (usando 'setYieldGoal', 'setSoilParameters', 'setFertilizerParceling', 'setITRParameters' ou 'setABNTReference'), o site rolará automaticamente para mostrar a alteração. Logo em seguida, quando você falar sobre os resultados da dose total e parcelamento, a tela rolará para a seção de resultados.
5. Você pode rolar a tela manualmente com 'scrollToSection' ('parametros', 'resultados', 'parcelamento', 'adubos', 'presets').

Fórmulas do simulador de Adubação Nitrogenada:
- Extração Total (kg N/ha) = Produtividade (sc/ha) × Exigência (ex: 1.35 kg N/sc)
- Necessidade Líquida (kg N/ha) = Extração Total - MOS (kg N/ha) - Crédito Soja (kg N/ha)
- Dose Total Recomendada com perdas (kg N/ha) = Necessidade Líquida ÷ (Eficiência ÷ 100)
- Parcelamento: Base (30-40 kg N/ha) na semeadura; Cobertura 1 em V4-V6 (50-60%); Cobertura 2 em V8-V10 (20-30%).
- 1 saca de Ureia (50 kg) contém 22.5 kg de N elementar (45% N).

Fórmulas da Calculadora de Estimativa de Produtividade de Milho:
- Estande (população) = contagem de plantas por metro ÷ espaçamento entre linhas (em metros) × 10.000
- Quantidade de grãos = fileiras × grãos/fileira
- PMG (em gramas por 1000 grãos) = valor da questão ÷ 1000 (para obter peso unitário em gramas)
- Produtividade Bruta (kg/ha) = estande × espigas × Quantidade de grãos × PMG ÷ 1000
- Produtividade Bruta (sc/ha) = kg/ha ÷ 60
- Produtividade Líquida (sc/ha) = sc/ha bruta × (1 - porcentagem de perda em decimal, ex: 0,85 para 15% de perda)
Use a ferramenta 'calculateCornYield' para calcular e rolar automaticamente até a calculadora de produtividade!

Sempre responda de forma concisa e direta, pois se trata de uma conversa falada em tempo real.`,
                },
              ],
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: 'calculateCornYield',
                    description: 'Calcula a estimativa de produtividade de milho baseada em estande (população), grãos por espiga, PMG e quebra (perdas), e rola a tela até a calculadora.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        plantasPorMetro: {
                          type: 'NUMBER',
                          description: 'Contagem de plantas por metro linear (ex: 4.0)',
                        },
                        espacamentoLinhas: {
                          type: 'NUMBER',
                          description: 'Espaçamento entre linhas em metros (ex: 0.50 para 50 cm)',
                        },
                        fileiras: {
                          type: 'NUMBER',
                          description: 'Número de fileiras por espiga (ex: 16)',
                        },
                        graosPorFileira: {
                          type: 'NUMBER',
                          description: 'Quantidade de grãos por fileira (ex: 35)',
                        },
                        espigas: {
                          type: 'NUMBER',
                          description: 'Espigas por fileira ou espigas por planta (ex: 1.0)',
                        },
                        pmg: {
                          type: 'NUMBER',
                          description: 'Peso de Mil Grãos dado na questão (ex: 300 para 300g)',
                        },
                        quebraPercentual: {
                          type: 'NUMBER',
                          description: 'Porcentagem de quebra ou perda (em decimal como 0.05 ou percentual como 5)',
                        },
                      },
                    },
                  },
                  {
                    name: 'getUserLocalDateTime',
                    description: 'Obtém a data e hora local atual do usuário, dia da semana, ano e fuso horário.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {},
                    },
                  },
                  {
                    name: 'getCurrentSimulatorState',
                    description: 'Retorna todos os valores e respostas dos cálculos atuais da calculadora de adubação nitrogenada.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {},
                    },
                  },
                  {
                    name: 'setYieldGoal',
                    description: 'Ajusta a meta de produtividade de milho em sacas por hectare (sc/ha). Rola a tela até o formulário de produtividade.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        yieldGoal: {
                          type: 'NUMBER',
                          description: 'Produtividade desejada em sc/ha (ex: 140, 160, 180)',
                        },
                      },
                      required: ['yieldGoal'],
                    },
                  },
                  {
                    name: 'setSoilParameters',
                    description: 'Ajusta a contribuição de N do solo (MOS), crédito da cultura anterior (soja) e/ou a eficiência de aproveitamento.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        mosNContribution: {
                          type: 'NUMBER',
                          description: 'Nitrogênio fornecido pela matéria orgânica do solo (kg N/ha, ex: 30)',
                        },
                        soyNContribution: {
                          type: 'NUMBER',
                          description: 'Crédito de nitrogênio da soja em sucessão (kg N/ha, ex: 20)',
                        },
                        efficiencyPercent: {
                          type: 'NUMBER',
                          description: 'Eficiência de aproveitamento do fertilizante em porcentagem (ex: 80 para 80%)',
                        },
                      },
                    },
                  },
                  {
                    name: 'setFertilizerParceling',
                    description: 'Ajusta a dose de base (semeadura) e os percentuais de cobertura em V4-V6 e V8-V10.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        baseDose: {
                          type: 'NUMBER',
                          description: 'Dose aplicada na base de plantio em kg N/ha (ex: 30)',
                        },
                        v4v6Percent: {
                          type: 'NUMBER',
                          description: 'Porcentagem aplicada no estádio V4-V6 (ex: 50)',
                        },
                        v8v10Percent: {
                          type: 'NUMBER',
                          description: 'Porcentagem aplicada no estádio V8-V10 (ex: 30)',
                        },
                      },
                    },
                  },
                  {
                    name: 'loadAgronomicPreset',
                    description: 'Carrega um cenário pré-configurado pronto.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        presetId: {
                          type: 'STRING',
                          description: 'Identificador do preset: "padrao", "alta_produtividade" ou "solo_arenoso"',
                        },
                      },
                      required: ['presetId'],
                    },
                  },
                  {
                    name: 'scrollToSection',
                    description: 'Rola suavemente a tela até uma seção específica para o usuário visualizar.',
                    parameters: {
                      type: 'OBJECT',
                      properties: {
                        section: {
                          type: 'STRING',
                          description: 'Seção de destino: "parametros", "resultados", "dose_total", "parcelamento", "presets"',
                        },
                        label: {
                          type: 'STRING',
                          description: 'Texto descritivo curto do que está sendo exibido',
                        },
                      },
                      required: ['section'],
                    },
                  },
                ],
              },
            ],
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                silenceDurationMs: 1500,
                prefixPaddingMs: 400,
                endOfSpeechSensitivity: 'END_SENSITIVITY_UNSPECIFIED',
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
              },
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
              turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY',
            },
            sessionResumption: {
              transparent: true,
            },
          },
        };

        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event) => {
        try {
          const rawData = event.data instanceof Blob ? await event.data.text() : event.data;
          if (typeof rawData !== 'string') return;
          const msg = JSON.parse(rawData);

          // 1. Setup Complete
          if (msg.setupComplete) {
            setState((prev) => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              status: 'listening',
              currentActionLabel: 'Puck pronto • Pode falar',
            }));

            // Start recording user audio
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
              (userVol) => {
                setState((prev) => ({ ...prev, userVolume: userVol }));
              },
              (agentVol) => {
                setState((prev) => ({ ...prev, agentVolume: agentVol }));
              }
            );
          }

          // 2. Audio chunks from Puck (Gemini Live output)
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

          // 3. User interrupted Puck
          if (msg.serverContent?.interrupted) {
            streamer.stopPlayback();
            setStatus('listening');
            setActionLabel('Ouvindo...');
          }

          // 4. Turn Complete
          if (msg.serverContent?.turnComplete) {
            if (!streamer.getIsPlaying()) {
              setStatus('listening');
            }
          }

          // 5. Tool Call (Function Calling from Voice Agent)
          if (msg.toolCall?.functionCalls) {
            setStatus('thinking');
            const functionResponses = [];

            for (const call of msg.toolCall.functionCalls) {
              const { name, args, id } = call;
              const result = await handleExecuteTool(name, args || {});
              functionResponses.push({
                response: { output: result },
                id,
              });
            }

            // Send tool response back to Gemini Live
            ws.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses,
                },
              })
            );
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Gemini Live WebSocket error:', err);
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

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  return {
    state,
    connect,
    disconnect,
    toggleMute,
  };
}
