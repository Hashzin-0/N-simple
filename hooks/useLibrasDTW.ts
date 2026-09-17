'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { TemporalBuffer } from '@/lib/libras-temporal-buffer';
import { extractFeatures, flattenFeatures } from '@/lib/libras-features';
import { recognize, evaluate, getFeedbackMessage } from '@/lib/libras-scorer';
import { loadTemplates } from '@/lib/libras-templates';
import { determineHandedness } from '@/lib/libras-capture-debug';
import type {
  HandLandmarks,
  GestureTemplate,
  GestureState,
  RecognitionResult,
  EvaluationResult,
} from '@/lib/libras-types';

interface UseLibrasDTWReturn {
  isReady: boolean;
  gestureState: GestureState;
  recognition: RecognitionResult | null;
  evaluation: EvaluationResult | null;
  feedbackMessage: string;
  attempt: number;
  processFrame: (video: HTMLVideoElement) => Promise<HandLandmarks[] | null>;
  setTargetTemplate: (template: GestureTemplate | null) => void;
  reset: () => void;
}

export function useLibrasDTW(): UseLibrasDTWReturn {
  const handsRef = useRef<Hands | null>(null);
  const isInitialized = useRef(false);
  const bufferRef = useRef(new TemporalBuffer({ minFrames: 10, maxFrames: 60 }));
  const attemptRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [gestureState, setGestureState] = useState<GestureState>('idle');
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [targetTemplate, setTargetTemplateState] = useState<GestureTemplate | null>(null);

  // Initialize MediaPipe Hands
  useEffect(() => {
    if (isInitialized.current) return;

    const initHands = async () => {
      try {
        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        });
        handsRef.current = hands;
        isInitialized.current = true;
        setIsReady(true);
      } catch (e) {
        console.error('Failed to initialize MediaPipe Hands:', e);
      }
    };
    initHands();

    return () => {
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  const setTargetTemplate = useCallback((template: GestureTemplate | null) => {
    setTargetTemplateState(template);
    bufferRef.current.clear();
    setGestureState('idle');
    setRecognition(null);
    setEvaluation(null);
    setFeedbackMessage('');
    attemptRef.current = 0;
    setAttempt(0);
  }, []);

  const processFrame = useCallback(
    async (video: HTMLVideoElement): Promise<HandLandmarks[] | null> => {
      if (!handsRef.current || !video || video.readyState < 2) {
        return null;
      }

      return new Promise((resolve) => {
        try {
          handsRef.current!.onResults((results: Results) => {
            const { left, right, handCount } = determineHandedness(
              results.multiHandedness as { label: string; score: number }[] | undefined,
              results.multiHandLandmarks as HandLandmarks[][] | undefined
            );

            // Need at least one hand
            if (handCount === 0) {
              resolve(null);
              return;
            }

            // Extract features
            const features = extractFeatures(left, right);
            const flatFeatures = flattenFeatures(features);

            // Push to buffer
            bufferRef.current.pushFrame(flatFeatures);

            // Update gesture state
            const newState = bufferRef.current.getGestureState();
            setGestureState(newState);

            // If gesture is done and we have a target template, evaluate
            if (newState === 'done' && targetTemplate) {
              const sequence = bufferRef.current.getActiveSequence();
              if (sequence.length >= 5) {
                attemptRef.current++;
                setAttempt(attemptRef.current);

                const allExamples = targetTemplate.signers.flatMap((s) =>
                  s.examples.map((e) => e.features)
                );

                if (allExamples.length > 0) {
                  const rec = recognize(sequence, [targetTemplate]);
                  const bestIdx = allExamples.findIndex((ex) => {
                    // Find which example matched best (simplified)
                    return true; // TODO: track best example index from compareWithTemplate
                  });
                  const evl = evaluate(sequence, targetTemplate, Math.max(0, bestIdx));
                  const msg = getFeedbackMessage(rec, evl, attemptRef.current);

                  setRecognition(rec);
                  setEvaluation(evl);
                  setFeedbackMessage(msg);
                }
              }
            }

            // Return landmarks for canvas drawing
            const allLandmarks: HandLandmarks[] = [];
            if (left) allLandmarks.push(...left);
            if (right) allLandmarks.push(...right);
            resolve(allLandmarks.length > 0 ? allLandmarks : null);
          });

          handsRef.current!.send({ image: video });
        } catch (e) {
          console.error('Error processing frame:', e);
          resolve(null);
        }
      });
    },
    [targetTemplate]
  );

  const reset = useCallback(() => {
    bufferRef.current.clear();
    setGestureState('idle');
    setRecognition(null);
    setEvaluation(null);
    setFeedbackMessage('');
    attemptRef.current = 0;
    setAttempt(0);
  }, []);

  return {
    isReady,
    gestureState,
    recognition,
    evaluation,
    feedbackMessage,
    attempt,
    processFrame,
    setTargetTemplate,
    reset,
  };
}
