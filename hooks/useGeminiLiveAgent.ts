'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { smoothScrollToSection, PageSection } from '@/lib/pageAutomator';
import { ABNTReference } from '@/lib/abnt/types';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import { voiceHub, type VoiceAgentRuntime } from '@/lib/voiceHub';

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
  onSetLiquidNeed: (val: number) => void;
  onSetParceling: (params: { baseDose?: number; v4v6Percent?: number; v8v10Percent?: number }) => void;
  onLoadPreset: (presetId: string) => void;
  onSetITRParameters: (params: { vtn: number; areaTotal: number; areaTributavel?: number; areaAproveitavel?: number; areaUtilizada?: number }) => void;
  onSetABNTReference: (ref: { type: string; author: string; title: string; year: number; editor?: string; url?: string }) => void;
  onSetBibliographyReference: (ref: ABNTReference) => void;
}

const GLOBAL_SYSTEM_INSTRUCTION = `Você é o Engenheiro Agrônomo e Especialista em Nutrição de Milho Assistente por Voz do aplicativo 'Agronômica N-Pro'.
Sua voz oficial é 'Puck'.
Você fala em português do Brasil com naturalidade, clareza, simpatia e precisão técnica.

Suas capacidades:
1. Você tem acesso em tempo real à DATA e HORA local do usuário através da ferramenta 'getUserLocalDateTime'. Quando o usuário perguntar sobre data, que dia é hoje, época de plantio ou safra, use essa ferramenta.
2. Você tem acesso completo a TODAS as variáveis e cálculos agronômicos da tela pela ferramenta 'getCurrentSimulatorState'.
3. Você pode preencher e alterar parâmetros no simulador como se fosse o usuário (produtividade alvo, matéria orgânica do solo, crédito de N da soja, eficiência e parcelamento em base, V4-V6 e V8-V10).
4. Você também pode acessar a Calculadora ITR (Imposto Territorial Rural) com parâmetros de VTN, área total, área tributável, área aproveitável e área utilizada.
5. Você também pode acessar o Formatter de Referências ABNT com dados de tipo, autor, título, ano, editor e URL.
6. IMPORTANTE: Sempre que você alterar um valor no simulador (usando 'setYieldGoal', 'setSoilParameters', 'setFertilizerParceling', 'setITRParameters' ou 'setABNTReference'), o site rolará automaticamente para mostrar a alteração. Logo em seguida, quando você falar sobre os resultados da dose total e parcelamento, a tela rolará para a seção de resultados.
7. Você pode rolar a tela manualmente com 'scrollToSection' ('parametros', 'resultados', 'parcelamento', 'adubos', 'presets').
8. Quando o usuário pedir para revisar, estudar, treinar com questões, fazer um simulado, seminário, mapa mental, flashcards ou falar com o Tutor, use a ferramenta 'chamarAgente' com alvo 'tutor'. Ela abre a aba do Tutor e transfere a sessão de voz para o Tutor de Revisão. Responda com uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — a partir de quem responde é ele.

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

Sempre responda de forma concisa e direta, pois se trata de uma conversa falada em tempo real.`;

const GLOBAL_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'calculateCornYield',
        description: 'Calcula a estimativa de produtividade de milho baseada em estande (população), grãos por espiga, PMG e quebra (perdas), e rola a tela até a calculadora.',
        behavior: 'NON_BLOCKING',
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
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'getCurrentSimulatorState',
        description: 'Retorna todos os valores e respostas dos cálculos atuais da calculadora de adubação nitrogenada.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'setYieldGoal',
        description: 'Ajusta a meta de produtividade de milho em sacas por hectare (sc/ha). Rola a tela até o formulário de produtividade.',
        behavior: 'NON_BLOCKING',
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
        behavior: 'NON_BLOCKING',
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
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            baseDose: {
              type: 'NUMBER',
              description: 'Dose aplicada na base de plantio em kg N/ha (ex: 30)',
            },
            v4v6Percent: {
              type: 'NUMBER',
              description: 'Percentual aplicada no estádio V4-V6 (ex: 50)',
            },
            v8v10Percent: {
              type: 'NUMBER',
              description: 'Percentual aplicada no estádio V8-V10 (ex: 30)',
            },
          },
        },
      },
      {
        name: 'loadAgronomicPreset',
        description: 'Carrega um cenário pré-configurado pronto.',
        behavior: 'NON_BLOCKING',
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
        behavior: 'NON_BLOCKING',
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
      {
        name: 'chamarAgente',
        description:
          'Transfere a conversa de voz para outro agente do aplicativo (ex: Tutor de Revisão). Use quando o usuário pedir para revisar, estudar, fazer questões, simulado ou falar com o tutor. A sessão continua viva e o novo agente assume a fala.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            alvo: {
              type: 'STRING',
              enum: ['tutor'],
              description: 'Agente de destino. Atualmente apenas "tutor".',
            },
            acao: {
              type: 'STRING',
              description:
                'O que o usuário quer revisar/estudar (ex: "revisão de calagem"). Vira o contexto inicial do tutor.',
            },
          },
          required: ['alvo'],
        },
      },
    ],
  },
];

