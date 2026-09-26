'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  smoothScrollToSection,
  waitForElement,
  resolveSectionElementId,
  isPageSection,
} from '@/lib/pageAutomator';
import {
  describeSections,
  resolveSection,
  tabForSection,
} from '@/lib/sectionNav';
import type { ABNTReference, ReferenceType } from '@/lib/abnt/types';
import { REFERENCE_TYPES } from '@/lib/abnt/constants';
import { parseAuthorString } from '@/lib/abnt/parsers/author';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import { voiceHub, type VoiceAgentRuntime } from '@/lib/voiceHub';
import type { TabId } from '@/components/GooeyTabPanel';
import type { CornYieldFillParams } from '@/components/CornYieldCalculator';
import type { PesqSourcesReport, PesqArticleReport } from '@/components/PesquisadorAgro';
import type { FontesSearchProgress } from '@/components/PesquisadorAgro/PesquisadorFontesCard';
import type { RedacaoVoiceReport } from '@/components/PesquisadorRedacao';
import type { LibrasSubTab } from '@/components/LibrasNoAgro';
import { PRESET_FERTILIZERS, resolveFertilizerId } from '@/lib/fertilizers';
import { SQLikeCalculationDB, type CalculationRecord } from '@/lib/storage';
import { ALL_MODULES, MODULO_VOCABULARIO, MODULO_FRASES, AREAS } from '@/lib/libras-course-data';
import { loadTemplates } from '@/lib/libras-templates';
import type { Frase } from '@/lib/analiseMorfologica/types';
import { gerarFraseLocal } from '@/lib/analiseMorfologica/gerarLocal';
import { useTheme } from '@/components/ThemeProvider';
import { toggleWidgetSetting, toggleRecognitionSetting } from '@/hooks/useLibrasSettings';
import { applyNoiseGateToolArgs } from '@/lib/noiseGate';

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
  baseDose2: number;
  baseDoseMode: 'single' | 'range';
  v4v6Percent: number;
  v4v6Percent2: number;
  v8v10Percent: number;
  v8v10Percent2: number;
  splitBase: 'dose_perdas' | 'necessidade_liquida';
  useDirectInput: boolean;
  liquidNeedInput: number;
  efficiencyAlreadyApplied: boolean;
  activePreset: string;
  activeTab: TabId;
  fontePreset: string;
  fonteTeorN: number;
  totalExtraction: number;
  liquidNeed: number;
  recommendedDose: number;
  selectedV4V6Val: number;
  selectedV8V10Val: number;
  sumOfSplits: number;
  targetSplitTotal: number;
  splitDiscrepancy: number;
  onSetYieldGoal: (val: number) => void;
  onSetNRequirementPerBag: (val: number) => void;
  onSetSoilParameters: (params: { mos?: number; soy?: number; efficiency?: number }) => void;
  onSetLiquidNeed: (val: number) => void;
  onSetParceling: (params: { baseDose?: number; v4v6Percent?: number; v8v10Percent?: number }) => void;
  onSetSplitBase: (base: 'dose_perdas' | 'necessidade_liquida') => void;
  onLoadPreset: (presetId: string) => void;
  onNavigateTab: (tab: TabId) => void;
  onSetITRParameters: (params: { vtn: number; areaTotal: number; areaTributavel?: number; areaAproveitavel?: number; areaUtilizada?: number }) => void;
  onSetABNTReference: (ref: ABNTReference) => void;
  onSetFonteNitrogenada: (params: { preset: string; customTeorN?: number }) => void;
  onSetCornYield: (params: CornYieldFillParams, applyToNitrogen?: boolean) => void;
  onSalvarCenario: (nome: string, notas?: string) => { success: boolean; id?: string; error?: string };
  onCarregarCenario: (id: string) => { success: boolean; name?: string; error?: string };
  onRedefinir: () => void;
  // Pesquisador Agro
  pesqSourcesReport: PesqSourcesReport | null;
  pesqArticleReport: PesqArticleReport | null;
  onPesquisarFontes: (tema: string) => void;
  onGerarArtigo: (tema: string | undefined, mode?: 'padrao' | 'aprofundado') => void;
  // Pesquisador de Redação
  redacaoReq: { seq: number; action: 'pesquisar' | 'gerar' | 'validar' | 'recomecar'; tema?: string } | null;
  redacaoReport: RedacaoVoiceReport | null;
  onRedacaoAction: (action: 'pesquisar' | 'gerar' | 'validar' | 'recomecar', tema?: string) => void;
  // Libras no Agro
  onAbrirLibras: (subTab: LibrasSubTab) => void;
  onBuscarSinal: (palavra: string) => void;
  onIniciarPraticaLibras: (templateId?: string) => void;
  onIniciarQuizLibras: (moduleId?: string) => void;
  // Análise morfológica (aba ABNT) — recebe a frase já sorteada.
  onGerarFraseMorfologica: (frase: Frase) => void;
  // Pesquisador Agro — último progresso da busca (não expira)
  pesqSearchSnapshot: FontesSearchProgress | null;
  // Acessibilidade
  onAbrirAcessibilidade: () => void;
}

