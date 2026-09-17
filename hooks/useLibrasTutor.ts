'use client';

import { useCallback, useRef, useState } from 'react';
import {
  createInitialState,
  parseIntent,
  generateResponse,
  type TutorState,
  type TutorMessage,
  type TutorIntent,
  type DemonstrationMethod,
} from '@/lib/libras-tutor';
import { loadTemplates } from '@/lib/libras-templates';
import type { RecognitionResult, EvaluationResult, GestureTemplate } from '@/lib/libras-types';

interface UseLibrasTutorReturn {
  state: TutorState;
  templates: GestureTemplate[];
  sendMessage: (text: string) => TutorMessage;
  processSignResult: (result: RecognitionResult, evaluation: EvaluationResult) => TutorMessage;
  setMode: (mode: TutorState['mode']) => void;
  setDemonstrationMethod: (method: DemonstrationMethod) => void;
  clearHistory: () => void;
}

export function useLibrasTutor(): UseLibrasTutorReturn {
  const [state, setState] = useState<TutorState>(() => createInitialState());
  const [templates, setTemplates] = useState<GestureTemplate[]>(() => loadTemplates());
  const historyRef = useRef<TutorMessage[]>([]);

  const addMessage = useCallback((msg: TutorMessage) => {
    historyRef.current.push(msg);
    setState((prev) => ({
      ...prev,
      conversationHistory: [...historyRef.current],
    }));
  }, []);

  const sendMessage = useCallback(
    (text: string): TutorMessage => {
      const userMsg: TutorMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      const intent = parseIntent(text);
      const { message, newState, action } = generateResponse(state, intent);

      const tutorMsg: TutorMessage = {
        role: 'tutor',
        content: message,
        timestamp: Date.now(),
        intent,
        metadata: action ? { sign: (action.payload as { sign?: string })?.sign } : undefined,
      };
      addMessage(tutorMsg);

      if (Object.keys(newState).length > 0) {
        setState((prev) => ({ ...prev, ...newState }));
      }

      return tutorMsg;
    },
    [state, addMessage]
  );

  const processSignResult = useCallback(
    (result: RecognitionResult, evaluation: EvaluationResult): TutorMessage => {
      const intent: TutorIntent = {
        type: 'evaluate_result',
        result,
        evaluation,
      };

      const { message, newState } = generateResponse(state, intent);

      const tutorMsg: TutorMessage = {
        role: 'tutor',
        content: message,
        timestamp: Date.now(),
        intent,
        metadata: {
          sign: result.candidateLabel,
          confidence: result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.4,
          evaluation,
        },
      };
      addMessage(tutorMsg);

      if (Object.keys(newState).length > 0) {
        setState((prev) => ({ ...prev, ...newState }));
      }

      return tutorMsg;
    },
    [state, addMessage]
  );

  const setMode = useCallback((mode: TutorState['mode']) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const setDemonstrationMethod = useCallback((method: DemonstrationMethod) => {
    setState((prev) => ({ ...prev, preferredDemonstration: method }));
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setState(createInitialState());
  }, []);

  return {
    state,
    templates,
    sendMessage,
    processSignResult,
    setMode,
    setDemonstrationMethod,
    clearHistory,
  };
}