const GLOBAL_CONFIG = {
  systemInstruction: GLOBAL_SYSTEM_INSTRUCTION,
  tools: GLOBAL_TOOLS,
  temperature: 0,
  thinkingLevel: 'low' as const,
  labels: {
    obtainingToken: 'Obtendo credencial de voz...',
    connecting: 'Conectando ao Gemini Live...',
    configuring: 'Configurando assistente Puck...',
    ready: 'Puck pronto • Pode falar',
    listening: 'Ouvindo…',
    thinking: 'Pensando…',
  },
  logPrefix: 'GeminiLive',
};

export function useGeminiLiveAgent(simContext: SimulatorContext) {
  const simContextRef = useRef(simContext);

  useEffect(() => {
    simContextRef.current = simContext;
  }, [simContext]);

  const executeTool: ExecuteToolFn = useCallback(async (name, args, setActionLabel) => {
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
          smoothScrollToSection('parametros', `Ajustando Meta: ${goal} sc/ha`);
          ctx.onSetYieldGoal(goal);

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

      case 'chamarAgente': {
        const alvo = String(args.alvo || 'tutor');
        if (alvo !== 'tutor') {
          return { success: true, message: 'Você já é o agente ativo.' };
        }
        const acao = args.acao ? String(args.acao) : undefined;
        setActionLabel('Transferindo para o Tutor…');
        const res = voiceHub.callAgent('tutor', {
          transitionText: acao
            ? `Atenção: a sessão foi transferida de outro assistente. O aluno quer revisar: ${acao}. Cumprimente e comece essa revisão.`
            : 'Atenção: a sessão foi transferida de outro assistente. Cumprimente o aluno e pergunte o que ele quer revisar.',
        });
        if (!res.ok) return { success: false, error: res.message };
        return {
          success: true,
          message:
            'Tutor de Revisão ativado. Diga uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — quem responde daqui para frente é o Tutor.',
        };
      }

      default:
        return { error: `Ferramenta ${name} não reconhecida.` };
    }
  }, []);

  const session = useLiveSession({
    config: GLOBAL_CONFIG,
    executeTool,
  });

  const state: LiveAgentState = {
    ...session.state,
    lastUserTranscript: '',
  };

  // ---- registro no hub de agentes de voz ----
  const stateRef = useRef(state);
  const lastNotifiedStateRef = useRef(state);
  const methodsRef = useRef({
    connect: session.connect,
    disconnect: session.disconnect,
    switchPersona: session.switchPersona,
    getResumptionHandle: session.getResumptionHandle,
    toggleMute: session.toggleMute,
  });

  useLayoutEffect(() => {
    stateRef.current = state;
    methodsRef.current = {
      connect: session.connect,
      disconnect: session.disconnect,
      switchPersona: session.switchPersona,
      getResumptionHandle: session.getResumptionHandle,
      toggleMute: session.toggleMute,
    };
    if (lastNotifiedStateRef.current !== state) {
      lastNotifiedStateRef.current = state;
      voiceHub.agentStateChanged();
    }
  });

  useEffect(() => {
    const runtime: VoiceAgentRuntime = {
      id: 'global',
      getState: () => stateRef.current,
      connect: () => methodsRef.current.connect(),
      disconnect: () => methodsRef.current.disconnect(),
      switchPersona: (options) =>
        methodsRef.current.switchPersona(
          options ? { resumeHandle: options.resumeHandle, transitionText: options.transitionText } : {}
        ),
      getResumptionHandle: () => methodsRef.current.getResumptionHandle(),
      toggleMute: () => methodsRef.current.toggleMute(),
    };
    voiceHub.register(runtime);
    return () => voiceHub.unregister('global');
  }, []);

  return {
    state,
    connect: session.connect,
    disconnect: session.disconnect,
    switchPersona: session.switchPersona,
    getResumptionHandle: session.getResumptionHandle,
    clearResumption: session.clearResumption,
    toggleMute: session.toggleMute,
    toggleConnection: session.toggleConnection,
  };
}