const GLOBAL_SYSTEM_INSTRUCTION = `Você é o Engenheiro Agrônomo e Especialista em Nutrição de Milho Assistente por Voz do aplicativo 'Agronômica N-Pro'.
Sua voz oficial é 'Puck'.
Você fala em português do Brasil com naturalidade, clareza, simpatia e precisão técnica.

Capacidades:
1. Data/hora local do usuário pela ferramenta 'getUserLocalDateTime' (perguntas sobre data, dia, plantio, safra).
2. Estado completo do simulador (entradas, resultados e fonte nitrogenada) pela ferramenta 'getCurrentSimulatorState'.
3. Preencher o simulador como se fosse o usuário: 'setYieldGoal' (meta sc/ha), 'setSoilParameters' (MOS, soja, eficiência), 'setFertilizerParceling' (base, V4-V6, V8-V10), 'setNecessidadeLiquida' (modo entrada direta), 'setNPorSaca' (exigência kg N/sc), 'setSplitBase' (base do parcelamento), 'loadAgronomicPreset' (cenários padrão: alta_produtividade, produtividade_media, baixa_produtividade).
4. Fonte nitrogenada com 'setFonteNitrogenada' (ureia, ureia + ABPT, sulfato de amônio, cloreto de amônio, nitrato de amônio ou personalizado com teor custom).
5. Calculadora de estimativa de produtividade com 'calculateCornYield' — preenche os campos com animação, calcula e rola até a seção. Se o usuário quiser aplicar a meta no simulador de nitrogênio, passe aplicarNoNitrogenio = true.
6. Calculadora ITR com 'setITRParameters' (VTN, área total, tributável, aproveitável, utilizada) — abre a aba ITR.
7. Referências ABNT com 'setABNTReference' (tipo, autor, título, ano, editor, local, URL) — adiciona à lista e abre a aba ABNT.
8. Cenários salvos: 'salvarCenario' (nome + notas opcionais), 'listarCenarios', 'carregarCenario' (por id), 'excluirCenario'. Os cenários ficam salvos neste dispositivo.
9. Utilitários: 'redefinirCalculadora' (zera tudo — só quando pedirem explicitamente) e 'imprimirTela' (abre a impressão/PDF).
10. Rolagem com 'scrollToSection' para QUALQUER seção do app: aceita o id do menu de navegação (SectionNavGooey) de qualquer aba — Adubação: 'preset_selector' (Cenários), 'form_section' (Parâmetros), 'results_section' (Resultados), 'parceling_section' (Parcelamento), 'balanco_section' (Balanço), 'detailed_math_panel' (Fórmulas); Produtividade: 'corn_yield_header', 'corn_yield_params', 'corn_yield_visual', 'corn_yield_results'; ITR: 'itr_section', 'itr_params_section', 'itr_results_section'; ABNT: 'abnt_section', 'bibliography_autodetect', 'analise_morfologica'; Pesquisador: 'pesquisador_fontes', 'pesquisador_portais', 'pesquisador_automatico'; Libras: 'libras_search', 'librascurso', 'libras_practice', 'libras_tutor', 'libras_capture_test'; Redação: 'redacao_tema', 'redacao_repertorio', 'redacao_expressoes', 'redacao_estrutura', 'redacao_resultado'; Tutor: 'tutor_tema', 'tutor_session', 'tutor_research', 'tutor_progress'. Também aceita os aliases legados: 'parametros', 'resultados', 'dose_total', 'parcelamento', 'balanco', 'presets', 'produtividade', 'solo', 'eficiencia', 'fonte_nitrogenada', 'estimativa_milho', 'itr', 'abnt', 'topo'. A tool troca de aba sozinha quando preciso — não chame 'mudarAba' antes de rolar. Se a seção for da aba do Tutor, a sessão é transferida automaticamente para o Tutor junto com o comando de rolagem: responda só com uma frase curta de despedida (ex: "Vou te chamar o Tutor!"). Troca manual de aba continua com 'mudarAba' ('nitrogen', 'productivity', 'itr', 'abnt', 'pesquisador', 'libras', 'redacao') — a aba do Tutor NÃO existe em 'mudarAba' (para lá é 'chamarAgente').
11. Após cada alteração no simulador a tela rola automaticamente até o local afetado; quando o usuário pedir os resultados (dose total, parcelamento, balanço), role para 'resultados'/'dose_total'/'parcelamento'/'balanco'.
12. Para revisar, estudar, treinar com questões, simulado, seminário, mapa mental, flashcards ou falar com o Tutor, use 'chamarAgente' com alvo 'tutor'. Ela abre a aba do Tutor e transfere a sessão de voz. Responda com uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — de quem responde é ele. Se o usuário pedir para "voltar para o agente global", "falar com o Puck" ou "mudar para o agente de voz" enquanto VOCÊ já é o agente ativo, não chame nenhuma ferramenta: responda que você já é ele e siga a conversa. Alvo 'global' só se aplica quando a chamada vem do Tutor (devolvendo a conversa).
13. Pesquisador Agro: 'pesquisarFontes' (busca fontes sobre um tema — demora; depois leia com 'lerResultadosFontes'), 'gerarArtigoABNT' (gera artigo ABNT — demora bastante; as referências ficam prontas para 'copiarCitacaoABNT'). Sempre avise que a ação foi iniciada e que o resultado pode ser lido depois.
14. Pesquisador de Redação: fluxo = 'pesquisarRepertorio' (tema) → 'gerarRedacao' → 'lerRedacao' (lê o texto e a validação) → 'validarRedacao' (revalida) e 'recomecarRedacao' (zera). Não pule a pesquisa de repertório: sem contexto a geração falha.
15. Libras no Agro: 'abrirSecaoLibras' (seções: buscar, curso, praticar, tutor, camera), 'buscarSinal' (busca o vídeo do sinal de uma palavra) e 'progressoLibras' (lê o progresso do mini-curso). NÃO existe um "agente Libras": Libras é uma aba — use 'mudarAba' com alvo 'libras' ou 'abrirSecaoLibras'.
16. Prática e quiz de Libras: 'iniciarPraticaLibras' (sinal opcional, ex: "milho" — abre a prática e pede PERMISSÃO de câmera; sem sinal lista os sinais disponíveis) e 'iniciarQuizLibras' (módulo opcional: "vocabulario_basico", "frases_campo" ou um módulo de área; sem módulo inicia o vocabulário básico). Aviso sempre que abrir prática: a câmera será solicitada.
17. Análise morfológica (aba ABNT): 'gerarFraseMorfologica' (sorteia uma frase nova, abre a aba ABNT e devolve o TEXTO da frase) e 'lerProgressoAnalise' (acertos, erros, frases resolvidas e sequências). Ao ditar a frase NUNCA revele as classes gramaticais — o aluno que classifica na tela.
18. Clima da lavoura: 'consultarPrevisaoTempo' (parâmetro local = cidade, ex: "Lavras"; opcional dias de 1 a 7). Sem cidade usa a geolocalização do aparelho (se negada, peça a cidade). Devolve temperatura, chuva e probabilidade de precipitação.
19. Memória de evidências: 'consultarMemoriaEvidencias' (tema) — consulta as fontes científicas já pesquisadas/indexadas e diz se há material para reuso. Pode demorar alguns segundos; use para "o que já temos sobre X?".
20. Pesquisador Agro extras: 'lerProgressoPesquisa' (fase atual, portais e total da última busca) e 'copiarArtigo' (copia o artigo ABNT completo para a área de transferência e devolve um trecho).
21. Redação extras: 'copiarRedacao' (copia o texto para a área de transferência) e 'baixarRedacao' (baixa um arquivo .txt com a redação).
22. Interface: 'alternarTema' (alterna claro/escuro), 'abrirAcessibilidade' (abre o painel de acessibilidade Libras), 'alternarWidgetLibras' e 'alternarReconhecimentoLibras' (ligam/desligam o widget VLibras e o reconhecimento de sinais).
23. Sessão: 'listarCapacidades' (lista tudo o que você sabe fazer — use quando perguntarem "o que você faz?"), 'iniciarRevisao' (transfere para o Tutor já com tema/formato), 'encerrarConversa' (se despede e encerra a sessão de voz em seguida) e 'alternarMudo' (liga/desliga o seu microfone).
24. Supressor de ruído do microfone: 'setSupressorRuido' — modo 'automatico' (PADRÃO: sozinho detecta o ruído de fundo como trânsito, escola ou parque, se ajusta para ouvir só quem está perto do microfone ~30 cm), 'manual' (para de ajustar sozinho e fixa a distância em distancia_cm, ex: 30) e 'desligado' (microfone capta tudo normalmente). Use quando pedirem para ativar/desativar o supressor, "modo próximo", parar o ajuste automático (fixando a distância) ou mudar a distância de corte.

Fórmulas do simulador de Adubação Nitrogenada:
- Extração Total (kg N/ha) = Produtividade (sc/ha) × Exigência (ex: 1.35 kg N/sc)
- Necessidade Líquida (kg N/ha) = Extração Total - MOS (kg N/ha) - Crédito Soja (kg N/ha)
- Dose Total Recomendada com perdas (kg N/ha) = Necessidade Líquida ÷ (Eficiência ÷ 100)
- Parcelamento: Base (30-40 kg N/ha) na semeadura; Cobertura 1 em V4-V6 (50-60%); Cobertura 2 em V8-V10 (20-30%).
- 1 saca de Ureia (50 kg) contém 22.5 kg de N elementar (45% N).
- Fertilizante (kg produto/ha) = N_Liq ÷ (Teor N ÷ 100)

Fórmulas da Calculadora de Estimativa de Produtividade de Milho:
- Estande (população) = plantas por metro ÷ espaçamento entre linhas (em metros) × 10.000
- Quantidade de grãos = fileiras × grãos/fileira
- Produtividade Bruta (kg/ha) = estande × espigas × quantidade de grãos × (PMG ÷ 1000) ÷ 1000
- Produtividade Bruta (sc/ha) = kg/ha ÷ 60
- Produtividade Líquida (sc/ha) = sc/ha bruta × (1 - perda em decimal, ex: 0,05 para 5%)

Regras gerais:
- Responda de forma concisa e direta: é conversa falada em tempo real.
- Nunca invente valores: leia com 'getCurrentSimulatorState' antes de afirmar resultados.
- Ferramentas longas não existem aqui; alterações são imediatas.
- As respostas das ferramentas chegam de forma assíncrona: só afirme que uma ação
  funcionou (ou falhou) DEPOIS de receber a resposta da ferramenta e ler o campo
  'success' dela. Nunca diga "houve um erro técnico" ou "não consegui fazer" sem
  ter recebido uma resposta com 'success: false' — se você não recebeu resposta
  ainda, espere um instante e informe o resultado real.`;

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
            aplicarNoNitrogenio: {
              type: 'BOOLEAN',
              description:
                'Se true, além de preencher a calculadora de produtividade, aplica a produtividade líquida calculada como meta (yield goal) no simulador de nitrogênio.',
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
              description:
                'Identificador do preset: "alta_produtividade", "produtividade_media" ou "baixa_produtividade"',
            },
          },
          required: ['presetId'],
        },
      },
      {
        name: 'scrollToSection',
        description:
          'Rola suavemente a tela até uma seção do aplicativo (ids do menu de navegação lateral/topo de qualquer aba ou aliases legados). Troca de aba automaticamente quando a seção está em outra aba; se a seção for da aba do Tutor, transfere a sessão para o Tutor com o comando de rolagem.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            section: {
              type: 'STRING',
              description: `Seção de destino. Ids do menu de navegação — ${describeSections()}. Aliases legados: "parametros", "resultados", "dose_total", "parcelamento", "balanco", "presets", "produtividade", "solo", "eficiencia", "fonte_nitrogenada", "estimativa_milho", "itr", "abnt", "topo".`,
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
        name: 'mudarAba',
        description:
          'Troca a aba principal do aplicativo. Use antes de rolar para seções de outras abas (ITR, ABNT, Produtividade, Pesquisador, Libras, Redação).',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            aba: {
              type: 'STRING',
              enum: ['nitrogen', 'productivity', 'itr', 'abnt', 'pesquisador', 'libras', 'redacao'],
              description:
                'Aba de destino: "nitrogen" (adubação), "productivity" (produtividade de milho), "itr", "abnt", "pesquisador", "libras", "redacao". Para o Tutor use chamarAgente.',
            },
          },
          required: ['aba'],
        },
      },
      {
        name: 'setNecessidadeLiquida',
        description:
          'Define a necessidade líquida de nitrogênio (kg N/ha) diretamente, ativando o modo de entrada direta do simulador.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            necessidadeLiquida: {
              type: 'NUMBER',
              description: 'Necessidade líquida em kg N/ha (ex: 120)',
            },
          },
          required: ['necessidadeLiquida'],
        },
      },
      {
        name: 'setNPorSaca',
        description:
          'Define a exigência de nitrogênio por saca de milho (kg N por saca) usada no cálculo da extração total.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            nRequirementPerBag: {
              type: 'NUMBER',
              description: 'kg de N por saca de 60 kg (ex: 1.35)',
            },
          },
          required: ['nRequirementPerBag'],
        },
      },
      {
        name: 'setSplitBase',
        description:
          'Define a base do parcelamento: usar a dose total com perdas ou a necessidade líquida como referência dos percentuais de cobertura.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            base: {
              type: 'STRING',
              enum: ['dose_perdas', 'necessidade_liquida'],
              description:
                '"dose_perdas" = percentuais sobre a dose total recomendada; "necessidade_liquida" = sobre a necessidade líquida.',
            },
          },
          required: ['base'],
        },
      },
      {
        name: 'setITRParameters',
        description:
          'Preenche a Calculadora ITR (Imposto Territorial Rural) com VTN e áreas, e abre a aba do ITR. Cálculo é ao vivo.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            vtn: {
              type: 'NUMBER',
              description: 'Valor Total da Terra (VTN) em R$ (ex: 500000)',
            },
            areaTotal: {
              type: 'NUMBER',
              description: 'Área total do imóvel em hectares (ex: 100)',
            },
            areaTributavel: {
              type: 'NUMBER',
              description: 'Área tributável em hectares (opcional)',
            },
            areaAproveitavel: {
              type: 'NUMBER',
              description: 'Área aproveitável em hectares (opcional)',
            },
            areaUtilizada: {
              type: 'NUMBER',
              description: 'Área utilizada em hectares (opcional)',
            },
          },
          required: ['vtn', 'areaTotal'],
        },
      },
      {
        name: 'setABNTReference',
        description:
          'Adiciona uma referência bibliográfica ABNT à lista de referências e abre a aba ABNT.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            tipo: {
              type: 'STRING',
              description:
                'Tipo da referência: id ou nome em português (ex: "book" ou "livro", "journal_article_online", "website", "thesis", "legislation")',
            },
            autor: {
              type: 'STRING',
              description: 'Autor (ex: "Carlos C. Klipp")',
            },
            titulo: {
              type: 'STRING',
              description: 'Título da obra',
            },
            ano: {
              type: 'NUMBER',
              description: 'Ano de publicação (ex: 2020)',
            },
            editor: {
              type: 'STRING',
              description: 'Editora (opcional)',
            },
            local: {
              type: 'STRING',
              description: 'Local de publicação (opcional, ex: "Campinas")',
            },
            url: {
              type: 'STRING',
              description: 'URL (opcional, para fontes online)',
            },
          },
          required: ['tipo', 'titulo'],
        },
      },
      {
        name: 'setFonteNitrogenada',
        description:
          'Escolhe a fonte nitrogenada (ex: ureia, sulfato de amônio) e opcionalmente um teor de N personalizado, e rola até o card da fonte nitrogenada.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            fonte: {
              type: 'STRING',
              description:
                'Nome ou id da fonte (ex: "ureia", "ureia abpt", "sulfato de amônio", "cloreto de amônio", "nitrato de amônio", "personalizado").',
            },
            teorPercent: {
              type: 'NUMBER',
              description: 'Teor de N em % (ex: 45). Obrigatório se fonte = personalizado.',
            },
          },
          required: ['fonte'],
        },
      },
      {
        name: 'salvarCenario',
        description:
          'Salva o cenário atual (entradas e resultados do simulador de nitrogênio) com um nome, para usar depois. Os cenários ficam salvos neste dispositivo.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            nome: { type: 'STRING', description: 'Nome do cenário (ex: "Milho 120 sc/ha Lavras")' },
            notas: { type: 'STRING', description: 'Observações opcionais sobre o cenário.' },
          },
          required: ['nome'],
        },
      },
      {
        name: 'listarCenarios',
        description: 'Lista os cenários salvos neste dispositivo (nome, id, produtividade-alvo e dose).',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            busca: { type: 'STRING', description: 'Filtro opcional pelo nome do cenário.' },
            limite: { type: 'NUMBER', description: 'Máximo de cenários retornados (padrão 10).' },
          },
        },
      },
      {
        name: 'carregarCenario',
        description: 'Carrega um cenário salvo (por id, como "sc-...") no simulador de nitrogênio.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING', description: 'Id do cenário retornado por listarCenarios.' },
          },
          required: ['id'],
        },
      },
      {
        name: 'excluirCenario',
        description: 'Exclui definitivamente um cenário salvo neste dispositivo.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING', description: 'Id do cenário retornado por listarCenarios.' },
          },
          required: ['id'],
        },
      },
      {
        name: 'redefinirCalculadora',
        description:
          'Zera todas as entradas do simulador de nitrogênio (meta, solo, eficiência, parcelamento) e volta ao modo inicial. Use só quando o usuário pedir explicitamente.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'imprimirTela',
        description: 'Abre a caixa de impressão do navegador para imprimir ou salvar a página como PDF.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'pesquisarFontes',
        description:
          'Inicia uma busca de fontes científicas no Pesquisador Agro por um tema (ex: "gessagem do solo"). Demora alguns segundos; depois use lerResultadosFontes para ler o que foi encontrado.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            tema: { type: 'STRING', description: 'Tema da pesquisa (ex: "manejo integrado de pragas")' },
          },
          required: ['tema'],
        },
      },
      {
        name: 'lerResultadosFontes',
        description:
          'Lê o resumo das fontes encontradas na última busca do Pesquisador Agro (título, portal e ano de até 25 fontes).',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'gerarArtigoABNT',
        description:
          'Gera um artigo científico em formato ABNT no Pesquisador Agro a partir de um tema (usa as fontes já pesquisadas quando o tema coincidir). Demora bastante; depois use copiarCitacaoABNT para as referências.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            tema: {
              type: 'STRING',
              description: 'Tema do artigo. Se omitido, usa o tema da última pesquisa de fontes.',
            },
            modo: {
              type: 'STRING',
              enum: ['padrao', 'aprofundado'],
              description: 'Modo do artigo (padrão: padrao).',
            },
          },
        },
      },
      {
        name: 'copiarCitacaoABNT',
        description:
          'Copia para a área de transferência as referências ABNT do último artigo gerado e retorna as três primeiras citações.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'pesquisarRepertorio',
        description:
          'Inicia a pesquisa de repertório (fontes, repertórios e expressões) para um tema de redação. Etapa inicial do Pesquisador de Redação.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            tema: { type: 'STRING', description: 'Tema da redação (ex: "segurança alimentar no Brasil")' },
          },
          required: ['tema'],
        },
      },
      {
        name: 'gerarRedacao',
        description:
          'Gera a redação automaticamente a partir do contexto já pesquisado (use pesquisarRepertorio antes, se ainda não houver contexto).',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'lerRedacao',
        description:
          'Lê a redação gerada e o resultado da última validação (nota/checklist). Só funciona depois de gerar a redação.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'validarRedacao',
        description: 'Revalida a redação gerada (notas, avisos e erros do corretor).',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'recomecarRedacao',
        description: 'Reinicia o Pesquisador de Redação do zero (limpa tema, contexto e redação).',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'abrirSecaoLibras',
        description: 'Abre a aba Libras no Agro e rola até a seção pedida (buscar sinais, mini-curso, praticar, tutor ou teste de câmera).',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            secao: {
              type: 'STRING',
              enum: ['buscar', 'curso', 'praticar', 'tutor', 'camera'],
              description: 'Seção desejada.',
            },
          },
          required: ['secao'],
        },
      },
      {
        name: 'buscarSinal',
        description:
          'Abre a aba Libras no Agro e busca vídeos de um sinal em Libras (ex: "gado", "milho"). Mostra os resultados na tela.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            palavra: { type: 'STRING', description: 'Palavra/frase para buscar o sinal (ex: "irrigação")' },
          },
          required: ['palavra'],
        },
      },
      {
        name: 'progressoLibras',
        description: 'Lê o progresso do mini-curso de Libras: palavras aprendidas e média de acertos nos quizzes.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'listarCapacidades',
        description:
          'Lista tudo o que este assistente de voz sabe fazer, organizado por categoria (simulador, clima, pesquisa, redação, Libras, acessibilidade, sessão). Use quando perguntarem o que você faz.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'consultarPrevisaoTempo',
        description:
          'Consulta a previsão do tempo (temperatura, chuva e probabilidade de precipitação) de uma cidade ou da localização atual do aparelho.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            local: {
              type: 'STRING',
              description: 'Cidade (ex: "Lavras", "Campinas"). Se omitido, usa a geolocalização do aparelho.',
            },
            dias: { type: 'NUMBER', description: 'Dias de previsão, de 1 a 7 (padrão 5).' },
          },
        },
      },
      {
        name: 'consultarMemoriaEvidencias',
        description:
          'Consulta a memória de evidências científicas do app: diz se já existem fontes pesquisadas sobre um tema (reuso) e quais são. Pode demorar alguns segundos.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            tema: { type: 'STRING', description: 'Tema a consultar (ex: "gessagem do solo")' },
          },
          required: ['tema'],
        },
      },
      {
        name: 'gerarFraseMorfologica',
        description:
          'Sorteia uma frase nova para o exercício de análise morfológica (aba ABNT), abre a seção na tela e devolve o TEXTO da frase para você ditar. Não devolve as classes (respostas).',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'lerProgressoAnalise',
        description:
          'Lê o placar da análise morfológica: acertos, erros, frases resolvidas, sequência atual e melhor sequência.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'iniciarPraticaLibras',
        description:
          'Abre a prática de sinais em Libras (DTW com câmera) e, quando informado, seleciona o sinal. Sem sinal, lista os sinais disponíveis. A câmera será solicitada ao usuário.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            sinal: {
              type: 'STRING',
              description: 'Sinal a praticar (ex: "milho", "gado", "trator"). Omitir para abrir a lista.',
            },
          },
        },
      },
      {
        name: 'iniciarQuizLibras',
        description: 'Inicia o quiz do mini-curso de Libras no módulo pedido (padrão: vocabulário básico).',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            modulo: {
              type: 'STRING',
              description:
                'Módulo: "vocabulario_basico", "frases_campo" ou módulo de área (ex: "area_agricultura"). Omitir = vocabulário básico.',
            },
          },
        },
      },
      {
        name: 'lerProgressoPesquisa',
        description:
          'Lê o andamento da última busca do Pesquisador Agro: fase atual, portais que já retornaram fontes e total de fontes.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'copiarArtigo',
        description:
          'Copia o artigo científico ABNT completo (último gerado) para a área de transferência e devolve um trecho inicial.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'copiarRedacao',
        description: 'Copia a redação gerada para a área de transferência e devolve um trecho inicial.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'baixarRedacao',
        description: 'Baixa a redação gerada como arquivo .txt no aparelho do usuário.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'alternarTema',
        description: 'Alterna o tema do aplicativo entre claro e escuro.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'abrirAcessibilidade',
        description: 'Abre o painel de Acessibilidade Libras (reconhecimento de sinais e configurações do widget).',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'alternarWidgetLibras',
        description: 'Liga ou desliga o widget VLibras (intérprete) exibido na tela.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'alternarReconhecimentoLibras',
        description: 'Liga ou desliga o reconhecimento de sinais em Libras.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'iniciarRevisao',
        description:
          'Transfere a conversa para o Tutor de Revisão já informando o tema e/ou o formato desejado (ex: simulado, questões, flashcards).',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            tema: { type: 'STRING', description: 'O que o usuário quer revisar (ex: "calagem do solo")' },
            formato: {
              type: 'STRING',
              description: 'Formato desejado (ex: "simulado", "questões", "flashcards", "resumo", "seminário")',
            },
          },
        },
      },
      {
        name: 'encerrarConversa',
        description:
          'Encerra a sessão de voz: você se despede e a conexão é fechada automaticamente em seguida.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'alternarMudo',
        description: 'Liga ou desliga o mudo do microfone da conversa.',
        behavior: 'NON_BLOCKING',
        parameters: { type: 'OBJECT', properties: {} },
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
              enum: ['tutor', 'global'],
              description:
                'Agente de destino: "tutor" (Tutor de Revisão) ou "global" (este assistente — use quando o usuário pedir para voltar/ficar aqui).',
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
      {
        name: 'setSupressorRuido',
        description:
          'Ativa, desativa ou fixa o supressor de ruído do microfone (modo próximo). No modo automático o áudio se ajusta sozinho ao ruído de fundo (trânsito, escola, parque) e só deixa passar quem está perto (~30 cm); no manual para de ajustar e fixa a distância; desligado captura tudo normalmente.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            modo: {
              type: 'STRING',
              enum: ['automatico', 'manual', 'desligado'],
              description:
                '"automatico" = ajuste automático ao ruído de fundo (padrão); "manual" = para de ajustar e usa a distância fixa; "desligado" = sem supressão.',
            },
            distancia_cm: {
              type: 'NUMBER',
              description:
                'Distância de corte em cm (5 a 120, padrão 30). Usada no modo manual e como referência do automático. Se omitida, mantém a distância atual.',
            },
          },
          required: ['modo'],
        },
      },
    ],
  },
];

