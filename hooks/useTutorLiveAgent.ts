'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import { voiceHub, type VoiceAgentRuntime } from '@/lib/voiceHub';
import type { AvaliacaoResultado, TutorModo } from '@/lib/tutor/types';

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
    pista?: string | null;
    tentativa?: number;
    message: string;
  }>;
  advance: () => Promise<{ success: boolean; message: string }>;
  endSession: () => Promise<{ success: boolean; message: string }>;
  giveHint?: () => Promise<{
    success: boolean;
    pista?: string | null;
    gabarito?: string | null;
    message: string;
  }>;
  /** Tema da sessão atual (para tools que precisam de contexto). */
  getTema?: () => string | null;
  /** UserId autenticado (flashcards/revisão salvos na nuvem). */
  getUserId?: () => string | null;
}

function buildSystemInstruction(modo?: TutorModo): string {
  const base = `Você é o Tutor Oral de Revisão do aplicativo Agronômica N-Pro — uma monitoria particular de agronomia e ciências agrárias.
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
10. Se o usuário quiser voltar ao cálculo de adubação, ao simulador, ITR, produtividade ou "falar com o Puck", use a ferramenta 'chamarAgente' com alvo 'global' e responda com uma frase curta de despedida — a sessão de voz será transferida para o assistente principal.
11. Quando o usuário perguntar algo sobre o MATERIAL ENVIADO (PDFs/ textos), use 'lerDocumento(pergunta)' e responda com base nos trechos retornados, indicando que veio do material.
12. Quando o usuário pedir para gerar um simulado, quiz, flashcards, resumo, plano de estudos, mapa mental ou seminário, use 'criarRevisao(tipo, tema?)' e narre o resultado de forma animada (o material também aparece na tela, no Estúdio de revisão).
13. Quando pedir para revisar/estudar flashcards, use 'listarFlashcards' para contar os cartões pendentes e ofereça começar.

Fluxo típico:
- Usuário: "Quero revisar calagem" → startTutorSession(tema="Fertilidade do Solo", subtema="Calagem") → leia a questão devolvida e faça a pergunta.
- Usuário responde → submitAnswer → narre feedbackOral + diga o status (dominou/parcial/precisa revisar).
- Próxima → advance → nova questão → repita.

Sempre que receber o resultado de uma ferramenta, transforme em fala natural de tutor, não leia JSON.`;

  if (modo === 'socratico') {
    return `${base}

MODO SOCRÁTICO ATIVO:
- Nunca entregue o gabarito direto.
- Até 3 tentativas: cada vez que o aluno errar, retorne a ` + '`pista`' + ` do avaliador via submitAnswer e incentive nova tentativa.
- Use a ferramenta 'giveHint' se o aluno pedir ajuda ou disser "não sei".
- Recompenense o progresso parcial.`;
  }

  if (modo === 'conversar') {
    return `${base}

MODO CONVERSAR ATIVO:
- Priorize diálogo livre sobre agronomia com o contexto de fontes disponível.
- Se o usuário pedir "me pergunte sobre X", use startTutorSession para iniciar sessão de questões.`;
  }

  if (modo === 'revisar_erros') {
    return `${base}

MODO REVISAR ERROS ATIVO:
- A sessão carrega questões das falhas anteriores do aluno.
- Foque em repetir conceitos que o aluno errou.`;
  }

  if (modo === 'rapida') {
    return `${base}

MODO REVISÃO RÁPIDA:
- Sessão curta (3 questões). Vá direto ao ponto.`;
  }

  return base;
}

