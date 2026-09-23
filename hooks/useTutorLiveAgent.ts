'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
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

  return {
    state: session.state,
    connect: session.connect,
    disconnect: session.disconnect,
    toggleMute: session.toggleMute,
    toggleConnection: session.toggleConnection,
  };
}
