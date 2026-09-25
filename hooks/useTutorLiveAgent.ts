'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLiveSession, type ExecuteToolFn } from '@/lib/liveSession';
import { voiceHub, type VoiceAgentRuntime, type HubAgentState } from '@/lib/voiceHub';
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
  /** Troca o modo de estudo (mesmo fluxo do chip da tela). */
  setModo?: (modo: TutorModo) => void;
  /** Revela/registra a questão atual (botão "Pular" da tela). */
  pularQuestao?: () => Promise<{
    success: boolean;
    avaliacao?: AvaliacaoResultado | null;
    message: string;
  }>;
  /** Volta para a mesma questão (retry socrático). */
  tentarNovamente?: () => { success: boolean; message: string };
  /** Zera a sessão atual e volta ao início. */
  novaSessao?: () => { success: boolean; message: string };
  /** Quantas questões estão na fila de erros para revisar. */
  getFilaErros?: () => Promise<{ success: boolean; pendentes: number; message: string }>;
  /** Resumo curto da sessão (respondidas, status, tema). */
  getResumo?: () => { success: boolean; resumo?: unknown; message: string };
  /** Progresso salvo na nuvem por tópico. */
  getProgresso?: () => Promise<{
    success: boolean;
    entries?: unknown[];
    message: string;
    error?: string;
  }>;
  /** Materiais enviados pelo aluno (id + nome). */
  getDocumentos?: () => Promise<{
    success: boolean;
    documentos?: Array<{ id: string; name: string }>;
    message: string;
    error?: string;
  }>;
}

const MODO_LABELS: Record<TutorModo, string> = {
  sessao: 'Sessão adaptativa',
  socratico: 'Modo Socrático',
  revisar_erros: 'Revisar erros',
  rapida: 'Revisão rápida',
  conversar: 'Conversar',
};

const MODO_RESUMO: Record<TutorModo, string> = {
  sessao: 'sessão adaptativa de questões com dificuldade que se ajusta ao seu desempenho',
  socratico:
    'modo socrático: até 3 tentativas com pistas, sem entregar o gabarito antes do aluno tentar',
  revisar_erros: 'revisão das questões que o aluno errou em sessões anteriores',
  rapida: 'revisão rápida: sessão curta e direta ao ponto',
  conversar: 'conversa livre sobre agronomia com o contexto de fontes já pesquisadas',
};

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
12. Quando o usuário pedir para gerar um simulado, quiz, flashcards, resumo, plano de estudos, mapa mental ou seminário, use 'criarRevisao(tipo, tema?, subtema?, quantidade?, dificuldade?)' e narre o resultado de forma animada (o material também aparece na tela, no Estúdio de revisão).
13. Flashcards são respondidos por voz: use 'listarFlashcards' para contar os pendentes e narrar a FRENTE do próximo cartão; quando o aluno responder, chame 'responderFlashcard(id, qualidade)' com qualidade 'bom' (acertou), 'facil' (muito fácil) ou 'ruim' (errou) e narre o próximo cartão retornado. Nunca revele o verso antes da resposta.
14. Quando o usuário pedir para trocar o modo de estudo (sessão, socrático, revisar erros, rápida, conversar), use 'escolherModo(modo)' — a sessão será reconfigurada com as novas instruções; avise o aluno da troca.
15. Se o aluno desistir da questão atual ou pedir para pular, use 'pularQuestao' (registra e revela como na tela) e depois ofereça a próxima questão.
16. Se o aluno quiser refazer a MESMA questão, use 'tentarNovamente' (modo socrático) e devolva a caixa de resposta.
17. Se ele quiser começar do zero, use 'novaSessao' e pergunte o novo tema para startTutorSession.
18. Quando perguntar como está o progresso dele, use 'meuProgresso' e narre os pontos fortes/fracos por tópico.
19. Quando perguntar quantos erros tem para revisar, use 'verFilaDeErros' e, se houver pendências, ofereça o modo revisar_erros.
20. Quando perguntar quais materiais ele já enviou, use 'listarDocumentos' e cite os nomes.
21. Quando quiser abrir um material já gerado antes (simulado, quiz, flashcards, resumo, plano, mapa mental ou seminário), use 'carregarRevisao(tipo)' e narre o resumo curto retornado — não leia o material inteiro.
22. Quando pedir para pesquisar/criar mais questões sobre um tema, use 'pesquisarQuestoes(tema?)' — a pesquisa roda em segundo plano; avise que o resultado vai aparecer na tela e continue a conversa.