function buildTools(modo?: TutorModo) {
  const declarations: unknown[] = [
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
    {
      name: 'chamarAgente',
      description:
        'Transfere a conversa de voz de volta para o assistente principal (calculadora/adubação, ITR, produtividade). Use quando o usuário pedir para voltar ao simulador ou falar com o Puck.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          alvo: {
            type: 'STRING',
            enum: ['global'],
            description: 'Agente de destino. Atualmente apenas "global".',
          },
        },
        required: ['alvo'],
      },
    },
    {
      name: 'lerDocumento',
      description:
        'Busca trechos relevantes no material enviado pelo aluno (PDF/texto). Use quando ele perguntar algo sobre o documento enviado.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          pergunta: {
            type: 'STRING',
            description: 'O que procurar no material (ex: "o que diz sobre dose de calagem?")',
          },
        },
        required: ['pergunta'],
      },
    },
    {
      name: 'criarRevisao',
      description:
        'Gera material de revisão na tela (simulado, quiz, flashcards, resumo, plano de estudos, mapa mental ou seminário) a partir do material enviado ou do tema. Pode demorar alguns segundos.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          tipo: {
            type: 'STRING',
            enum: [
              'simulado',
              'quiz',
              'flashcards',
              'resumo',
              'plano',
              'mapa_mental',
              'seminario',
            ],
            description: 'Tipo de material a gerar',
          },
          tema: {
            type: 'STRING',
            description: 'Tema (usa o tema da sessão atual se omitted)',
          },
          quantidade: {
            type: 'NUMBER',
            description: 'Quantidade (questões/cartões) — opcional, padrão do tipo',
          },
        },
        required: ['tipo'],
      },
    },
    {
      name: 'listarFlashcards',
      description:
        'Conta os flashcards pendentes de revisão (repetição espaçada) e mostra o próximo cartão.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
  ];

  if (modo === 'socratico') {
    declarations.push({
      name: 'giveHint',
      description: 'Fornece a próxima pista da questão atual no modo socrático (ou o gabarito na última tentativa).',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    });
  }

  return [{ functionDeclarations: declarations }];
}

