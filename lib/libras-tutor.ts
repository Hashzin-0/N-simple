/**
 * Libras Tutor State Management
 * Manages the pedagogical state of the tutoring session.
 */

import type { GestureTemplate, RecognitionResult, EvaluationResult } from './libras-types';

export type TutorMode = 'conversar' | 'ensinar' | 'praticar' | 'desafiar' | 'revisar' | 'contextualizar';

export type DemonstrationMethod = 'vlibras' | 'youtube' | 'recognition-preview';

export interface TutorState {
  mode: TutorMode;
  currentModule: string;
  currentSign: string | null;
  learnedSigns: string[];
  currentExercise?: {
    sign: string;
    attempts: number;
    bestRecognition: number;
    lastEvaluation: EvaluationResult | null;
  };
  preferredDemonstration: DemonstrationMethod;
  conversationHistory: TutorMessage[];
  sessionStart: number;
  signsPracticed: number;
  totalAttempts: number;
}

export interface TutorMessage {
  role: 'tutor' | 'user';
  content: string;
  timestamp: number;
  intent?: TutorIntent;
  metadata?: {
    sign?: string;
    confidence?: number;
    evaluation?: EvaluationResult;
  };
}

export type TutorIntent =
  | { type: 'teach_sign'; sign: string; method?: DemonstrationMethod }
  | { type: 'practice_sign'; sign: string }
  | { type: 'evaluate_result'; result: RecognitionResult; evaluation: EvaluationResult }
  | { type: 'ask_question'; question: string }
  | { type: 'reexplain_sign'; sign: string; method: DemonstrationMethod }
  | { type: 'challenge'; signs: string[] }
  | { type: 'review'; signs: string[] }
  | { type: 'contextualize'; context: string; signs: string[] }
  | { type: 'general_chat'; message: string }
  | { type: 'unknown' };

// ─── Initial State ───

export function createInitialState(learnedSigns: string[] = []): TutorState {
  return {
    mode: 'conversar',
    currentModule: 'agricultura',
    currentSign: null,
    learnedSigns,
    preferredDemonstration: 'youtube',
    conversationHistory: [],
    sessionStart: Date.now(),
    signsPracticed: 0,
    totalAttempts: 0,
  };
}

// ─── Intent Parsing ───

/**
 * Parse user input (text or recognized sign) into a structured intent.
 * In production, this would be handled by Gemini. Here we provide a simple fallback.
 */
export function parseIntent(
  input: string,
  recognizedSign?: RecognitionResult
): TutorIntent {
  const lower = input.toLowerCase().trim();

  // If we have a recognized sign with good confidence, treat as practice attempt
  if (recognizedSign && recognizedSign.confidence !== 'none') {
    return {
      type: 'evaluate_result',
      result: recognizedSign,
      evaluation: {
        handShape: 0,
        motion: 0,
        orientation: 0,
        relativePosition: 0,
        handednessMatch: true,
        timingQuality: 0,
      },
    };
  }

  // Teach intent
  if (lower.includes('ensin') || lower.includes('aprend') || lower.includes('mostre')) {
    const signMatch = extractSign(lower);
    if (signMatch) {
      return { type: 'teach_sign', sign: signMatch };
    }
  }

  // Practice intent
  if (lower.includes('pratic') || lower.includes('tentar') || lower.includes('fazer')) {
    const signMatch = extractSign(lower);
    if (signMatch) {
      return { type: 'practice_sign', sign: signMatch };
    }
  }

  // Re-explain intent
  if (lower.includes('novamente') || lower.includes('de novo') || lower.includes('no entendi')) {
    return { type: 'reexplain_sign', sign: '', method: 'youtube' };
  }

  // Challenge intent
  if (lower.includes('desaf') || lower.includes('test') || lower.includes('quiz')) {
    return { type: 'challenge', signs: [] };
  }

  // Review intent
  if (lower.includes('revis') || lower.includes('pratic')) {
    return { type: 'review', signs: [] };
  }

  // Contextualize intent
  if (lower.includes('situac') || lower.includes('contexto') || lower.includes('exemplo real')) {
    return { type: 'contextualize', context: input, signs: [] };
  }

  return { type: 'general_chat', message: input };
}

function extractSign(text: string): string | null {
  const signs = [
    'milho', 'gado', 'trator', 'plantar', 'agua', 'pasto', 'colheita', 'vaca',
    'soja', 'adubo', 'semente', 'solo', 'irrigacao', 'praga', 'doenca',
    'bovino', 'boi', 'bezerro', 'racao', 'leite', 'carne', 'vacina',
    'colheitadeira', 'plantadeira', 'pulverizador', 'arado',
    'custo', 'lucro', 'venda', 'compra', 'preco', 'mercado',
    'sustentabilidade', 'conservacao', 'floresta', 'biodiversidade',
  ];

  for (const sign of signs) {
    if (text.includes(sign)) {
      return sign;
    }
  }
  return null;
}