Fluxo típico:
- Usuário: "Quero revisar calagem" → startTutorSession(tema="Fertilidade do Solo", subtema="Calagem") → leia a questão devolvida e faça a pergunta.
- Usuário responde → submitAnswer → narre feedbackOral + diga o status (dominou/parcial/precisa revisar).
- Próxima → advance → nova questão → repita.
- Flashcards → listarFlashcards → narre a frente → aluno responde → responderFlashcard → próximo cartão.

Sempre que receber o resultado de uma ferramenta, transforme em fala natural de tutor, não leia JSON.`;

  if (modo === 'socratico') {
    return `${base}

MODO SOCRÁTICO ATIVO:
- Nunca entregue o gabarito direto.
- Até 3 tentativas: cada vez que o aluno errar, retorne a ` + '`pista`' + ` do avaliador via submitAnswer e incentive nova tentativa.
- Use a ferramenta 'giveHint' se o aluno pedir ajuda ou disser "não sei".
- Se o aluno desistir, use 'pularQuestao' para registrar/revelar e siga em frente; se quiser tentar de novo, use 'tentarNovamente'.
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
          subtema: {
            type: 'STRING',
            description: 'Subtema opcional (ex: Calagem)',
          },
          quantidade: {
            type: 'NUMBER',
            description: 'Quantidade (questões/cartões) — opcional, padrão do tipo',
          },
          dificuldade: {
            type: 'STRING',
            enum: ['facil', 'media', 'dificil'],
            description: 'Dificuldade opcional das questões/cartões gerados',
          },
        },
        required: ['tipo'],
      },
    },
    {
      name: 'listarFlashcards',
      description:
        'Conta os flashcards pendentes de revisão (repetição espaçada) e mostra o próximo cartão (id, frente e tópico — nunca o verso).',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'escolherModo',
      description:
        'Troca o modo de estudo do tutor. A sessão será reconfigurada com as novas instruções do modo escolhido.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          modo: {
            type: 'STRING',
            enum: ['sessao', 'socratico', 'revisar_erros', 'rapida', 'conversar'],
            description: 'Modo de estudo de destino',
          },
        },
        required: ['modo'],
      },
    },
    {
      name: 'pularQuestao',
      description:
        'Registra e revela a questão atual como pulada (mesmo efeito do botão "Pular" da tela). Use quando o aluno desistir ou não souber responder.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'tentarNovamente',
      description:
        'Volta para a caixa de resposta da MESMA questão para uma nova tentativa (modo socrático).',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'novaSessao',
      description:
        'Zera a sessão atual (feedback e progresso da sessão) e volta ao início para escolher um novo tema.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'meuProgresso',
      description:
        'Consulta o progresso salvo do aluno por tópico (tentativas, domínio, pontos fortes e fracos).',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'verFilaDeErros',
      description: 'Conta as questões que o aluno errou e ainda precisa revisar.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'listarDocumentos',
      description: 'Lista os materiais (PDF/textos) enviados pelo aluno.',
      behavior: 'NON_BLOCKING',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'carregarRevisao',
      description:
        'Carrega um material de revisão já gerado antes (simulado, quiz, flashcards, resumo, plano, mapa mental ou seminário) e devolve um resumo curto para narrar.',
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
            description: 'Tipo de material salvo a carregar',
          },
        },
        required: ['tipo'],
      },
    },
    {
      name: 'pesquisarQuestoes',
      description:
        'Inicia em segundo plano uma pesquisa de novas questões sobre um tema. Não bloqueia a conversa — o resultado aparece na tela.',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          tema: {
            type: 'STRING',
            description: 'Tema da pesquisa (usa o tema da sessão atual se omitido)',
          },
        },
      },
    },
    {
      name: 'responderFlashcard',
      description:
        'Registra a resposta do aluno em um flashcard da repetição espaçada e devolve o próximo cartão pendente (frente + id).',
      behavior: 'NON_BLOCKING',
      parameters: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'id do cartão (retornado por listarFlashcards)' },
          qualidade: {
            type: 'STRING',
            enum: ['bom', 'facil', 'ruim'],
            description: 'Como foi a resposta: bom = acertou, facil = muito fácil, ruim = errou',
          },
        },
        required: ['id', 'qualidade'],
      },
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
        const subtema = args.subtema ? String(args.subtema).trim() : undefined;
        const quantidade =
          args.quantidade !== undefined && Number.isFinite(Number(args.quantidade))
            ? Number(args.quantidade)
            : undefined;
        const dificuldade = ['facil', 'media', 'dificil'].includes(String(args.dificuldade || ''))
          ? String(args.dificuldade)
          : undefined;
        setActionLabel(`Gerando ${tipo.replace('_', ' ')}… (pode demorar)`);
        try {
          const res = await fetch('/api/tutor/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: tipo,
              tema,
              subtema,
              quantidade,
              dificuldade,
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
            cards?: Array<{ id: string; front: string; back: string; topic: string }>;
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
          const proximo = { id: next.id, front: next.front, topic: next.topic };
          return {
            success: true,
            pendentes: cards.length,
            proximo,
            message: `${cards.length} flashcard(s) pendente(s). Próximo cartão (id: ${next.id}, tópico: ${next.topic}, frente): "${next.front}". Narre só a frente, espere o aluno responder e então chame responderFlashcard(id, qualidade).`,
          };
        } catch {
          return { success: false, error: 'Falha de rede ao listar flashcards.' };
        }
      }
      case 'escolherModo': {
        const validModos: TutorModo[] = [
          'sessao',
          'socratico',
          'revisar_erros',
          'rapida',
          'conversar',
        ];
        const novoModo = String(args.modo || '') as TutorModo;
        if (!validModos.includes(novoModo)) {
          return { success: false, error: `Modo inválido. Use: ${validModos.join(', ')}.` };
        }
        if (!ctx.setModo) return { success: false, error: 'Troca de modo indisponível.' };
        setActionLabel(`Mudando para ${MODO_LABELS[novoModo]}…`);
        ctx.setModo(novoModo);
        return {
          success: true,
          message: `Modo alterado para ${MODO_LABELS[novoModo]}: ${MODO_RESUMO[novoModo]}. A sessão será reconfigurada com as novas instruções — avise o aluno da troca e continue com o modo ${MODO_LABELS[novoModo]}.`,
        };
      }
      case 'pularQuestao': {
        if (!ctx.pularQuestao) return { success: false, error: 'Pular questão indisponível.' };
        setActionLabel('Pulando questão…');
        return await ctx.pularQuestao();
      }
      case 'tentarNovamente': {
        if (!ctx.tentarNovamente) return { success: false, error: 'Repetição indisponível.' };
        setActionLabel('Voltando à mesma questão…');
        return ctx.tentarNovamente();
      }
      case 'novaSessao': {
        if (!ctx.novaSessao) return { success: false, error: 'Nova sessão indisponível.' };
        setActionLabel('Zerando sessão…');
        return ctx.novaSessao();
      }
      case 'meuProgresso': {
        if (!ctx.getProgresso) return { success: false, error: 'Progresso indisponível.' };
        setActionLabel('Consultando seu progresso…');
        return await ctx.getProgresso();
      }
      case 'verFilaDeErros': {
        if (!ctx.getFilaErros) return { success: false, error: 'Fila de erros indisponível.' };
        setActionLabel('Verificando fila de erros…');
        return await ctx.getFilaErros();
      }
      case 'listarDocumentos': {
        if (!ctx.getDocumentos) return { success: false, error: 'Lista de documentos indisponível.' };
        setActionLabel('Listando materiais enviados…');
        return await ctx.getDocumentos();
      }
      case 'carregarRevisao': {
        const validTipos = [
          'simulado',
          'quiz',
          'flashcards',
          'resumo',
          'plano',
          'mapa_mental',
          'seminario',
        ];
        const tipo = String(args.tipo || '');
        if (!validTipos.includes(tipo)) {
          return { success: false, error: `Tipo inválido. Use: ${validTipos.join(', ')}.` };
        }
        setActionLabel('Carregando material salvo…');
        try {
          const userId = ctx.getUserId?.() || '';
          const qs = userId
            ? `?kind=${encodeURIComponent(tipo)}&userId=${encodeURIComponent(userId)}`
            : `?kind=${encodeURIComponent(tipo)}`;
          const res = await fetch(`/api/tutor/review${qs}`);
          const data = (await res.json().catch(() => ({}))) as {
            artifacts?: Array<{
              id: string;
              kind: string;
              topic: string | null;
              payload: unknown;
              created_at: string;
            }>;
            error?: string;
          };
          if (!res.ok) {
            return { success: false, error: data.error || 'Falha ao carregar o material salvo.' };
          }
          const doTipo = (data.artifacts ?? []).filter((a) => a.kind === tipo);
          if (doTipo.length === 0) {
            return {
              success: true,
              message:
                tipo === 'flashcards'
                  ? 'Nenhum material salvo. Use listarFlashcards para ver os cartões pendentes ou criarRevisao(tipo="flashcards") para gerar novos.'
                  : `Nenhum ${tipo.replace('_', ' ')} salvo ainda. Use criarRevisao(tipo="${tipo}") para gerar um agora.`,
            };
          }
          const latest = doTipo[0];
          const p = (latest.payload ?? {}) as {
            titulo?: string;
            questoes?: unknown[];
            dias?: unknown[];
            topicos?: unknown[];
            itens?: unknown[];
            arvore?: unknown[];
            cards?: unknown[];
          };
          const detalhes = [
            Array.isArray(p.questoes) ? `${p.questoes.length} questões` : null,
            Array.isArray(p.cards) ? `${p.cards.length} cartões` : null,
            Array.isArray(p.dias) ? `${p.dias.length} dias` : null,
            Array.isArray(p.topicos) ? `${p.topicos.length} tópicos` : null,
            Array.isArray(p.itens) ? `${p.itens.length} itens` : null,
            Array.isArray(p.arvore) ? `${p.arvore.length} nós no mapa` : null,
          ]
            .filter(Boolean)
            .join(', ');
          const titulo = p.titulo || latest.topic || tipo;
          return {
            success: true,
            message: `${doTipo.length} material(is) de ${tipo.replace('_', ' ')} salvo(s). O mais recente: "${titulo}"${detalhes ? ` — ${detalhes}` : ''}. Narre só este resumo e ofereça continuar no Estúdio de revisão (na tela).`,
          };
        } catch {
          return { success: false, error: 'Falha de rede ao carregar o material.' };
        }
      }
      case 'pesquisarQuestoes': {
        const tema = String(args.tema || ctx.getTema?.() || '').trim();
        if (!tema) {
          return {
            success: false,
            error: 'Informe o tema da pesquisa (ou inicie uma sessão para ter tema).',
          };
        }
        setActionLabel('Iniciando pesquisa de questões…');
        void fetch('/api/tutor/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(err.error || `HTTP ${res.status}`);
            }
          })
          .catch((err: unknown) => {
            console.warn('[TutorLive] Pesquisa de questões falhou:', err);
          });
        return {
          success: true,
          message: `Pesquisa de questões sobre "${tema}" iniciada em segundo plano — pode demorar alguns minutos. Acompanhe a tela e continue a conversa com o aluno.`,
        };
      }
      case 'responderFlashcard': {
        const id = String(args.id || '').trim();
        const qualidade = String(args.qualidade || '');
        if (!id) return { success: false, error: 'Informe o id do flashcard.' };
        if (!['bom', 'facil', 'ruim'].includes(qualidade)) {
          return { success: false, error: 'Qualidade inválida. Use: bom, facil ou ruim.' };
        }
        setActionLabel('Registrando sua revisão…');
        try {
          const res = await fetch('/api/tutor/flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'review', id, quality: qualidade }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            return { success: false, error: data.error || 'Falha ao registrar o flashcard.' };
          }
          const userId = ctx.getUserId?.() || '';
          const qs = userId
            ? `?userId=${encodeURIComponent(userId)}&due=1`
            : '?due=1';
          const res2 = await fetch(`/api/tutor/flashcards${qs}`);
          const data2 = (await res2.json().catch(() => ({}))) as {
            cards?: Array<{ id: string; front: string; back: string; topic: string }>;
          };
          if (!res2.ok) {
            return {
              success: true,
              message: 'Resposta registrada, mas não consegui buscar o próximo cartão.',
            };
          }
          const cards = data2.cards ?? [];
          if (cards.length === 0) {
            return {
              success: true,
              message: `Registrado como "${qualidade}". Nenhum cartão pendente — revisão concluída, parabene o aluno.`,
            };
          }
          const next = cards[0];
          const proximo = { id: next.id, front: next.front, topic: next.topic };
          return {
            success: true,
            pendentes: cards.length,
            proximo,
            message: `Registrado como "${qualidade}". ${cards.length} cartão(ões) pendente(s). Próximo cartão (id: ${next.id}, tópico: ${next.topic}, frente): "${next.front}". Narre só a frente e espere a resposta — não revele o verso.`,
          };
        } catch {
          return { success: false, error: 'Falha de rede ao registrar o flashcard.' };
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

  // ---- reconfiguração da sessão quando o modo de estudo muda ----
  // Declarado depois do effect de config do useLiveSession: o configRef já
  // está atualizado; o setTimeout(0) garante que o novo systemInstruction/tools
  // entrem antes de reabrir o socket via switchPersona.
  const prevModoRef = useRef(modo);
  useEffect(() => {
    if (prevModoRef.current === modo) return;
    prevModoRef.current = modo;
    const timer = setTimeout(() => {
      if (!stateRef.current.isConnected) return;
      if (!methodsRef.current.getResumptionHandle()) return;
      methodsRef.current.switchPersona({
        transitionText: `Modo de estudo alterado para: ${MODO_LABELS[modo ?? 'sessao']}. Continue a conversa com as novas instruções.`,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [modo]);

  useEffect(() => {
    const runtime: VoiceAgentRuntime = {
      id: 'tutor',
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