export function useTutorLiveAgent(bridge: TutorLiveBridgeContext, modo?: TutorModo) {
  const bridgeRef = useRef(bridge);

  useEffect(() => {
    bridgeRef.current = bridge;
  }, [bridge]);

  const executeTool: ExecuteToolFn = useCallback(async (name, args, setActionLabel) => {
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
      case 'giveHint': {
        setActionLabel('Buscando pista…');
        if (!ctx.giveHint) return { success: false, error: 'Pista indisponível.' };
        return ctx.giveHint();
      }
      case 'lerDocumento': {
        const pergunta = String(args.pergunta || '').trim();
        if (!pergunta) {
          return { success: false, error: 'Faça uma pergunta sobre o material enviado.' };
        }
        setActionLabel('Lendo o material enviado…');
        try {
          const res = await fetch('/api/tutor/documents/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: pergunta, limit: 6 }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            chunks?: Array<{ text: string; similarity: number }>;
            error?: string;
          };
          if (!res.ok) {
            return { success: false, error: data.error || 'Falha ao consultar o material.' };
          }
          const chunks = data.chunks ?? [];
          if (chunks.length === 0) {
            return {
              success: true,
              message:
                'Nenhum trecho relevante encontrado no material enviado. Reformule a pergunta ou verifique se o documento foi enviado.',
            };
          }
          const trechos = chunks
            .map((c, i) => `[Trecho ${i + 1}] ${c.text}`)
            .join('\n\n')
            .slice(0, 6000);
          return {
            success: true,
            trechos,
            message:
              'Trechos do material do aluno. Responda com base neles, diga que veio do material enviado e não invente conteúdo fora dele.',
          };
        } catch {
          return { success: false, error: 'Falha de rede ao consultar o material.' };
        }
      }
      case 'criarRevisao': {
        const tipo = String(args.tipo || '');
        const validTipos = [
          'simulado',
          'quiz',
          'flashcards',
          'resumo',
          'plano',
          'mapa_mental',
          'seminario',
        ];
        if (!validTipos.includes(tipo)) {
          return { success: false, error: `Tipo inválido. Use: ${validTipos.join(', ')}.` };
        }
        const tema = String(args.tema || ctx.getTema?.() || '').trim();
        if (!tema) return { success: false, error: 'Informe o tema da revisão.' };
        const quantidade =
          args.quantidade !== undefined && Number.isFinite(Number(args.quantidade))
            ? Number(args.quantidade)
            : undefined;
        setActionLabel(`Gerando ${tipo.replace('_', ' ')}… (pode demorar)`);
        try {
          const res = await fetch('/api/tutor/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: tipo,
              tema,
              quantidade,
              userId: ctx.getUserId?.() ?? null,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            result?: {
              kind: string;
              payload: unknown;
              artifactId: string | null;
              flashcardIds?: string[];
              fonte: string;
            };
            error?: string;
          };
          if (!res.ok || !data.result) {
            return {
              success: false,
              error: data.error || 'Falha ao gerar o material de revisão.',
            };
          }
          const r = data.result;
          let detalhe = '';
          if (r.kind === 'flashcards') {
            const n = r.flashcardIds?.length ?? 0;
            detalhe = `${n} flashcards criados e salvos para repetição espaçada.`;
          } else {
            const p = r.payload as { titulo?: string; questoes?: unknown[]; dias?: unknown[] };
            const extra = p.questoes
              ? ` ${p.questoes.length} questões com gabarito e explicação.`
              : p.dias
                ? ` ${p.dias.length} dias planejados.`
                : '';
            detalhe = `${p.titulo || tipo}.${extra}`;
          }
          return {
            success: true,
            message: `${detalhe} O material também está na tela, no Estúdio de revisão. Narre o que foi criado e ofereça o próximo passo.`,
          };
        } catch {
          return { success: false, error: 'Falha de rede ao gerar o material de revisão.' };
        }
      }
      case 'listarFlashcards': {
        setActionLabel('Verificando flashcards pendentes…');
        try {
          const userId = ctx.getUserId?.() || '';
          const qs = userId
            ? `?userId=${encodeURIComponent(userId)}&due=1`
            : '?due=1';
          const res = await fetch(`/api/tutor/flashcards${qs}`);
          const data = (await res.json().catch(() => ({}))) as {
            cards?: Array<{ front: string; back: string; topic: string }>;
          };
          const cards = data.cards ?? [];
          if (cards.length === 0) {
            return {
              success: true,
              message:
                'Nenhum flashcard pendente agora. Ofereça gerar novos flashcards com criarRevisao(tipo="flashcards").',
            };
          }
          const next = cards[0];
          return {
            success: true,
            pendentes: cards.length,
            proximo: next,
            message: `${cards.length} flashcard(s) pendente(s). Próximo cartão (frente): "${next.front}". Ofereça começar a revisão — o aluno responde e a tela mostra o verso na hora.`,
          };
        } catch {
          return { success: false, error: 'Falha de rede ao listar flashcards.' };
        }
      }
      case 'chamarAgente': {
        const alvo = String(args.alvo || 'global');
        if (alvo !== 'global') {
          return { success: true, message: 'Você já é o agente ativo.' };
        }
        setActionLabel('Retornando ao assistente…');
        const res = voiceHub.callAgent('global', {
          transitionText:
            'Atenção: a sessão foi transferida de volta do Tutor. Retome a conversa agronômica com o aluno.',
          delayNavigation: true,
        });
        if (!res.ok) return { success: false, error: res.message };
        return {
          success: true,
          message:
            'Assistente principal ativado. Diga uma frase curta de despedida (ex: "Voltando pro simulador!") — quem responde daqui para frente é o assistente principal.',
        };
      }
      default:
        return { error: `Ferramenta ${name} não reconhecida.` };
    }
  }, []);

  const config = useMemo(
    () => ({
      systemInstruction: buildSystemInstruction(modo),
      tools: buildTools(modo),
      temperature: 0.4,
      thinkingLevel: 'high' as const,
      labels: {
        obtainingToken: 'Obtendo credencial de voz…',
        connecting: 'Conectando ao Gemini Live…',
        configuring: 'Configurando tutor oral…',
        ready: 'Tutor pronto • Pode falar',
        listening: 'Ouvindo…',
        thinking: 'Pensando…',
      },
      logPrefix: 'TutorLive',
    }),
    [modo]
  );

  const session = useLiveSession({ config, executeTool });

  // ---- registro no hub de agentes de voz ----
  const stateRef = useRef(session.state);
  const lastNotifiedStateRef = useRef(session.state);
  const methodsRef = useRef({
    connect: session.connect,
    disconnect: session.disconnect,
    switchPersona: session.switchPersona,
    getResumptionHandle: session.getResumptionHandle,
    toggleMute: session.toggleMute,
  });

  useLayoutEffect(() => {
    stateRef.current = session.state;
    methodsRef.current = {
      connect: session.connect,
      disconnect: session.disconnect,
      switchPersona: session.switchPersona,
      getResumptionHandle: session.getResumptionHandle,
      toggleMute: session.toggleMute,
    };
    if (lastNotifiedStateRef.current !== session.state) {
      lastNotifiedStateRef.current = session.state;
      voiceHub.agentStateChanged();
    }
  });

  useEffect(() => {
    const runtime: VoiceAgentRuntime = {
      id: 'tutor',
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
    return () => voiceHub.unregister('tutor');
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
