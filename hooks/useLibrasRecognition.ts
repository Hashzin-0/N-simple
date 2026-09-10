'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { getClassifier, type RecognitionResult } from '@/lib/libras-model';
import { useLibrasSettings } from './useLibrasSettings';

interface UseLibrasRecognitionReturn {
  processFrame: (video: HTMLVideoElement) => Promise<RecognitionResult | null>;
  classifyLandmarks: (landmarks: { x: number; y: number; z: number }[]) => RecognitionResult | null;
  resetClassifier: () => void;
}

export function useLibrasRecognition(): UseLibrasRecognitionReturn {
  const { settings } = useLibrasSettings();
  const handsRef = useRef<Hands | null>(null);
  const isInitialized = useRef(false);

  // Initialize MediaPipe Hands
  useEffect(() => {
    if (isInitialized.current) return;

    const initHands = async () => {
      try {
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        });

        handsRef.current = hands;
        isInitialized.current = true;
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

  // Update classifier settings when sensitivity changes
  useEffect(() => {
    const classifier = getClassifier(settings.recognitionSensitivity);
    classifier.setSensitivity(settings.recognitionSensitivity);
  }, [settings.recognitionSensitivity]);

  // Update custom signs when they change
  useEffect(() => {
    const classifier = getClassifier();
    classifier.setCustomSigns(settings.customSigns);
  }, [settings.customSigns]);

  const classifyLandmarks = useCallback(
    (landmarks: { x: number; y: number; z: number }[]): RecognitionResult | null => {
      if (!landmarks || landmarks.length === 0) return null;

      const classifier = getClassifier(settings.recognitionSensitivity);
      return classifier.classify(landmarks);
    },
    [settings.recognitionSensitivity]
  );

  const processFrame = useCallback(
    async (video: HTMLVideoElement): Promise<RecognitionResult | null> => {
      if (!handsRef.current || !video || video.readyState < 2) {
        return null;
      }

      return new Promise((resolve) => {
        try {
          handsRef.current!.onResults((results: Results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              const landmarks = results.multiHandLandmarks[0];
              const result = classifyLandmarks(landmarks);
              resolve(result);
            } else {
              resolve(null);
            }
          });

          handsRef.current!.send({ image: video });
        } catch (e) {
          console.error('Error processing frame:', e);
          resolve(null);
        }
      });
    },
    [classifyLandmarks]
  );

  const resetClassifier = useCallback(() => {
    const classifier = getClassifier();
    classifier.clearHistory();
  }, []);

  return {
    processFrame,
    classifyLandmarks,
    resetClassifier,
  };
}