const TAB_LABELS: Record<string, string> = {
  nitrogen: 'Adubação Nitrogenada',
  productivity: 'Produtividade de Milho',
  itr: 'Calculadora ITR',
  abnt: 'Referências ABNT',
  pesquisador: 'Pesquisador Agro',
  libras: 'Libras no Agro',
  redacao: 'Pesquisador de Redação',
};

/**
 * Categorias devolvidas por `listarCapacidades` — mantenha em sincronia com
 * GLOBAL_TOOLS (declaração) e GLOBAL_SYSTEM_INSTRUCTION (descrição de uso).
 */
const CAPACIDADES: { categoria: string; descricao: string; tools: string[] }[] = [
  {
    categoria: 'Simulador de adubação nitrogenada',
    descricao: 'Ler o estado, ajustar meta, solo, eficiência, parcelamento e fonte, cenários salvos, presets, imprimir e zerar.',
    tools: [
      'getCurrentSimulatorState',
      'setYieldGoal',
      'setSoilParameters',
      'setFertilizerParceling',
      'setNPorSaca',
      'setNecessidadeLiquida',
      'setSplitBase',
      'setFonteNitrogenada',
      'loadAgronomicPreset',
      'salvarCenario',
      'listarCenarios',
      'carregarCenario',
      'excluirCenario',
      'redefinirCalculadora',
      'imprimirTela',
    ],
  },
  {
    categoria: 'Navegação',
    descricao: 'Trocar de aba e rolar até qualquer seção do aplicativo.',
    tools: ['mudarAba', 'scrollToSection'],
  },
  {
    categoria: 'Produtividade de milho e ITR',
    descricao: 'Estimativa de produtividade (estande, grãos, PMG, quebra) e cálculo do ITR.',
    tools: ['calculateCornYield', 'setITRParameters'],
  },
  {
    categoria: 'Referências ABNT',
    descricao: 'Adicionar referências bibliográficas e copiar as citações do artigo.',
    tools: ['setABNTReference', 'copiarCitacaoABNT'],
  },
  {
    categoria: 'Pesquisador Agro',
    descricao: 'Buscar fontes científicas, acompanhar o progresso, gerar e copiar o artigo ABNT, consultar a memória de evidências.',
    tools: [
      'pesquisarFontes',
      'lerResultadosFontes',
      'lerProgressoPesquisa',
      'gerarArtigoABNT',
      'copiarArtigo',
      'consultarMemoriaEvidencias',
    ],
  },
  {
    categoria: 'Redação ENEM',
    descricao: 'Pesquisar repertório, gerar, ler, validar, reiniciar, copiar e baixar a redação.',
    tools: [
      'pesquisarRepertorio',
      'gerarRedacao',
      'lerRedacao',
      'validarRedacao',
      'recomecarRedacao',
      'copiarRedacao',
      'baixarRedacao',
    ],
  },
  {
    categoria: 'Libras no Agro',
    descricao: 'Buscar sinais, mini-curso, progresso, prática com câmera (DTW) e quiz por módulo.',
    tools: [
      'abrirSecaoLibras',
      'buscarSinal',
      'progressoLibras',
      'iniciarPraticaLibras',
      'iniciarQuizLibras',
    ],
  },
  {
    categoria: 'Análise morfológica',
    descricao: 'Sortear frases para classificar palavras nas 9 classes gramaticais e ler o placar.',
    tools: ['gerarFraseMorfologica', 'lerProgressoAnalise'],
  },
  {
    categoria: 'Acessibilidade e interface',
    descricao: 'Tema claro/escuro, painel de acessibilidade Libras, widget VLibras e reconhecimento de sinais.',
    tools: ['alternarTema', 'abrirAcessibilidade', 'alternarWidgetLibras', 'alternarReconhecimentoLibras'],
  },
  {
    categoria: 'Clima e data',
    descricao: 'Previsão do tempo por cidade ou localização atual e data/hora local.',
    tools: ['consultarPrevisaoTempo', 'getUserLocalDateTime'],
  },
  {
    categoria: 'Sessão de voz',
    descricao:
      'Transferir para o Tutor, encerrar a conversa, mudo do microfone, supressor de ruído (modo próximo) e listar capacidades.',
    tools: [
      'chamarAgente',
      'iniciarRevisao',
      'encerrarConversa',
      'alternarMudo',
      'setSupressorRuido',
      'listarCapacidades',
    ],
  },
];