// ─── Response Generation ───

/**
 * Generate a tutor response based on the current state and intent.
 * In production, this would be handled by Gemini with a system prompt.
 * Here we provide a structured fallback.
 */
export function generateResponse(
  state: TutorState,
  intent: TutorIntent
): { message: string; newState: Partial<TutorState>; action?: { type: string; payload: unknown } } {
  switch (intent.type) {
    case 'teach_sign':
      return {
        message: `Vou te ensinar o sinal de ${intent.sign}. Observe o exemplo primeiro.`,
        newState: {
          mode: 'ensinar',
          currentSign: intent.sign,
        },
        action: { type: 'show_demonstration', payload: { sign: intent.sign, method: intent.method || state.preferredDemonstration } },
      };

    case 'practice_sign':
      return {
        message: `Agora é sua vez! Faça o sinal de ${intent.sign}.`,
        newState: {
          mode: 'praticar',
          currentSign: intent.sign,
          currentExercise: {
            sign: intent.sign,
            attempts: 0,
            bestRecognition: 0,
            lastEvaluation: null,
          },
        },
        action: { type: 'start_practice', payload: { sign: intent.sign } },
      };

    case 'evaluate_result':
      return {
        message: formatEvaluationResponse(intent.result, intent.evaluation, state),
        newState: {
          totalAttempts: state.totalAttempts + 1,
          currentExercise: state.currentExercise ? {
            ...state.currentExercise,
            attempts: state.currentExercise.attempts + 1,
            bestRecognition: Math.max(state.currentExercise.bestRecognition, Math.round(intent.result.confidence === 'high' ? 90 : intent.result.confidence === 'medium' ? 70 : 40)),
            lastEvaluation: intent.evaluation,
          } : undefined,
        },
      };

    case 'reexplain_sign':
      return {
        message: 'Sem problema! Vou mostrar novamente de outra forma.',
        newState: { mode: 'ensinar' },
        action: { type: 'show_demonstration', payload: { sign: state.currentSign, method: 'youtube' } },
      };

    case 'challenge':
      return {
        message: 'Hora do desafio! Vou te perguntar sinais e você faz com a câmera.',
        newState: { mode: 'desafiar' },
        action: { type: 'start_challenge', payload: { signs: intent.signs } },
      };

    case 'review':
      return {
        message: `Vamos revisar os sinais que você já aprendeu: ${state.learnedSigns.join(', ')}.`,
        newState: { mode: 'revisar' },
      };

    case 'contextualize':
      return {
        message: `Imagine uma situação no campo. ${intent.context}`,
        newState: { mode: 'contextualizar' },
      };

    default:
      return {
        message: 'Como posso te ajudar a aprender Libras no agronegócio?',
        newState: {},
      };
  }
}

function formatEvaluationResponse(
  result: RecognitionResult,
  evaluation: EvaluationResult,
  state: TutorState
): string {
  if (result.confidence === 'none') {
    return 'Não consegui identificar o sinal. Tente posicionar a mão mais visível à câmera e faça o movimento novamente.';
  }

  if (result.confidence === 'low') {
    return `Sua execução apresenta semelhança parcial com ${result.candidateLabel}. Continue praticando!`;
  }

  const parts: string[] = [];

  if (evaluation.handShape >= 75) parts.push('o formato das mãos ficou bom');
  else if (evaluation.handShape >= 50) parts.push('o formato das mãos pode melhorar');

  if (evaluation.motion >= 75) parts.push('o movimento está correto');
  else if (evaluation.motion >= 50) parts.push('o movimento pode ser mais preciso');
  else parts.push('atenção ao movimento');

  if (evaluation.timingQuality >= 70) parts.push('a velocidade está boa');

  const prefix = result.confidence === 'high'
    ? `Muito bem! Você acertou o sinal de ${result.candidateLabel}.`
    : `Possível correspondência: ${result.candidateLabel}.`;

  const exercise = state.currentExercise;
  if (exercise && exercise.attempts >= 3 && parts.length > 0) {
    return `${prefix} ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}. Você já tentou ${exercise.attempts} vezes. Quer continuar ou passar para o próximo sinal?`;
  }

  return `${prefix} ${parts.join('. ')}. Continue praticando!`;
}
