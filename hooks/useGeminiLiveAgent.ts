'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { smoothScrollToSection, PageSection } from '@/lib/pageAutomator';
import type { ABNTReference, ReferenceType } from '@/lib/abnt/types';
import { REFERENCE_TYPES } from '@/lib/abnt/constants';
import { parseAuthorString } from '@/lib/abnt/parsers/author';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import { voiceHub, type VoiceAgentRuntime } from '@/lib/voiceHub';
import type { TabId } from '@/components/GooeyTabPanel';
import type { CornYieldFillParams } from '@/components/CornYieldCalculator';
import type { PesqSourcesReport, PesqArticleReport } from '@/components/PesquisadorAgro';
import type { RedacaoVoiceReport } from '@/components/PesquisadorRedacao';
import type { LibrasSubTab } from '@/components/LibrasNoAgro';
import { PRESET_FERTILIZERS, resolveFertilizerId } from '@/lib/fertilizers';
import { SQLikeCalculationDB, type CalculationRecord } from '@/lib/storage';
import { ALL_MODULES } from '@/lib/libras-course-data';

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
10. Rolagem com 'scrollToSection' nas seções: 'parametros', 'resultados', 'dose_total', 'parcelamento', 'balanco', 'presets', 'produtividade', 'solo', 'eficiencia', 'fonte_nitrogenada', 'estimativa_milho', 'itr', 'abnt', 'topo'. E troca de aba com 'mudarAba' ('nitrogen', 'productivity', 'itr', 'abnt', 'pesquisador', 'libras', 'redacao') — a aba do Tutor NÃO existe em 'mudarAba' (para lá é 'chamarAgente'); se a seção estiver em outra aba, mude de aba primeiro e aguarde um instante antes de rolar.
11. Após cada alteração no simulador a tela rola automaticamente até o local afetado; quando o usuário pedir os resultados (dose total, parcelamento, balanço), role para 'resultados'/'dose_total'/'parcelamento'/'balanco'.
12. Para revisar, estudar, treinar com questões, simulado, seminário, mapa mental, flashcards ou falar com o Tutor, use 'chamarAgente' com alvo 'tutor'. Ela abre a aba do Tutor e transfere a sessão de voz. Responda com uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — de quem responde é ele. Se o usuário pedir para "voltar para o agente global", "falar com o Puck" ou "mudar para o agente de voz" enquanto VOCÊ já é o agente ativo, não chame nenhuma ferramenta: responda que você já é ele e siga a conversa. Alvo 'global' só se aplica quando a chamada vem do Tutor (devolvendo a conversa).
13. Pesquisador Agro: 'pesquisarFontes' (busca fontes sobre um tema — demora; depois leia com 'lerResultadosFontes'), 'gerarArtigoABNT' (gera artigo ABNT — demora bastante; as referências ficam prontas para 'copiarCitacaoABNT'). Sempre avise que a ação foi iniciada e que o resultado pode ser lido depois.
14. Pesquisador de Redação: fluxo = 'pesquisarRepertorio' (tema) → 'gerarRedacao' → 'lerRedacao' (lê o texto e a validação) → 'validarRedacao' (revalida) e 'recomecarRedacao' (zera). Não pule a pesquisa de repertório: sem contexto a geração falha.
15. Libras no Agro: 'abrirSecaoLibras' (seções: buscar, curso, praticar, tutor, camera), 'buscarSinal' (busca o vídeo do sinal de uma palavra) e 'progressoLibras' (lê o progresso do mini-curso). NÃO existe um "agente Libras": Libras é uma aba — use 'mudarAba' com alvo 'libras' ou 'abrirSecaoLibras'.

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
- Ferramentas longas não existem aqui; alterações são imediatas.`;

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
        description: 'Rola suavemente a tela até uma seção específica para o usuário visualizar.',
        behavior: 'NON_BLOCKING',
        parameters: {
          type: 'OBJECT',
          properties: {
            section: {
              type: 'STRING',
              description:
                'Seção de destino: "parametros", "resultados", "dose_total", "parcelamento", "balanco", "presets", "produtividade", "solo", "eficiencia", "fonte_nitrogenada", "estimativa_milho", "itr", "abnt", "topo"',
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
    ],
  },
];

/** Mapa seção → aba que a contém (seções não listadas ficam na aba nitrogen). */
const SECTION_TAB_MAP: Record<string, TabId | null> = {
  topo: null,
  estimativa_milho: 'productivity',
  itr: 'itr',
  abnt: 'abnt',
  libras_search: 'libras',
  librascurso: 'libras',
  libras_practice: 'libras',
  libras_tutor: 'libras',
  libras_capture_test: 'libras',
};

const TAB_LABELS: Record<string, string> = {
  nitrogen: 'Adubação Nitrogenada',
  productivity: 'Produtividade de Milho',
  itr: 'Calculadora ITR',
  abnt: 'Referências ABNT',
  pesquisador: 'Pesquisador Agro',
  libras: 'Libras no Agro',
  redacao: 'Pesquisador de Redação',
};

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

    // Rola para uma seção, trocando de aba antes se necessário (o conteúdo
    // das abas só monta depois da troca — por isso o delay).
    const scrollTo = (section: string, label?: string) => {
      const targetTab: TabId | null =
        section in SECTION_TAB_MAP ? SECTION_TAB_MAP[section] : 'nitrogen';
      if (targetTab === null) {
        smoothScrollToSection(section, label);
        return;
      }
      const current = simContextRef.current;
      if (targetTab !== current.activeTab) {
        current.onNavigateTab(targetTab);
        setTimeout(() => smoothScrollToSection(section, label), 400);
      } else {
        smoothScrollToSection(section, label);
      }
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
        const section = String(args.section) as PageSection;
        const label = args.label ? String(args.label) : undefined;
        setActionLabel(`Rolando para: ${section}`);
        scrollTo(section, label);
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