/** Códigos WMO do Open-Meteo → descrição em pt-BR. */
const WEATHER_CODES_PT: Record<number, string> = {
  0: 'céu limpo',
  1: 'predominantemente limpo',
  2: 'parcialmente nublado',
  3: 'encoberto',
  45: 'nevoeiro',
  48: 'nevoeiro com geada',
  51: 'garoa fraca',
  53: 'garoa',
  55: 'garoa forte',
  56: 'garoa congelante fraca',
  57: 'garoa congelante',
  61: 'chuva fraca',
  63: 'chuva',
  65: 'chuva forte',
  66: 'chuva congelante fraca',
  67: 'chuva congelante forte',
  71: 'neve fraca',
  73: 'neve',
  75: 'neve forte',
  77: 'grãos de neve',
  80: 'pancadas de chuva fracas',
  81: 'pancadas de chuva',
  82: 'pancadas de chuva fortes',
  85: 'pancadas de neve fracas',
  86: 'pancadas de neve',
  95: 'trovoada',
  96: 'trovoada com granizo',
  99: 'trovoada forte com granizo',
};

const weatherLabel = (code?: number) =>
  (typeof code === 'number' ? WEATHER_CODES_PT[code] : undefined) ?? ' condição não informada';

/** Resposta do endpoint de geocoding do Open-Meteo (direto e reverso). */
interface OpenMeteoGeoResult {
  results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string; country?: string }>;
}

/** Resposta do endpoint de previsão do Open-Meteo. */
interface OpenMeteoForecast {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
}

/** Resposta de POST /api/evidence/search (memória de evidências). */
interface EvidenceSearchResponse {
  decision?: string;
  coverage?: number;
  sources?: Array<{ title?: string; sourceName?: string; year?: number }>;
  stats?: { totalSourcesFound?: number };
}

