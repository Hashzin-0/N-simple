'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import { voiceHub, type VoiceAgentRuntime, type HubAgentState } from '@/lib/voiceHub';
import { smoothScrollToSection, isPageSection } from '@/lib/pageAutomator';
import { describeSections, resolveSection, tabForSection } from '@/lib/sectionNav';
import { applyNoiseGateToolArgs } from '@/lib/noiseGate';
import { ALL_MODULES, MODULO_VOCABULARIO, MODULO_FRASES, AREAS } from '@/lib/libras-course-data';
import { loadTemplates } from '@/lib/libras-templates';
import { openLibrasVideo, closeLibrasVideo } from '@/lib/librasVideoPlayer';
import { mostrarSinalNoVLibras } from '@/lib/vlibras';
import { setWidgetEnabled, getLibrasSettings } from '@/hooks/useLibrasSettings';
import type { LibrasVoiceSearchReport, LibrasCoachReport } from '@/lib/libras-types';

export interface LibrasLiveState {
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

type LibrasSecao = 'search' | 'course' | 'practice' | 'tutor' | 'capture-test';

/**
 * Ponte entre o hook de voz e o conteúdo da aba Libras (montado em
 * `components/LibrasNoAgro`). O estado continua na página: pedidos com `seq`
 * e reportes (`*Report`) para as tools de leitura.
 */
export interface LibrasLiveBridgeContext {
  /** Abre uma seção da aba Libras e rola até ela. */
  onAbrirSecao: (subTab: LibrasSecao) => void;
  /** Busca vídeos de um sinal (a página troca de aba e dispara a busca). */
  onBuscarSinal: (palavra: string) => void;
  /** Abre a prática DTW (câmera) de um sinal ou a lista de sinais. */
  onIniciarPratica: (templateId?: string) => void;
  /** Inicia um quiz do mini-curso. */
  onIniciarQuiz: (moduleId?: string) => void;
  /** Observa a câmera por `segundos` e pede avaliação visual ao Gemini. */
  onObservarSinal: (alvo: string | null, segundos: number) => void;
  getSearchReport: () => LibrasVoiceSearchReport | null;
  getCoachReport: () => LibrasCoachReport | null;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CAPACIDADES = [
  'Busca de sinais em Libras com vídeos do YouTube (buscarSinal, lerResultadosSinais, mostrarSinalYouTube)',
  'Tradutor VLibras na tela (mostrarSinalVLibras) — escreve a palavra e reproduz o sinal',
  'Mini-curso de Libras: progresso, aulas e quiz (progressoLibras, iniciarQuizLibras)',
  'Prática de sinais com câmera e reconhecimento (iniciarPraticaLibras)',
  'Observação da câmera com avaliação visual do seu sinal (observarMeuSinal, lerFeedbackSinal)',
  'Navegação pelas seções da aba Libras (abrirSecaoLibras, scrollToSection)',
  'Transferência de conversa para o assistente principal ou o Tutor (chamarAgente)',
  'Supressor de ruído do microfone (setSupressorRuido)',
];

function buildSystemInstruction(): string {
  return `Você é o assistente "Libras" do aplicativo Agronômica N-Pro — especialista na aba "Libras no Agro" (sinais em Libras para o agronegócio).
Sua voz oficial é 'Puck'. Fale português do Brasil, de forma curta, natural e didática — você fala com a pessoa em tempo real.

VOCÊ CUIDA DE:
1. Buscar vídeos de um sinal (busca no YouTube) e mostrar o vídeo na tela.
2. Escrever a palavra no TRADUTOR do widget VLibras e reproduzir o sinal oficial.
3. Mini-curso de Libras (progresso, aulas, quiz) e prática de sinais com câmera.
4. Observar a pessoa pela câmera e dar feedback visual do sinal que ela faz.
5. Navegar pelas seções da aba Libras.

FLUXO VÍDEO (YouTube): para "mostrar o sinal de X em vídeo", se a pessoa não disse Onde, PERGUNTE primeiro: "Quer ver no YouTube ou no tradutor do VLibras?".
- YouTube: 'buscarSinal(palavra)' → 'lerResultadosSinais()' (narre quantos vídeos achou e o título do primeiro) → 'mostrarSinalYouTube(indice)' com o índice do vídeo escolhido (padrão 0). Use 'fecharVideo' para parar a reprodução.
- VLibras: 'mostrarSinalVLibras(palavra)' — automatiza o widget oficial (abre Tradutor, digita a palavra e traduz). Pode demorar alguns segundos; narre o resultado retornado.
Se a pessoa já escolheu o destino, vá direto para ele.

FLUXO CÂMERA: antes de abrir a câmera AVISE que ela será solicitada pelo navegador.
- 'observarMeuSinal(alvo, segundos)' inicia a observação (a câmera abre e uma contagem roda). Use alvo null para pedir que ela faça QUALQUER sinal (você identifica depois); use alvo "milho" para avaliar um sinal específico. segundos padrão 4.
- Depois de a contagem terminar, chame 'lerFeedbackSinal()' e narre a mensagem de feedback (não leia JSON). Se ainda estiver observando, avise e pergunte de novo em instantes.
- 'iniciarPraticaLibras(sinal?)' abre a prática DTW com reconhecimento; sem sinal, devolve a lista de sinais para a pessoa escolher.

MINI-CURSO: 'progressoLibras' lê o placar; 'iniciarQuizLibras(modulo?)' inicia o quiz (padrão vocabulário básico).

NAVEGAÇÃO: 'abrirSecaoLibras(secao)' e 'scrollToSection(section)' rolam até uma seção da aba Libras (buscar, curso, praticar, tutor, camera). Se a seção pedida for de OUTRA aba, use 'scrollToSection' mesmo assim — ele transfere a conversa para o agente dono daquela aba sozinho; responda apenas com uma frase curta de despedida (ex: "Vou te chamar o Puck!").

TROCA DE AGENTE: para voltar ao cálculo de adubação, ao simulador, ITR, produtividade ou "falar com o Puck", use 'chamarAgente(alvo="global")'; para estudar/revisar, use 'chamarAgente(alvo="tutor")'. Responda com UMA frase curta de despedida — quem responde depois é o outro agente. Se pedirem para trocar para "libras", você já é ele: não chame ferramenta nenhuma.

SUPRESSOR DE RUÍDO: 'setSupressorRuido(modo)' — 'automatico' (padrão), 'manual' (usa distancia_cm) ou 'desligado'.

OUTRAS: 'alternarWidgetVLibras(ligado?)' liga/desliga o widget VLibras na tela, 'listarCapacidades' resume o que você faz e 'encerrarConversa' encerra a conversa (depois da sua despedida).

REGRAS:
- Nunca leia JSON: transforme todo retorno em fala natural.
- Não prometa resultado antes da resposta da ferramenta.
- Seja breve: uma ou duas frases por resposta.
- Em caso de erro retornado, explique em uma frase e ofereça a alternativa (ex: YouTube quando o VLibras falhar).`;
}

function buildTools() {
  const declarations: unknown[] = [
    {
      name: 'abrirSecaoLibras',
      description: 'Abre uma seção da aba Libras no Agro e rola até ela.',
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
        'Busca vídeos de um sinal em Libras (ex: "gado", "milho") e mostra os resultados na tela. Use em seguida lerResultadosSinais para narrar o que apareceu.',
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
      name: 'lerResultadosSinais',
      description:
        'Lê o resultado da última busca de sinais: quantos vídeos foram encontrados, títulos, canais e sentidos ambiguos. Chame logo após buscarSinal.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'mostrarSinalYouTube',
      description:
        'Reproduz um dos vídeos encontrados pela última busca de sinais (player na tela, com som). Use o índice do vídeo listado em lerResultadosSinais (padrão 0).',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          indice: { type: 'NUMBER', description: 'Índice do vídeo na lista (padrão 0).' },
        },
      },
    },
    {
      name: 'fecharVideo',
      description: 'Fecha o player de vídeo de sinais que está na tela.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'mostrarSinalVLibras',
      description:
        'Abre o tradutor do widget VLibras, escreve a palavra e traduz — o sinal oficial aparece na tela. Pode demorar alguns segundos (automatiza o widget oficial).',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          palavra: { type: 'STRING', description: 'Palavra a traduzir (mínimo 3 letras; ex: "adubação").' },
        },
        required: ['palavra'],
      },
    },
    {
      name: 'alternarWidgetVLibras',
      description: 'Liga ou desliga o widget VLibras (intérprete) exibido na tela.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          ligado: { type: 'BOOLEAN', description: 'true para ligar, false para desligar. Se omitido, alterna.' },
        },
      },
    },
    {
      name: 'progressoLibras',
      description: 'Lê o progresso do mini-curso de Libras: palavras aprendidas e média de acertos nos quizzes.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'iniciarPraticaLibras',
      description:
        'Abre a prática de sinais em Libras (reconhecimento com câmera) e, quando informado, seleciona o sinal. Sem sinal, lista os sinais disponíveis. A câmera será solicitada ao usuário.',
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
      name: 'observarMeuSinal',
      description:
        'Abre a câmera e observa a pessoa assinar por alguns segundos, enviando quadros para avaliação visual (Gemini). Depois chame lerFeedbackSinal. AVISE antes que a câmera será pedida.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          alvo: {
            type: 'STRING',
            description:
              'Sinal que a pessoa vai fazer (ex: "milho"). Omitir para identificar qualquer sinal que ela fizer.',
          },
          segundos: { type: 'NUMBER', description: 'Tempo de observação em segundos (padrão 4, de 2 a 10).' },
        },
      },
    },
    {
      name: 'lerFeedbackSinal',
      description:
        'Lê o resultado da avaliação visual da câmera (identificação, acerto, correções e mensagem pronta). Chame quando a contagem de observarMeuSinal terminar.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'scrollToSection',
      description:
        'Rola a tela até uma seção do app. Seções da aba Libras: "libras_search" (Buscar), "librascurso" (Mini-Curso), "libras_practice" (Praticar), "libras_tutor" (Tutor), "libras_capture_test" (Teste de Câmera). Se a seção for de outra aba, a conversa é transferida automaticamente para o agente daquele contexto.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          section: { type: 'STRING', description: 'Id da seção (ex: "libras_practice") ou alias legado.' },
          label: { type: 'STRING', description: 'Rótulo amigável opcional para a fala.' },
        },
        required: ['section'],
      },
    },
    {
      name: 'chamarAgente',
      description:
        'Transfere a conversa para o assistente principal (global) ou para o Tutor de Revisão (tutor). Use com uma frase curta de despedida.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          alvo: { type: 'STRING', enum: ['global', 'tutor'], description: 'Agente de destino.' },
        },
        required: ['alvo'],
      },
    },
    {
      name: 'setSupressorRuido',
      description:
        'Configura o supressor de ruído do microfone: "automatico" (padrão, ajusta sozinho), "manual" (fixa a distância em distancia_cm) ou "desligado".',
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
    {
      name: 'listarCapacidades',
      description: 'Lista tudo o que este assistente de voz sabe fazer. Use quando perguntarem o que você faz.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'encerrarConversa',
      description: 'Encerra a conversa de voz (a gravação e a reprodução param depois da despedida).',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
  ];

  return [{ functionDeclarations: declarations }];
}

