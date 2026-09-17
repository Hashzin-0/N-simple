'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import {
  FPSTracker,
  calculateStability,
  determineHandedness,
  buildDiagnostic,
} from '@/lib/libras-capture-debug';
import type {
  HandLandmarks,
  HandLabel,
  CaptureDiagnostic,
  CaptureRecording,
  CapturedFrame,
} from '@/lib/libras-types';

interface UseLibrasCaptureReturn {
  isReady: boolean;
  isRecording: boolean;
  diagnostic: Partial<CaptureDiagnostic>;
  recording: CaptureRecording | null;
  capturedFrames: CapturedFrame[];
  latestLeftHand: HandLandmarks[] | null;
  latestRightHand: HandLandmarks[] | null;
  startRecording: () => void;
  stopRecording: () => CaptureRecording | null;
  clearRecording: () => void;
  processFrame: (video: HTMLVideoElement) => Promise<CapturedFrame | null>;
}

const STABILITY_WINDOW = 15;

export function useLibrasCapture(): UseLibrasCaptureReturn {
  const handsRef = useRef<Hands | null>(null);
  const isInitialized = useRef(false);
  const fpsTracker = useRef(new FPSTracker(30));
  const frameHistory = useRef<{ left: HandLandmarks[] | null; right: HandLandmarks[] | null }[]>([]);
  const startTimeRef = useRef(0);
  const frameCountRef = useRef(0);

  // Refs for real-time data (avoids stale closures)
  const isRecordingRef = useRef(false);
  const capturedFramesRef = useRef<CapturedFrame[]>([]);
  const diagnosticRef = useRef<Partial<CaptureDiagnostic>>({});

  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Partial<CaptureDiagnostic>>({});
  const [recording, setRecording] = useState<CaptureRecording | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [latestLeftHand, setLatestLeftHand] = useState<HandLandmarks[] | null>(null);
  const [latestRightHand, setLatestRightHand] = useState<HandLandmarks[] | null>(null);

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

  const processFrame = useCallback(
    async (video: HTMLVideoElement): Promise<CapturedFrame | null> => {
      if (!handsRef.current || !video || video.readyState < 2) {
        return null;
      }

      // Initialize start time on first frame
      if (startTimeRef.current === 0) {
        startTimeRef.current = performance.now();
      }

      return new Promise((resolve) => {
        try {
          handsRef.current!.onResults((results: Results) => {
            fpsTracker.current.tick();
            frameCountRef.current++;

            const { left, right, handedness, handCount } = determineHandedness(
              results.multiHandedness as { label: string; score: number }[] | undefined,
              results.multiHandLandmarks as HandLandmarks[][] | undefined
            );

            const landmarksPerHand =
              left?.length === 21 ? 21 : right?.length === 21 ? 21 : 0;

            // Update frame history for stability
            frameHistory.current.push({ left, right });
            if (frameHistory.current.length > STABILITY_WINDOW) {
              frameHistory.current.shift();
            }

            const stability = calculateStability(frameHistory.current, STABILITY_WINDOW);

            // Build diagnostic
            const diag = buildDiagnostic({
              frameCount: frameCountRef.current,
              startTime: startTimeRef.current,
              fps: fpsTracker.current.getFPS(),
              handCount,
              handedness,
              landmarksPerHand,
              stability,
            });

            // Update refs (real-time, no stale closure)
            diagnosticRef.current = diag;
            setDiagnostic(diag);
            setLatestLeftHand(left);
            setLatestRightHand(right);

            const frame: CapturedFrame = {
              timestamp: performance.now(),
              leftLandmarks: left,
              rightLandmarks: right,
              handedness,
              handCount,
            };

            // If recording, accumulate frames via ref (always current)
            if (isRecordingRef.current) {
              capturedFramesRef.current.push(frame);
              setCapturedFrames([...capturedFramesRef.current]);
            }

            resolve(frame);
          });

          handsRef.current!.send({ image: video });
        } catch (e) {
          console.error('Error processing frame:', e);
          resolve(null);
        }
      });
    },
    [] // No dependencies — reads from refs, always current
  );

  const startRecording = useCallback(() => {
    capturedFramesRef.current = [];
    startTimeRef.current = performance.now();
    frameCountRef.current = 0;
    fpsTracker.current.reset();
    frameHistory.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);
    setCapturedFrames([]);
  }, []);

  const stopRecording = useCallback((): CaptureRecording | null => {
    isRecordingRef.current = false;
    setIsRecording(false);

    // Read from refs (always current, not stale)
    const diag = buildDiagnostic({
      frameCount: frameCountRef.current,
      startTime: startTimeRef.current,
      fps: fpsTracker.current.getFPS(),
      handCount: diagnosticRef.current.handsDetected ?? 0,
      handedness: diagnosticRef.current.handedness ?? 'unknown',
      landmarksPerHand: diagnosticRef.current.landmarksPerHand ?? 0,
      stability: calculateStability(frameHistory.current, STABILITY_WINDOW),
    });

    const result: CaptureRecording = {
      id: `rec_${Date.now()}`,
      frames: [...capturedFramesRef.current], // Copy from ref
      diagnostic: diag,
      recordedAt: new Date().toISOString(),
    };

    setRecording(result);
    return result;
  }, []);

  const clearRecording = useCallback(() => {
    setRecording(null);
    setCapturedFrames([]);
    capturedFramesRef.current = [];
  }, []);

  return {
    isReady,
    isRecording,
    diagnostic,
    recording,
    capturedFrames,
    latestLeftHand,
    latestRightHand,
    startRecording,
    stopRecording,
    clearRecording,
    processFrame,
  };
}