/** Monta o texto de uma frase da análise morfológica (sem as respostas). */
const fraseParaTexto = (f: Frase): string => {
  let out = '';
  f.tokens.forEach((t, i) => {
    if (t.pontuacao) out += t.palavra;
    else out += (i === 0 ? '' : ' ') + t.palavra;
  });
  return out.trim();
};

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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
  const { toggleTheme, isDark } = useTheme();
  const themeRef = useRef({ toggleTheme, isDark });

  // Controles de sessão usados pelas tools encerrarConversa / alternarMudo.
  const sessionControlsRef = useRef<{
    disconnect?: () => void;
    toggleMute?: () => void;
    isMuted?: boolean;
  }>({});

  useEffect(() => {
    simContextRef.current = simContext;
  }, [simContext]);

  useEffect(() => {
    themeRef.current = { toggleTheme, isDark };
  }, [toggleTheme, isDark]);

  const executeTool: ExecuteToolFn = useCallback(async (name, args, setActionLabel) => {
    const ctx = simContextRef.current;

    // Rola para uma seção (id do SectionNavGooey ou alias legado), trocando
    // de aba antes se necessário. Sem delay fixo: espera o elemento montar
    // (waitForElement) e rola no primeiro frame em que ele existe.
    const scrollTo = (section: string, label?: string) => {
      const targetTab = tabForSection(section);
      if (targetTab === null) {
        smoothScrollToSection(section, label);
        return;
      }
      const current = simContextRef.current;
      if (targetTab === current.activeTab) {
        smoothScrollToSection(section, label);
        return;
      }
      current.onNavigateTab(targetTab);
      void waitForElement(resolveSectionElementId(section)).then((el) => {
        if (el) {
          smoothScrollToSection(section, label);
        } else {
          console.warn('[GeminiLive] Seção não montou após trocar de aba:', section);
        }
      });
    };

    const scrollLater = (section: string, label: string, ms: number) =>
      setTimeout(() => scrollTo(section, label), ms);

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
            baseDose2: ctx.baseDose2,
            baseDoseMode: ctx.baseDoseMode,
            v4v6Percent: ctx.v4v6Percent,
            v4v6Percent2: ctx.v4v6Percent2,
            v8v10Percent: ctx.v8v10Percent,
            v8v10Percent2: ctx.v8v10Percent2,
            splitBase: ctx.splitBase,
            useDirectInput: ctx.useDirectInput,
            liquidNeedInput: ctx.liquidNeedInput,
            efficiencyAlreadyApplied: ctx.efficiencyAlreadyApplied,
            activePreset: ctx.activePreset,
            activeTab: ctx.activeTab,
            fontePreset: ctx.fontePreset,
            fonteTeorN: ctx.fonteTeorN,
          },
          results: {
            totalExtraction: ctx.totalExtraction,
            liquidNeed: ctx.liquidNeed,
            recommendedDose: ctx.recommendedDose,
            selectedV4V6Val: ctx.selectedV4V6Val,
            selectedV8V10Val: ctx.selectedV8V10Val,
            sumOfSplits: ctx.sumOfSplits,
            targetSplitTotal: ctx.targetSplitTotal,
            splitDiscrepancy: ctx.splitDiscrepancy,
            ureaBagsEquivalent: Number((ctx.recommendedDose / 22.5).toFixed(1)),
          },
        };
      }

      case 'mudarAba': {
        const aba = String(args.aba || '');
        if (!(aba in TAB_LABELS)) {
          return { success: false, error: `Aba inválida. Use: ${Object.keys(TAB_LABELS).join(', ')}.` };
        }
        setActionLabel(`Abrindo ${TAB_LABELS[aba]}`);
        ctx.onNavigateTab(aba as TabId);
        return { success: true, aba, message: `Aba ${TAB_LABELS[aba]} aberta.` };
      }

      case 'setNecessidadeLiquida': {
        const val = Number(args.necessidadeLiquida);
        if (!Number.isFinite(val) || val < 0) {
          return { success: false, error: 'Valor de necessidade líquida inválido.' };
        }
        setActionLabel(`Necessidade líquida: ${val} kg N/ha`);
        ctx.onSetLiquidNeed(val);
        scrollLater('resultados', `Necessidade líquida: ${val} kg N/ha`, 600);
        return {
          success: true,
          necessidadeLiquida: val,
          message: `Modo entrada direta ativado com necessidade líquida de ${val} kg N/ha. Resultados recalculados.`,
        };
      }

      case 'setNPorSaca': {
        const val = Number(args.nRequirementPerBag);
        if (!Number.isFinite(val) || val <= 0) {
          return { success: false, error: 'Valor de N por saca inválido.' };
        }
        setActionLabel(`N por saca: ${val} kg`);
        ctx.onSetNRequirementPerBag(val);
        scrollLater('resultados', `Exigência: ${val} kg N/saca`, 600);
        return {
          success: true,
          nRequirementPerBag: val,
          message: `Exigência de N por saca atualizada para ${val} kg N/saca.`,
        };
      }

      case 'setSplitBase': {
        const base = String(args.base || '');
        if (base !== 'dose_perdas' && base !== 'necessidade_liquida') {
          return { success: false, error: 'Base inválida. Use "dose_perdas" ou "necessidade_liquida".' };
        }
        setActionLabel('Ajustando base do parcelamento…');
        ctx.onSetSplitBase(base);
        scrollLater('parcelamento', 'Base do parcelamento ajustada', 600);
        return {
          success: true,
          splitBase: base,
          message: `Parcelamento agora usa ${
            base === 'dose_perdas' ? 'a dose total com perdas' : 'a necessidade líquida'
          } como base dos percentuais.`,
        };
      }

      case 'setYieldGoal': {
        const goal = Number(args.yieldGoal);
        if (goal > 0) {
        setActionLabel(`Preenchendo Meta: ${goal} sc/ha`);
        ctx.onSetYieldGoal(goal);
        scrollTo('parametros', `Ajustando Meta: ${goal} sc/ha`);
        scrollLater('resultados', 'Exibindo Nova Dose Recomendada', 1800);

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
        ctx.onSetSoilParameters({ mos, soy, efficiency: eff });
        scrollTo('solo', 'Ajustando Solo & Eficiência');
        scrollLater('resultados', 'Resultado com Novo Histórico de Solo', 1800);

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
        ctx.onSetParceling({ baseDose: base, v4v6Percent: v4v6, v8v10Percent: v8v10 });
        scrollTo('parcelamento', 'Ajustando Parcelamento');
        scrollLater('resultados', 'Resultado com Novo Parcelamento', 1800);

        return {
          success: true,
          updated: { base, v4v6, v8v10 },
          message: 'Doses de parcelamento atualizadas. A tela rolou para o parcelamento e depois para os resultados.',
        };
      }

      case 'setITRParameters': {
        const vtn = args.vtn !== undefined ? Number(args.vtn) : NaN;
        const areaTotal = args.areaTotal !== undefined ? Number(args.areaTotal) : NaN;
        if (!Number.isFinite(vtn) || vtn <= 0 || !Number.isFinite(areaTotal) || areaTotal <= 0) {
          return { success: false, error: 'Informe VTN e área total válidos (ambos maiores que zero).' };
        }
        const areaTributavel = args.areaTributavel !== undefined ? Number(args.areaTributavel) : undefined;
        const areaAproveitavel = args.areaAproveitavel !== undefined ? Number(args.areaAproveitavel) : undefined;
        const areaUtilizada = args.areaUtilizada !== undefined ? Number(args.areaUtilizada) : undefined;

        setActionLabel('Preenchendo parâmetros do ITR...');
        ctx.onSetITRParameters({ vtn, areaTotal, areaTributavel, areaAproveitavel, areaUtilizada });
        scrollTo('itr', 'Ajustando Cálculo ITR');

        return {
          success: true,
          updated: { vtn, areaTotal, areaTributavel, areaAproveitavel, areaUtilizada },
          message: 'Parâmetros do ITR atualizados e exibidos na tela.',
        };
      }

      case 'setABNTReference': {
        const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const tipoInput = norm(String(args.tipo ?? ''));
        const tipo = REFERENCE_TYPES.find((t) => t.id === tipoInput || norm(t.label) === tipoInput)?.id;
        if (!tipo) {
          return {
            success: false,
            error:
              'Tipo de referência inválido. Exemplos: livro, artigo de periódico online, site, tese, legislação.',
          };
        }
        const titulo = String(args.titulo ?? '').trim();
        if (!titulo) return { success: false, error: 'Informe o título da referência.' };

        const autor = args.autor ? String(args.autor).trim() : '';
        const ano = args.ano !== undefined && Number.isFinite(Number(args.ano)) ? String(Number(args.ano)) : '';
        const editor = args.editor ? String(args.editor).trim() : undefined;
        const local = args.local ? String(args.local).trim() : undefined;
        const url = args.url ? String(args.url).trim() : undefined;

        const ref: ABNTReference = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ref_${Date.now()}`,
          type: tipo,
          authors: autor ? [parseAuthorString(autor)] : [],
          title: titulo,
          year: ano || String(new Date().getFullYear()),
          ...(editor ? { editor } : {}),
          ...(local ? { location: local } : {}),
          ...(url ? { url } : {}),
        };

        setActionLabel('Adicionando referência ABNT...');
        ctx.onSetABNTReference(ref);
        scrollTo('abnt', 'Referência ABNT adicionada');

        return {
          success: true,
          updated: { tipo, titulo, ano },
          message: `Referência ABNT "${titulo}" adicionada à lista e exibida na tela.`,
        };
      }

      case 'loadAgronomicPreset': {
        const presetId = String(args.presetId);
        if (!['alta_produtividade', 'produtividade_media', 'baixa_produtividade'].includes(presetId)) {
          return {
            success: false,
            error: 'Preset inválido. Use: alta_produtividade, produtividade_media ou baixa_produtividade.',
          };
        }
        setActionLabel(`Carregando preset: ${presetId}`);
        ctx.onLoadPreset(presetId);
        scrollTo('presets', `Preset ${presetId}`);
        scrollLater('resultados', 'Resultados do Preset', 1800);

        return {
          success: true,
          presetId,
          message: `Preset ${presetId} aplicado. Tela rolada para o preset e para os resultados.`,
        };
      }

      case 'scrollToSection': {
        const input = String(args.section ?? '').trim();
        const label = args.label ? String(args.label) : undefined;
        if (!input) {
          return { success: false, error: 'Informe a seção de destino (parâmetro section).' };
        }
        const resolved = resolveSection(input);
        if (!resolved && !isPageSection(input)) {
          return {
            success: false,
            error: `Seção "${input}" não existe. Seções válidas: ${describeSections()}.`,
          };
        }
        const sectionId = resolved?.id ?? input;
        const sectionLabel = label ?? resolved?.label ?? sectionId;

        // Seção na aba do Tutor: transfere a sessão com o comando de rolagem —
        // trocar para a aba tutor desmontaria este agente e cortaria a fala.
        if (resolved?.tab === 'tutor') {
          setActionLabel(`Tutor: ${resolved.label}`);
          const res = voiceHub.callAgent('tutor', {
            transitionText: `Comando transferido do assistente principal: o aluno pediu para rolar a tela até a seção "${resolved.label}" (id: ${resolved.id}) na aba Tutor. Assuma a conversa e execute AGORA a tool scrollToSection(section="${resolved.id}") sem perguntar nada; depois confirme o scroll em uma frase curta.`,
          });
          if (!res.ok) return { success: false, error: res.message };
          return {
            success: true,
            section: resolved.id,
            aba: 'tutor',
            transferido: true,
            message: `A seção "${resolved.label}" fica na aba do Tutor: a sessão foi transferida com o comando de rolagem. Diga uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — quem rola a tela e continua é ele.`,
          };
        }

        const tab = tabForSection(sectionId);
        setActionLabel(`Rolando para: ${sectionLabel}`);
        scrollTo(sectionId, sectionLabel);
        return {
          success: true,
          section: sectionId,
          ...(resolved ? { label: resolved.label } : {}),
          ...(tab ? { aba: tab } : {}),
        };
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
        scrollTo('estimativa_milho', `Estimativa Milho: ${scHaLiquida} sc/ha`);

        const aplicarNoNitrogenio = Boolean(args.aplicarNoNitrogenio);
        ctx.onSetCornYield(
          {
            plantasPorMetro,
            espacamentoLinhas,
            fileiras,
            graosPorFileira,
            espigas,
            pmg,
            quebraDecimal,
          },
          aplicarNoNitrogenio
        );

        return {
          success: true,
          estande_populacao: estande,
          quantidade_graos: quantidadeGraos,
          pmg_convertido: pmgCorrigido,
          kg_ha_bruta: kgHaBruta,
          sc_ha_bruta: scHaBruta,
          sc_ha_liquida: scHaLiquida,
          quebra_percentual_aplicada: `${(quebraDecimal * 100).toFixed(1)}%`,
          aplicada_no_nitrogenio: aplicarNoNitrogenio,
          message: `Estande: ${estande.toLocaleString('pt-BR')} pl/ha. Grãos por espiga: ${quantidadeGraos}. Produtividade bruta: ${scHaBruta} sc/ha (${kgHaBruta.toLocaleString('pt-BR')} kg/ha). Produtividade líquida: ${scHaLiquida} sc/ha. Calculadora de produtividade preenchida${aplicarNoNitrogenio ? ' e meta aplicada no simulador de nitrogênio' : ''}.`,
        };
      }

      case 'setFonteNitrogenada': {
        const fonteInput = String(args.fonte || '').trim();
        const fonteId = resolveFertilizerId(fonteInput);
        if (!fonteId) {
          return {
            success: false,
            error: `Fonte "${fonteInput}" não reconhecida. Opções: ${PRESET_FERTILIZERS.map((f) => f.name).join(', ')}.`,
          };
        }
        const preset = PRESET_FERTILIZERS.find((f) => f.id === fonteId)!;
        const teorArg =
          typeof args.teorPercent === 'number' && args.teorPercent > 0 && args.teorPercent <= 100
            ? Number(args.teorPercent)
            : undefined;

        if (fonteId === 'custom' && teorArg === undefined) {
          return { success: false, error: 'Para fonte personalizada, informe teorPercent (ex: 44).' };
        }

        let presetFinal = fonteId;
        let teorFinal = teorArg ?? preset.teorN;
        if (fonteId !== 'custom' && teorArg !== undefined && teorArg !== preset.teorN) {
          // Teor divergente do preset → usa modo personalizado com o teor falado
          presetFinal = 'custom';
          teorFinal = teorArg;
        }
        if (fonteId === 'custom') teorFinal = teorArg as number;

        ctx.onSetFonteNitrogenada({ preset: presetFinal, customTeorN: teorFinal });
        scrollTo('fonte_nitrogenada', `Fonte: ${preset.name}`);
        setActionLabel(`Fonte nitrogenada: ${preset.name}`);

        const doseProduto =
          ctx.liquidNeed > 0 && teorFinal > 0
            ? Number((ctx.liquidNeed / (teorFinal / 100)).toFixed(2))
            : null;

        return {
          success: true,
          fonte: presetFinal === 'custom' ? 'Personalizado' : preset.name,
          teor_n: teorFinal,
          dose_produto_kg_ha: doseProduto,
          message:
            doseProduto !== null
              ? `Fonte ${presetFinal === 'custom' ? 'Personalizado' : preset.name} (${teorFinal}% de N) selecionada. Para ${ctx.liquidNeed.toFixed(2)} kg N/ha são necessários ${doseProduto.toFixed(2)} kg/ha de produto.`
              : `Fonte ${presetFinal === 'custom' ? 'Personalizado' : preset.name} (${teorFinal}% de N) selecionada.`,
        };
      }

      case 'salvarCenario': {
        const nome = String(args.nome || '').trim();
        if (!nome) return { success: false, error: 'Informe um nome para o cenário (parâmetro nome).' };
        const notas = args.notas ? String(args.notas) : undefined;
        setActionLabel('Salvando cenário');
        const res = ctx.onSalvarCenario(nome, notas);
        if (!res.success) return { success: false, error: res.error || 'Erro ao salvar cenário.' };
        return { success: true, id: res.id, message: `Cenário "${nome}" salvo neste dispositivo.` };
      }

      case 'listarCenarios': {
        setActionLabel('Listando cenários salvos');
        const limite = Number(args.limite ?? 10) > 0 ? Number(args.limite ?? 10) : 10;
        const records: CalculationRecord[] = SQLikeCalculationDB.select({
          ...(args.busca ? { search: String(args.busca) } : {}),
          limit: limite,
        });
        if (records.length === 0) {
          return { success: true, total: 0, cenarios: [], message: 'Nenhum cenário salvo neste dispositivo.' };
        }
        return {
          success: true,
          total: records.length,
          cenarios: records.map((r) => ({
            id: r.id,
            nome: r.name,
            meta_sc_ha: r.yield_goal,
            dose_recomendada_kg_ha: r.recommended_dose,
            criado_em: r.created_at,
            notas: r.notes ?? null,
          })),
          message: `${records.length} cenário(s) salvo(s). Use carregarCenario com o id para abrir um deles.`,
        };
      }

      case 'carregarCenario': {
        const id = String(args.id || '').trim();
        if (!id) return { success: false, error: 'Informe o id do cenário.' };
        setActionLabel('Carregando cenário');
        const res = ctx.onCarregarCenario(id);
        if (!res.success) return { success: false, error: res.error || 'Cenário não encontrado.' };
        scrollTo('parametros', `Cenário "${res.name}" carregado`);
        return { success: true, nome: res.name, message: `Cenário "${res.name}" carregado no simulador.` };
      }

      case 'excluirCenario': {
        const id = String(args.id || '').trim();
        if (!id) return { success: false, error: 'Informe o id do cenário.' };
        const found = SQLikeCalculationDB.findById(id);
        if (!found) return { success: false, error: 'Cenário não encontrado.' };
        setActionLabel('Excluindo cenário');
        const ok = SQLikeCalculationDB.delete(id);
        if (!ok) return { success: false, error: 'Não foi possível excluir o cenário.' };
        return { success: true, message: `Cenário "${found.name}" excluído.` };
      }

      case 'redefinirCalculadora': {
        setActionLabel('Redefinindo calculadora');
        ctx.onRedefinir();
        scrollTo('parametros', 'Calculadora zerada');
        return {
          success: true,
          message: 'Todas as entradas do simulador de nitrogênio foram zeradas.',
        };
      }

      case 'imprimirTela': {
        setActionLabel('Abrindo impressão');
        setTimeout(() => window.print(), 300);
        return {
          success: true,
          message: 'Caixa de impressão do navegador aberta (imprimir ou salvar como PDF).',
        };
      }

      case 'pesquisarFontes': {
        const tema = String(args.tema || '').trim();
        if (!tema) return { success: false, error: 'Informe o tema da pesquisa (parâmetro tema).' };
        setActionLabel('Pesquisando fontes…');
        ctx.onPesquisarFontes(tema);
        return {
          success: true,
          tema,
          iniciado: true,
          message: `Busca de fontes sobre "${tema}" iniciada na aba Pesquisador. Leva alguns segundos — depois peça para ler os resultados com lerResultadosFontes.`,
        };
      }

      case 'lerResultadosFontes': {
        const rep = ctx.pesqSourcesReport;
        if (!rep || rep.total === 0) {
          return { success: false, error: 'Nenhuma busca concluída ainda. Use pesquisarFontes antes.' };
        }
        return {
          success: true,
          tema: rep.tema,
          total: rep.total,
          fontes: rep.sources.slice(0, 12),
          message: `Encontrei ${rep.total} fonte(s) sobre "${rep.tema}". Abaixo as 12 primeiras (título, portal, ano).`,
        };
      }

      case 'gerarArtigoABNT': {
        const tema = args.tema
          ? String(args.tema).trim()
          : ctx.pesqSourcesReport?.tema;
        if (!tema) {
          return { success: false, error: 'Informe o tema ou faça antes uma pesquisa de fontes (pesquisarFontes).' };
        }
        const modo = args.modo === 'aprofundado' ? 'aprofundado' : 'padrao';
        setActionLabel('Gerando artigo ABNT…');
        ctx.onGerarArtigo(tema, modo);
        return {
          success: true,
          tema,
          modo,
          iniciado: true,
          message: `Geração do artigo ABNT sobre "${tema}" iniciada (${modo}). Pode demorar um minuto ou mais; depois peça para copiar as citações.`,
        };
      }

      case 'copiarCitacaoABNT': {
        const art = ctx.pesqArticleReport;
        if (!art || art.referencias.length === 0) {
          return { success: false, error: 'Nenhum artigo com referências foi gerado ainda. Use gerarArtigoABNT antes.' };
        }
        setActionLabel('Copiando referências ABNT');
        try {
          await navigator.clipboard.writeText(art.referencias.join('\n\n'));
        } catch {
          return { success: false, error: 'Não foi possível copiar para a área de transferência.' };
        }
        return {
          success: true,
          titulo: art.titulo,
          total_referencias: art.referencias.length,
          primeiras_citacoes: art.referencias.slice(0, 3),
          message: `${art.referencias.length} referência(s) ABNT do artigo "${art.titulo}" copiada(s) para a área de transferência.`,
        };
      }

      case 'pesquisarRepertorio': {
        const tema = String(args.tema || '').trim();
        if (!tema) return { success: false, error: 'Informe o tema da redação (parâmetro tema).' };
        setActionLabel('Pesquisando repertório…');
        ctx.onRedacaoAction('pesquisar', tema);
        return {
          success: true,
          tema,
          iniciado: true,
          message: `Pesquisa de repertório sobre "${tema}" iniciada na aba de Redação. Depois pode pedir para gerar a redação.`,
        };
      }

      case 'gerarRedacao': {
        if (ctx.redacaoReport && !ctx.redacaoReport.temContexto) {
          return {
            success: false,
            error: ctx.redacaoReport.error || 'Sem contexto de pesquisa. Use pesquisarRepertorio antes.',
          };
        }
        setActionLabel('Gerando redação…');
        ctx.onRedacaoAction('gerar');
        return {
          success: true,
          iniciado: true,
          message: 'Geração da redação iniciada na aba de Redação. Depois peça para ler com lerRedacao.',
        };
      }

      case 'lerRedacao': {
        const rep = ctx.redacaoReport;
        if (!rep) return { success: false, error: 'Nenhuma redação gerada ainda. Use pesquisarRepertorio e gerarRedacao antes.' };
        if (!rep.redacao) {
          return { success: false, error: rep.error || 'A redação ainda não foi gerada.' };
        }
        const texto = rep.redacao.slice(0, 2500);
        const vRes = rep.validacao?.resumo;
        const validacaoTxt = vRes
          ? `${vRes.ok}/${vRes.total} ok, ${vRes.warnings} aviso(s), ${vRes.errors} erro(s)`
          : 'ainda não feita';
        return {
          success: true,
          tema: rep.tema,
          comprimento_total: rep.redacaoLength,
          trecho: texto,
          truncado: rep.redacaoLength > texto.length,
          validacao: vRes ?? null,
          message:
            rep.redacaoLength > texto.length
              ? `Redação sobre "${rep.tema}" com ${rep.redacaoLength} caracteres (retornando os primeiros 2500). Validação: ${validacaoTxt}.`
              : `Redação completa sobre "${rep.tema}". Validação: ${validacaoTxt}.`,
        };
      }

      case 'validarRedacao': {
        const rep = ctx.redacaoReport;
        if (!rep || !rep.redacao) {
          return { success: false, error: 'Nenhuma redação para validar. Gere antes com gerarRedacao.' };
        }
        setActionLabel('Validando redação…');
        ctx.onRedacaoAction('validar');
        return {
          success: true,
          iniciado: true,
          message: 'Validação da redação iniciada. Depois peça para ler o resultado com lerRedacao.',
        };
      }

      case 'recomecarRedacao': {
        setActionLabel('Reiniciando redação');
        ctx.onRedacaoAction('recomecar');
        return { success: true, message: 'Pesquisador de Redação reiniciado do zero.' };
      }

      case 'abrirSecaoLibras': {
        const mapa: Record<string, LibrasSubTab> = {
          buscar: 'search',
          curso: 'course',
          praticar: 'practice',
          tutor: 'tutor',
          camera: 'capture-test',
        };
        const secao = String(args.secao || '').toLowerCase();
        const sub = mapa[secao];
        if (!sub) {
          return { success: false, error: 'Seção inválida. Use: buscar, curso, praticar, tutor ou camera.' };
        }
        setActionLabel(`Libras: ${secao}`);
        ctx.onAbrirLibras(sub);
        return { success: true, secao, message: `Aba Libras no Agro aberta — rolando até a seção "${secao}".` };
      }

      case 'buscarSinal': {
        const palavra = String(args.palavra || '').trim();
        if (!palavra) return { success: false, error: 'Informe a palavra (parâmetro palavra).' };
        setActionLabel(`Buscando sinal: ${palavra}`);
        ctx.onBuscarSinal(palavra);
        return {
          success: true,
          palavra,
          iniciado: true,
          message: `Busca do sinal de "${palavra}" iniciada em Libras — os vídeos aparecem na tela.`,
        };
      }

      case 'progressoLibras': {
        setActionLabel('Lendo progresso de Libras');
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('libras_progress_v1') : null;
          const data: Record<string, { learned?: boolean; quizScore?: number }> = raw ? JSON.parse(raw) : {};
          const entries = Object.entries(data);
          const aprendidas = entries.filter(([, v]) => v?.learned).length;
          const scores = entries.map(([, v]) => Number(v?.quizScore) || 0).filter((s) => s > 0);
          const media = scores.length
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : 0;
          const totalCurso = ALL_MODULES.reduce((n, m) => n + (m.words?.length || 0), 0);
          return {
            success: true,
            total_no_curso: totalCurso,
            registradas: entries.length,
            aprendidas,
            media_quiz: media,
            palavras_aprendidas: entries
              .filter(([, v]) => v?.learned)
              .map(([k]) => k)
              .slice(0, 20),
            message:
              entries.length === 0
                ? 'Nenhum progresso registrado ainda no mini-curso de Libras.'
                : `Aprendidas ${aprendidas} de ${totalCurso} palavras do curso (${entries.length} registradas). Média de ${media}% nos quizzes.`,
          };
        } catch {
          return { success: false, error: 'Não foi possível ler o progresso de Libras.' };
        }
      }

      case 'chamarAgente': {
        const alvo = String(args.alvo || 'tutor');
        if (alvo === 'global') {
          // Pedido "para cá" (o usuário quer este assistente): garante que ele
          // é o agente ativo e conecta caso a sessão tenha caído.
          const self = voiceHub.callAgent('global', { connect: true });
          if (!self.ok) return { success: false, error: self.message };
          return {
            success: true,
            message:
              'Você é o agente ativo. Nenhuma transferência foi necessária — continue a conversa normalmente.',
          };
        }
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

      case 'listarCapacidades': {
        setActionLabel('Listando capacidades');
        const total = GLOBAL_TOOLS[0].functionDeclarations.length;
        return {
          success: true,
          total_ferramentas: total,
          categorias: CAPACIDADES,
          message: `${total} ferramentas em ${CAPACIDADES.length} categorias: ${CAPACIDADES.map(
            (c) => c.categoria
          ).join(', ')}.`,
        };
      }

      case 'consultarPrevisaoTempo': {
        const localArg = args.local ? String(args.local).trim() : '';
        const diasRaw = Number(args.dias ?? 5);
        const dias = Math.min(7, Math.max(1, Number.isFinite(diasRaw) && diasRaw > 0 ? Math.round(diasRaw) : 5));
        setActionLabel('Consultando previsão do tempo…');

        const fetchJson = async (url: string, ms = 10000): Promise<unknown> => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), ms);
          try {
            const r = await fetch(url, { signal: ctrl.signal });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
          } finally {
            clearTimeout(timer);
          }
        };

        let lat: number;
        let lon: number;
        let nomeLocal: string;

        try {
          if (localArg) {
            const geo = (await fetchJson(
              `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                localArg
              )}&count=1&language=pt&format=json`
            )) as OpenMeteoGeoResult;
            const place = geo?.results?.[0];
            if (!place) {
              return {
                success: false,
                error: `Não encontrei "${localArg}". Use o nome da cidade (ex: "Lavras").`,
              };
            }
            lat = place.latitude;
            lon = place.longitude;
            nomeLocal = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
          } else {
            const pos = await new Promise<GeolocationPosition | null>((resolve) => {
              if (typeof navigator === 'undefined' || !navigator.geolocation) {
                resolve(null);
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (p) => resolve(p),
                () => resolve(null),
                { timeout: 8000, maximumAge: 600000 }
              );
            });
            if (!pos) {
              return {
                success: false,
                error:
                  'Não consegui usar a geolocalização. Diga a cidade (ex: local "Lavras") e tente de novo.',
              };
            }
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            nomeLocal = 'sua localização';
            try {
              const rev = (await fetchJson(
                `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=pt&format=json`
              )) as OpenMeteoGeoResult;
              const place = rev?.results?.[0];
              if (place?.name) nomeLocal = [place.name, place.admin1].filter(Boolean).join(', ');
            } catch {
              // mantém "sua localização"
            }
          }

          const fc = (await fetchJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
              `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum` +
              `&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto&forecast_days=${dias}`,
            12000
          )) as OpenMeteoForecast;

          const daily = fc.daily ?? {};
          const diasList = (daily.time ?? []).map((data, i) => ({
            data,
            condicao: weatherLabel(daily.weather_code?.[i]),
            temp_max_c: daily.temperature_2m_max?.[i] ?? null,
            temp_min_c: daily.temperature_2m_min?.[i] ?? null,
            prob_chuva_pct: daily.precipitation_probability_max?.[i] ?? null,
            chuva_mm: daily.precipitation_sum?.[i] ?? null,
          }));

          if (diasList.length === 0) {
            return { success: false, error: 'A previsão do tempo não retornou dados agora.' };
          }

          const agora = fc.current
            ? {
                temp_c: fc.current.temperature_2m ?? null,
                condicao: weatherLabel(fc.current.weather_code),
                vento_kmh: fc.current.wind_speed_10m ?? null,
                chuva_agora_mm: fc.current.precipitation ?? null,
              }
            : null;

          const resumo = diasList
            .slice(0, 3)
            .map((d) => {
              const prob =
                d.prob_chuva_pct !== null ? `, ${Math.round(Number(d.prob_chuva_pct))}% de chuva` : '';
              const chuva = d.chuva_mm ? `, ${d.chuva_mm} mm` : '';
              return `${d.data}: ${d.condicao}, mín ${d.temp_min_c}°C, máx ${d.temp_max_c}°C${prob}${chuva}`;
            })
            .join('; ');

          return {
            success: true,
            local: nomeLocal,
            agora,
            dias: diasList,
            message: `Previsão para ${nomeLocal}. ${resumo}.`,
          };
        } catch {
          return {
            success: false,
            error: 'Não consegui consultar a previsão do tempo agora (rede ou serviço indisponível).',
          };
        }
      }

      case 'consultarMemoriaEvidencias': {
        const tema = String(args.tema || '').trim();
        if (!tema) return { success: false, error: 'Informe o tema (parâmetro tema).' };
        setActionLabel('Consultando memória de evidências…');
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 45000);
        try {
          const res = await fetch('/api/evidence/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: tema }),
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as EvidenceSearchResponse;
          const fontes = (data.sources ?? []).slice(0, 10);
          const decisao =
            data.decision === 'reuse'
              ? 'reuso'
              : data.decision === 'complementary'
                ? 'complementar'
                : 'nova_busca';
          const cobertura = typeof data.coverage === 'number' ? data.coverage : 0;
          return {
            success: true,
            tema,
            decisao,
            cobertura,
            total_disponivel: data.stats?.totalSourcesFound ?? fontes.length,
            fontes: fontes.map((s) => ({
              titulo: s.title ?? '',
              portal: s.sourceName ?? null,
              ano: s.year ?? null,
            })),
            message:
              fontes.length > 0
                ? `Memória de evidências sobre "${tema}": decisão ${decisao}, cobertura ${(cobertura * 100).toFixed(0)}%, ${fontes.length} fonte(s) já indexada(s) (até 10 na resposta). Use pesquisarFontes se quiser fontes novas.`
                : `Ainda não há fontes indexadas sobre "${tema}" (decisão ${decisao}). Use pesquisarFontes para buscar novas fontes.`,
          };
        } catch {
          return {
            success: false,
            error: 'Não consegui consultar a memória de evidências agora (rede ou servidor lento).',
          };
        } finally {
          clearTimeout(timer);
        }
      }

      case 'gerarFraseMorfologica': {
        setActionLabel('Sorteando frase para análise morfológica');
        const frase = gerarFraseLocal();
        const texto = fraseParaTexto(frase);
        const palavras = frase.tokens.filter((t) => !t.pontuacao && t.classe).length;
        ctx.onGerarFraseMorfologica(frase);
        return {
          success: true,
          frase: texto,
          palavras_para_classificar: palavras,
          origem: frase.origem,
          message: `Nova frase exibida na seção Análise Morfológica (aba ABNT): "${texto}". Dite a frase e peça para classificar ${palavras} palavras. NÃO revele as classes — quem responde é o aluno, na tela.`,
        };
      }

      case 'lerProgressoAnalise': {
        setActionLabel('Lendo placar da análise morfológica');
        try {
          const raw =
            typeof window !== 'undefined'
              ? localStorage.getItem('n_calc_analise_morfologica_v1')
              : null;
          const p = raw
            ? (JSON.parse(raw) as {
                acertos?: number;
                erros?: number;
                frasesResolvidas?: number;
                sequenciaAtual?: number;
                melhorSequencia?: number;
              })
            : null;
          const acertos = Number(p?.acertos) || 0;
          const erros = Number(p?.erros) || 0;
          const total = acertos + erros;
          const aproveitamento = total ? Math.round((acertos / total) * 100) : 0;
          const frases = Number(p?.frasesResolvidas) || 0;
          const sequencia = Number(p?.sequenciaAtual) || 0;
          const melhor = Number(p?.melhorSequencia) || 0;
          return {
            success: true,
            acertos,
            erros,
            aproveitamento_pct: aproveitamento,
            frases_resolvidas: frases,
            sequencia_atual: sequencia,
            melhor_sequencia: melhor,
            message:
              total === 0
                ? 'Nenhuma resposta registrada ainda na análise morfológica.'
                : `Análise morfológica: ${acertos} acertos e ${erros} erros (${aproveitamento}% de aproveitamento), ${frases} frases resolvidas, sequência atual ${sequencia} e melhor sequência ${melhor}.`,
          };
        } catch {
          return { success: false, error: 'Não foi possível ler o placar da análise morfológica.' };
        }
      }

      case 'iniciarPraticaLibras': {
        const sinal = args.sinal ? String(args.sinal).trim() : '';
        const templates = loadTemplates();
        if (!sinal) {
          setActionLabel('Abrindo prática de sinais');
          ctx.onIniciarPraticaLibras(undefined);
          return {
            success: true,
            sinais: templates.map((t) => ({ id: t.id, nome: t.label })),
            message: `Prática aberta na seção Praticar (aba Libras), com ${templates.length} sinais: ${templates
              .map((t) => t.label)
              .join(', ')}. Escolha um com iniciarPraticaLibras — a câmera será solicitada.`,
          };
        }
        const n = normalizar(sinal);
        const alvo =
          templates.find((t) => normalizar(t.id) === n || normalizar(t.label) === n) ??
          templates.find((t) => normalizar(t.label).includes(n));
        if (!alvo) {
          return {
            success: false,
            error: `Sinal "${sinal}" não existe na prática. Disponíveis: ${templates
              .map((t) => t.label)
              .join(', ')}.`,
          };
        }
        setActionLabel(`Praticando sinal: ${alvo.label}`);
        ctx.onIniciarPraticaLibras(alvo.id);
        return {
          success: true,
          sinal: alvo.label,
          message: `Prática de "${alvo.label}" aberta na seção Praticar (aba Libras). A câmera será pedida ao usuário — avise antes que ela apareça.`,
        };
      }

      case 'iniciarQuizLibras': {
        const moduloArg = args.modulo ? String(args.modulo).trim() : '';
        const modulos = [MODULO_VOCABULARIO, MODULO_FRASES, ...AREAS.flatMap((a) => a.modules)];
        let alvo = MODULO_VOCABULARIO;
        if (moduloArg) {
          const n = normalizar(moduloArg);
          const found =
            modulos.find((m) => normalizar(m.id) === n || normalizar(m.title) === n) ??
            modulos.find(
              (m) => normalizar(m.title).includes(n) || normalizar(m.id).includes(n)
            );
          if (!found) {
            return {
              success: false,
              error: `Módulo "${moduloArg}" não encontrado. Opções: ${modulos
                .map((m) => `${m.id} (${m.title})`)
                .join(', ')}.`,
            };
          }
          alvo = found;
        }
        setActionLabel(`Iniciando quiz: ${alvo.title}`);
        ctx.onIniciarQuizLibras(alvo.id);
        return {
          success: true,
          modulo: alvo.title,
          message: `Quiz do módulo "${alvo.title}" iniciado na seção Mini-Curso (aba Libras).`,
        };
      }

      case 'lerProgressoPesquisa': {
        setActionLabel('Lendo progresso da pesquisa');
        const snap = ctx.pesqSearchSnapshot;
        const rep = ctx.pesqSourcesReport;
        if (!snap && !rep) {
          return { success: false, error: 'Nenhuma busca iniciada ainda. Use pesquisarFontes antes.' };
        }
        const portais = snap
          ? Object.entries(snap.counts)
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([nome, n]) => `${nome}: ${n}`)
          : [];
        const fase =
          !snap
            ? 'sem dados'
            : snap.phase === 'searching'
              ? 'buscando'
              : snap.phase === 'done'
                ? 'concluída'
                : 'com erro';
        const total = snap?.total || rep?.total || 0;
        return {
          success: true,
          fase,
          tema: rep?.tema ?? null,
          total_fontes: total,
          portais: portais.slice(0, 8),
          message:
            fase === 'buscando'
              ? `Busca em andamento (${portais.slice(0, 5).join(', ') || 'iniciando'}). Depois peça lerResultadosFontes.`
              : `Busca ${fase} com ${total} fonte(s)${rep?.tema ? ` sobre "${rep.tema}"` : ''}. Use lerResultadosFontes para ouvir as principais.`,
        };
      }

      case 'copiarArtigo': {
        const art = ctx.pesqArticleReport;
        if (!art || !(art.textoCompleto || art.referencias.length > 0)) {
          return { success: false, error: 'Nenhum artigo gerado ainda. Use gerarArtigoABNT antes.' };
        }
        setActionLabel('Copiando artigo ABNT');
        const texto = art.textoCompleto ?? art.referencias.join('\n\n');
        try {
          await navigator.clipboard.writeText(texto);
        } catch {
          return { success: false, error: 'Não foi possível copiar para a área de transferência.' };
        }
        const trecho = texto.slice(0, 1500);
        return {
          success: true,
          titulo: art.titulo,
          caracteres: texto.length,
          trecho,
          truncado: texto.length > trecho.length,
          message: `Artigo "${art.titulo}" copiado para a área de transferência (${texto.length} caracteres).`,
        };
      }

      case 'copiarRedacao': {
        const rep = ctx.redacaoReport;
        if (!rep || !rep.redacao) {
          return {
            success: false,
            error: 'Nenhuma redação gerada ainda. Use pesquisarRepertorio e gerarRedacao antes.',
          };
        }
        setActionLabel('Copiando redação');
        try {
          await navigator.clipboard.writeText(rep.redacao);
        } catch {
          return { success: false, error: 'Não foi possível copiar para a área de transferência.' };
        }
        const trecho = rep.redacao.slice(0, 1500);
        return {
          success: true,
          tema: rep.tema,
          caracteres: rep.redacaoLength,
          trecho,
          truncado: rep.redacaoLength > trecho.length,
          message: `Redação sobre "${rep.tema}" copiada (${rep.redacaoLength} caracteres).`,
        };
      }

      case 'baixarRedacao': {
        const rep = ctx.redacaoReport;
        if (!rep || !rep.redacao) {
          return {
            success: false,
            error: 'Nenhuma redação gerada ainda. Use pesquisarRepertorio e gerarRedacao antes.',
          };
        }
        setActionLabel('Baixando redação');
        try {
          const blob = new Blob([rep.redacao], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const nome = (rep.tema || 'redacao')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 60);
          link.href = url;
          link.download = `Redacao_${nome || 'redacao'}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch {
          return { success: false, error: 'Não foi possível baixar o arquivo da redação.' };
        }
        return {
          success: true,
          message: `Arquivo .txt da redação sobre "${rep.tema}" baixado no aparelho.`,
        };
      }

      case 'alternarTema': {
        const antes = themeRef.current.isDark;
        themeRef.current.toggleTheme();
        const escuro = !antes;
        setActionLabel(escuro ? 'Tema escuro' : 'Tema claro');
        return {
          success: true,
          tema: escuro ? 'escuro' : 'claro',
          message: `Tema alterado para ${escuro ? 'escuro' : 'claro'}.`,
        };
      }

      case 'abrirAcessibilidade': {
        setActionLabel('Abrindo acessibilidade');
        ctx.onAbrirAcessibilidade();
        return {
          success: true,
          message:
            'Painel de Acessibilidade Libras aberto (reconhecimento de sinais e configurações do widget VLibras).',
        };
      }

      case 'alternarWidgetLibras': {
        const ativo = toggleWidgetSetting();
        setActionLabel(ativo ? 'Widget VLibras ligado' : 'Widget VLibras desligado');
        return {
          success: true,
          widget_ativo: ativo,
          message: `Widget VLibras ${ativo ? 'ligado' : 'desligado'}.`,
        };
      }

      case 'alternarReconhecimentoLibras': {
        const ativo = toggleRecognitionSetting();
        setActionLabel(
          ativo ? 'Reconhecimento de sinais ligado' : 'Reconhecimento de sinais desligado'
        );
        return {
          success: true,
          reconhecimento_ativo: ativo,
          message: `Reconhecimento de sinais em Libras ${ativo ? 'ligado' : 'desligado'}.`,
        };
      }

      case 'iniciarRevisao': {
        const tema = args.tema ? String(args.tema).trim() : '';
        const formato = args.formato ? String(args.formato).trim() : '';
        const contexto = [formato ? `Formato pedido: ${formato}.` : '', tema ? `Tema: ${tema}.` : '']
          .filter(Boolean)
          .join(' ');
        setActionLabel('Transferindo para o Tutor…');
        const res = voiceHub.callAgent('tutor', {
          transitionText: contexto
            ? `Atenção: a sessão foi transferida de outro assistente. ${contexto} Cumprimente e comece já por esse formato/tema.`
            : 'Atenção: a sessão foi transferida de outro assistente. Cumprimente o aluno e pergunte o que ele quer revisar.',
        });
        if (!res.ok) return { success: false, error: res.message };
        return {
          success: true,
          message:
            'Tutor de Revisão ativado com o contexto pedido. Diga uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — quem responde daqui para frente é o Tutor.',
        };
      }

      case 'encerrarConversa': {
        const controls = sessionControlsRef.current;
        if (!controls.disconnect) {
          return { success: false, error: 'Não há sessão de voz ativa para encerrar.' };
        }
        setActionLabel('Encerrando conversa');
        // Espera a despedida sair no socket antes de fechar a conexão.
        setTimeout(() => {
          try {
            sessionControlsRef.current.disconnect?.();
          } catch {
            // conexão já caiu — nada a fazer
          }
        }, 3000);
        return {
          success: true,
          message:
            'Despeça-se do usuário em uma frase curta: a conexão de voz será encerrada automaticamente cerca de 3 segundos depois. Não chame mais nenhuma ferramenta.',
        };
      }

      case 'alternarMudo': {
        const controls = sessionControlsRef.current;
        if (!controls.toggleMute) {
          return { success: false, error: 'Não há sessão de voz ativa.' };
        }
        const antes = controls.isMuted ?? false;
        controls.toggleMute();
        const mudo = !antes;
        setActionLabel(mudo ? 'Microfone em mudo' : 'Microfone ativo');
        return {
          success: true,
          mudo,
          message: mudo
            ? 'Microfone em mudo: você não será ouvido até reativar.'
            : 'Microfone ativo: pode falar.',
        };
      }

      case 'setSupressorRuido': {
        const result = applyNoiseGateToolArgs(args);
        if (!result.ok) {
          return { success: false, error: result.error };
        }
        setActionLabel(result.label);
        return {
          success: true,
          modo: result.state.modo,
          distancia_cm: result.state.distancia_cm,
          message: result.message,
        };
      }

      default:
        return { success: false, error: `Ferramenta ${name} não reconhecida.` };
    }
  }, []);

  const session = useLiveSession({
    config: GLOBAL_CONFIG,
    executeTool,
  });

  const state: LiveAgentState = {
    ...session.state,
    lastUserTranscript: '',
  } as LiveAgentState;

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
    sessionControlsRef.current = {
      disconnect: session.disconnect,
      toggleMute: session.toggleMute,
      isMuted: state.isMuted,
    };
    const prev = lastNotifiedStateRef.current;
    const changed =
      prev.isConnected !== state.isConnected ||
      prev.isConnecting !== state.isConnecting ||
      prev.isMuted !== state.isMuted ||
      prev.status !== state.status ||
      prev.errorMessage !== state.errorMessage ||
      prev.lastUserTranscript !== state.lastUserTranscript ||
      prev.lastAgentTranscript !== state.lastAgentTranscript ||
      prev.currentActionLabel !== state.currentActionLabel ||
      prev.userVolume !== state.userVolume ||
      prev.agentVolume !== state.agentVolume;
    if (changed) {
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