type HubMethods = {
  connect: () => void;
  disconnect: () => void;
  switchPersona: (options?: { resumeHandle?: string; transitionText?: string }) => void;
  getResumptionHandle: () => string | null;
  toggleMute: () => void;
};

export function useLibrasLiveAgent(bridge: LibrasLiveBridgeContext) {
  const bridgeRef = useRef(bridge);
  useEffect(() => {
    bridgeRef.current = bridge;
  }, [bridge]);

  // Métodos de sessão/estado expostos ao hub — preenchidos no layout effect
  // abaixo (declarados antes do executeTool por referência no encerrarConversa).
  const stateRef = useRef<HubAgentState | null>(null);
  const lastNotifiedStateRef = useRef<HubAgentState | null>(null);
  const methodsRef = useRef<HubMethods>({
    connect: () => {},
    disconnect: () => {},
    switchPersona: () => {},
    getResumptionHandle: () => null,
    toggleMute: () => {},
  });

  /** Instante da última busca/disparo de coach — para julgar frescor do reporte. */
  const lastSearchRequestAtRef = useRef(0);
  const lastCoachRequestAtRef = useRef(0);
  const lastQueryRef = useRef('');

  const executeTool: ExecuteToolFn = useCallback(async (name, args, setActionLabel) => {
    const ctx = bridgeRef.current;
    switch (name) {
      case 'abrirSecaoLibras': {
        const mapa: Record<string, LibrasSecao> = {
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
        ctx.onAbrirSecao(sub);
        return { success: true, secao, message: `Rolando até a seção "${secao}" da aba Libras.` };
      }

      case 'buscarSinal': {
        const palavra = String(args.palavra || '').trim();
        if (!palavra) return { success: false, error: 'Informe a palavra (parâmetro palavra).' };
        setActionLabel(`Buscando sinal: ${palavra}`);
        lastQueryRef.current = normalizar(palavra);
        lastSearchRequestAtRef.current = Date.now();
        ctx.onBuscarSinal(palavra);
        return {
          success: true,
          palavra,
          iniciado: true,
          message: `Busca do sinal de "${palavra}" iniciada. Chame lerResultadosSinais em seguida para narrar o que apareceu.`,
        };
      }

      case 'lerResultadosSinais': {
        setActionLabel('Lendo resultados da busca');
        const rep = ctx.getSearchReport();
        if (!rep || rep.at < lastSearchRequestAtRef.current) {
          return {
            success: true,
            pronto: false,
            message: 'A busca ainda está carregando. Espere um instante e chame lerResultadosSinais de novo.',
          };
        }
        if (rep.error) {
          return { success: false, error: rep.error };
        }
        const q = normalizar(rep.query);
        const esperado = lastQueryRef.current;
        if (esperado && q !== esperado && !q.includes(esperado) && !esperado.includes(q)) {
          return {
            success: true,
            pronto: false,
            message: 'Os resultados na tela ainda não correspondem à busca pedida. Chame buscarSinal de novo.',
          };
        }
        return {
          success: true,
          query: rep.query,
          total: rep.totalFound,
          ambiguo: rep.ambiguousSense,
          sentidos: rep.senseOptions.map((s) => ({ id: s.id, rotulo: s.label, sentido: s.description })),
          sinais: rep.signGroups.map((g) => ({ sinal: g.sign, videos: g.results.length })),
          videos: rep.results.map((r, i) => ({
            indice: i,
            titulo: r.title,
            canal: r.channel,
            videoId: r.videoId,
          })),
          message: `${rep.results.length} vídeo(s) encontrados para "${rep.query}". ${
            rep.results[0] ? `Primeiro: ${rep.results[0].title} (${rep.results[0].channel}).` : ''
          }${rep.ambiguousSense ? ' A palavra tem mais de um sentido — pergunte qual é o caso.' : ''}`,
        };
      }

      case 'mostrarSinalYouTube': {
        const rep = ctx.getSearchReport();
        if (!rep || rep.error || rep.results.length === 0) {
          return {
            success: false,
            error: 'Nenhum vídeo disponível. Use buscarSinal primeiro e depois lerResultadosSinais.',
          };
        }
        const idx = Math.max(0, Math.min(rep.results.length - 1, Math.floor(Number(args.indice ?? 0)) || 0));
        const video = rep.results[idx];
        setActionLabel(`Reproduzindo: ${video.title}`);
        openLibrasVideo(video.videoId, video.title);
        return {
          success: true,
          indice: idx,
          titulo: video.title,
          canal: video.channel,
          message: `Reproduzindo "${video.title}" (${video.channel}) na tela.`,
        };
      }

      case 'fecharVideo': {
        closeLibrasVideo();
        setActionLabel('Fechando vídeo');
        return { success: true, message: 'Vídeo fechado.' };
      }

      case 'mostrarSinalVLibras': {
        const palavra = String(args.palavra || '').trim();
        if (!palavra) return { success: false, error: 'Informe a palavra (parâmetro palavra).' };
        setActionLabel(`VLibras: ${palavra}`);
        const res = await mostrarSinalNoVLibras(palavra);
        if (!res.ok) {
          return { success: false, error: res.message, etapa: res.etapa };
        }
        return { success: true, palavra, message: res.message };
      }

      case 'alternarWidgetVLibras': {
        const next =
          typeof args.ligado === 'boolean' ? args.ligado : !getLibrasSettings().widgetEnabled;
        setWidgetEnabled(next);
        setActionLabel(next ? 'Ligando widget VLibras' : 'Desligando widget VLibras');
        return {
          success: true,
          ligado: next,
          message: `Widget VLibras ${next ? 'ligado' : 'desligado'}.`,
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

      case 'iniciarPraticaLibras': {
        const sinal = args.sinal ? String(args.sinal).trim() : '';
        const templates = loadTemplates();
        if (!sinal) {
          setActionLabel('Abrindo prática de sinais');
          ctx.onIniciarPratica(undefined);
          return {
            success: true,
            sinais: templates.map((t) => ({ id: t.id, nome: t.label })),
            message: `Prática aberta na seção Praticar, com ${templates.length} sinais: ${templates
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
        ctx.onIniciarPratica(alvo.id);
        return {
          success: true,
          sinal: alvo.label,
          message: `Prática de "${alvo.label}" aberta na seção Praticar. A câmera será pedida ao usuário — avise antes que ela apareça.`,
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
            modulos.find((m) => normalizar(m.title).includes(n) || normalizar(m.id).includes(n));
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
        ctx.onIniciarQuiz(alvo.id);
        return {
          success: true,
          modulo: alvo.title,
          message: `Quiz do módulo "${alvo.title}" iniciado na seção Mini-Curso.`,
        };
      }

      case 'observarMeuSinal': {
        const alvo = args.alvo ? String(args.alvo).trim() : null;
        const segundosRaw = Number(args.segundos ?? 4);
        const segundos = Number.isFinite(segundosRaw) ? Math.min(10, Math.max(2, segundosRaw)) : 4;
        setActionLabel(alvo ? `Observando sinal: ${alvo}` : 'Observando a câmera');
        lastCoachRequestAtRef.current = Date.now();
        ctx.onObservarSinal(alvo, segundos);
        return {
          success: true,
          alvo,
          segundos,
          iniciado: true,
          message: `Observando a câmera por ${segundos} segundos${
            alvo ? ` enquanto você faz o sinal de "${alvo}"` : ' — faça qualquer sinal'
          }. Quando a contagem terminar, chame lerFeedbackSinal.`,
        };
      }

      case 'lerFeedbackSinal': {
        setActionLabel('Lendo feedback da câmera');
        const rep = ctx.getCoachReport();
        if (!rep || rep.at < lastCoachRequestAtRef.current) {
          return {
            success: true,
            pronto: false,
            message: 'A câmera ainda está observando ou a avaliação está a caminho. Chame lerFeedbackSinal de novo em instantes.',
          };
        }
        if (!rep.ok) {
          return { success: false, error: rep.message };
        }
        return {
          success: true,
          pronto: true,
          alvo: rep.alvo,
          identificacao: rep.identificacao ?? null,
          acerto: rep.acerto ?? null,
          correcoes: rep.correcoes,
          elogio: rep.elogio ?? null,
          message: rep.message,
        };
      }

      case 'scrollToSection': {
        const input = String(args.section ?? '').trim();
        const label = args.label ? String(args.label) : undefined;
        if (!input) return { success: false, error: 'Informe a seção de destino (parâmetro section).' };
        const resolved = resolveSection(input);
        if (!resolved && !isPageSection(input)) {
          return {
            success: false,
            error: `Seção "${input}" não existe. Seções válidas: ${describeSections()}.`,
          };
        }
        const sectionId = resolved?.id ?? input;
        const sectionLabel = label ?? resolved?.label ?? sectionId;
        const targetTab = tabForSection(sectionId);

        // Seção fora da aba Libras: transfere para o agente dono com o comando
        // de rolagem (delayNavigation preserva a despedida antes de desmontar).
        if (targetTab !== null && targetTab !== 'libras') {
          const alvo: 'global' | 'tutor' = targetTab === 'tutor' ? 'tutor' : 'global';
          const nomeAgente = alvo === 'tutor' ? 'Tutor' : 'assistente principal';
          setActionLabel(`${nomeAgente}: ${sectionLabel}`);
          const res = voiceHub.callAgent(alvo, {
            transitionText: `Comando transferido do assistente Libras: o usuário pediu para rolar a tela até a seção "${sectionLabel}" (id: ${sectionId}, aba ${targetTab}). Assuma a conversa e execute AGORA a tool scrollToSection(section="${sectionId}") sem perguntar nada; depois confirme o scroll em uma frase curta.`,
            delayNavigation: true,
            tab: targetTab,
          });
          if (!res.ok) return { success: false, error: res.message };
          return {
            success: true,
            section: sectionId,
            aba: targetTab,
            transferido: true,
            message: `A seção "${sectionLabel}" fica na aba ${targetTab}: a conversa foi transferida para o ${nomeAgente} com o comando de rolagem. Diga uma frase curta de despedida (ex: "Voltando pro simulador!") — quem rola a tela é ele.`,
          };
        }

        setActionLabel(`Rolando para: ${sectionLabel}`);
        const ok = smoothScrollToSection(sectionId, sectionLabel);
        if (!ok) return { success: false, error: `Seção "${sectionId}" não encontrada na tela.` };
        return {
          success: true,
          section: sectionId,
          ...(resolved ? { label: resolved.label } : {}),
          aba: 'libras',
          message: `Rolando até "${sectionLabel}".`,
        };
      }

      case 'chamarAgente': {
        const alvo = String(args.alvo || 'global');
        if (alvo === 'libras') {
          return { success: true, message: 'Você já é o assistente de Libras.' };
        }
        if (alvo !== 'global' && alvo !== 'tutor') {
          return { success: false, error: 'Alvo inválido. Use "global" ou "tutor".' };
        }
        setActionLabel(alvo === 'tutor' ? 'Transferindo para o Tutor…' : 'Retornando ao assistente…');
        const res = voiceHub.callAgent(alvo, {
          transitionText:
            alvo === 'tutor'
              ? 'Atenção: a sessão foi transferida do assistente de Libras. O usuário quer revisar/estudar. Cumprimente e pergunte o tema.'
              : 'Atenção: a sessão foi transferida de volta do assistente de Libras. Retome a conversa agronômica com o usuário.',
          delayNavigation: true,
        });
        if (!res.ok) return { success: false, error: res.message };
        return {
          success: true,
          message:
            alvo === 'tutor'
              ? 'Tutor de Revisão ativado. Diga uma frase curta de despedida (ex: "Vou te chamar o Tutor!") — quem responde daqui para frente é ele.'
              : 'Assistente principal ativado. Diga uma frase curta de despedida (ex: "Voltando pro simulador!") — quem responde daqui para frente é ele.',
        };
      }

      case 'setSupressorRuido': {
        const result = applyNoiseGateToolArgs(args);
        if (!result.ok) return { success: false, error: result.error };
        setActionLabel(result.label);
        return {
          success: true,
          modo: result.state.modo,
          distancia_cm: result.state.distancia_cm,
          message: result.message,
        };
      }

      case 'listarCapacidades': {
        setActionLabel('Listando capacidades');
        return { success: true, capacidades: CAPACIDADES, message: CAPACIDADES.join('; ') };
      }

      case 'encerrarConversa': {
        setActionLabel('Encerrando conversa');
        setTimeout(() => methodsRef.current.disconnect(), 3000);
        return {
          success: true,
          message: 'Até logo! A conversa de voz será encerrada em alguns segundos.',
        };
      }

      default:
        return { success: false, error: `Ferramenta ${name} não reconhecida.` };
    }
  }, []);

  const config = useMemo(
    () => ({
      systemInstruction: buildSystemInstruction(),
      tools: buildTools(),
      temperature: 0.3,
      thinkingLevel: 'low' as const,
      labels: {
        obtainingToken: 'Obtendo credencial de voz…',
        connecting: 'Conectando ao Gemini Live…',
        configuring: 'Configurando assistente de Libras…',
        ready: 'Libras pronto • Pode falar',
        listening: 'Ouvindo…',
        thinking: 'Pensando…',
      },
      logPrefix: 'LibrasLive',
    }),
    []
  );

  const session = useLiveSession({ config, executeTool });

  // ---- registro no hub de agentes de voz ----
  useLayoutEffect(() => {
    const state = session.state as unknown as HubAgentState;
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
      id: 'libras',
      getState: () => stateRef.current as HubAgentState,
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
    return () => voiceHub.unregister('libras');
  }, []);

  return {
    state: session.state,
    connect: session.connect,
    disconnect: session.disconnect,
    switchPersona: session.switchPersona,
    getResumptionHandle: session.getResumptionHandle,
    clearResumption: session.clearResumption,
    toggleMute: session.toggleMute,
    toggleConnection: session.toggleConnection,
  };
}
