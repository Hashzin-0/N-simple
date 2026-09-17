/**
 * Libras Capture Debug Utilities
 * FPS tracking, landmark stability, diagnostic for Phase 0 validation
 */

import type { HandLandmarks, HandLabel, CaptureDiagnostic } from './libras-types';

// ─── FPS Tracker ───

export class FPSTracker {
  private frameTimes: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize: number = 30) {
    this.windowSize = windowSize;
  }

  tick(): void {
    const now = performance.now();
    this.frameTimes.push(now);
    if (this.frameTimes.length > this.windowSize) {
      this.frameTimes.shift();
    }
  }

  getFPS(): number {
    if (this.frameTimes.length < 2) return 0;
    const elapsed = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
    if (elapsed === 0) return 0;
    return ((this.frameTimes.length - 1) / elapsed) * 1000;
  }

  reset(): void {
    this.frameTimes = [];
  }
}

// ─── Landmark Stability ───

function euclideanDistance(a: HandLandmarks, b: HandLandmarks): number {
  return Math.sqrt(
    (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
  );
}

/**
 * Calculate stability as a percentage.
 * Compares consecutive frames and measures how consistent the landmarks are.
 * 100% = perfectly stable, 0% = wildly jumping.
 */
export function calculateStability(
  frameHistory: { left: HandLandmarks[] | null; right: HandLandmarks[] | null }[],
  windowSize: number = 10
): number {
  if (frameHistory.length < 2) return 100;

  const recent = frameHistory.slice(-windowSize);
  let totalDistance = 0;
  let comparisons = 0;

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];

    // Compare left hand landmarks
    if (prev.left && curr.left && prev.left.length === 21 && curr.left.length === 21) {
      for (let j = 0; j < 21; j++) {
        totalDistance += euclideanDistance(prev.left[j], curr.left[j]);
        comparisons++;
      }
    }

    // Compare right hand landmarks
    if (prev.right && curr.right && prev.right.length === 21 && curr.right.length === 21) {
      for (let j = 0; j < 21; j++) {
        totalDistance += euclideanDistance(prev.right[j], curr.right[j]);
        comparisons++;
      }
    }
  }

  if (comparisons === 0) return 100;

  const avgDistance = totalDistance / comparisons;
  // Stability drops as average frame-to-frame distance increases
  // 0.001 = very stable, 0.01+ = very unstable
  const stability = Math.max(0, Math.min(100, 100 - (avgDistance * 10000)));
  return Math.round(stability);
}

// ─── Handedness Detection ───

export function determineHandedness(
  multiHandedness: { label: string; score: number }[] | undefined,
  multiHandLandmarks: HandLandmarks[][] | undefined
): { left: HandLandmarks[] | null; right: HandLandmarks[] | null; handedness: HandLabel; handCount: number } {
  let left: HandLandmarks[] | null = null;
  let right: HandLandmarks[] | null = null;
  let handedness: HandLabel = 'unknown';
  let handCount = 0;

  if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
    return { left: null, right: null, handedness: 'unknown', handCount: 0 };
  }

  handCount = multiHandLandmarks.length;

  if (handCount === 1) {
    const label = multiHandedness?.[0]?.label?.toLowerCase() || 'right';
    if (label === 'left') {
      left = multiHandLandmarks[0];
      handedness = 'left';
    } else {
      right = multiHandLandmarks[0];
      handedness = 'right';
    }
  } else if (handCount >= 2) {
    // MediaPipe reports handedness relative to the camera view
    // Since video is mirrored, labels are inverted
    for (let i = 0; i < Math.min(2, handCount); i++) {
      const label = multiHandedness?.[i]?.label?.toLowerCase() || 'right';
      if (label === 'left' && !left) {
        left = multiHandLandmarks[i];
      } else if (label === 'right' && !right) {
        right = multiHandLandmarks[i];
      }
    }
    // Fallback: if both ended up same side, assign by index
    if (!left && right) left = multiHandLandmarks[0];
    if (!right && left) right = multiHandLandmarks[1];
    handedness = 'both';
  }

  return { left, right, handedness, handCount };
}

// ─── Diagnostic Builder ───

export function buildDiagnostic(params: {
  frameCount: number;
  startTime: number;
  fps: number;
  handCount: number;
  handedness: HandLabel;
  landmarksPerHand: number;
  stability: number;
}): CaptureDiagnostic {
  return {
    frameCount: params.frameCount,
    durationMs: Math.round(performance.now() - params.startTime),
    fps: Math.round(params.fps),
    handsDetected: params.handCount,
    handedness: params.handedness,
    landmarksPerHand: params.landmarksPerHand,
    stabilityPercent: params.stability,
    timestamp: new Date().toISOString(),
  };
}

// ─── Canvas Drawing ───

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // index
  [0, 9], [9, 10], [10, 11], [11, 12],  // middle
  [0, 13], [13, 14], [14, 15], [15, 16],// ring
  [0, 17], [17, 18], [18, 19], [19, 20],// pinky
  [5, 9], [9, 13], [13, 17],            // palm
];

export function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmarks[],
  width: number,
  height: number,
  color: string = '#86efac',
  mirror: boolean = true
): void {
  if (!landmarks || landmarks.length !== 21) return;

  const toX = (x: number) => mirror ? (1 - x) * width : x * width;
  const toY = (y: number) => y * height;

  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  for (const [i, j] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(toX(landmarks[i].x), toY(landmarks[i].y));
    ctx.lineTo(toX(landmarks[j].x), toY(landmarks[j].y));
    ctx.stroke();
  }

  // Draw landmarks
  ctx.globalAlpha = 1;
  for (let i = 0; i < 21; i++) {
    const x = toX(landmarks[i].x);
    const y = toY(landmarks[i].y);
    const radius = i === 0 ? 5 : 3;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = i === 0 ? '#fbbf24' : color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function drawDiagnosticOverlay(
  ctx: CanvasRenderingContext2D,
  diagnostic: Partial<CaptureDiagnostic>,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, height - 80, width, 80);

  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';

  const lines = [
    `Mãos: ${diagnostic.handsDetected ?? 0}  |  Lado: ${diagnostic.handedness ?? '?'}  |  FPS: ${diagnostic.fps ?? 0}`,
    `Frames: ${diagnostic.frameCount ?? 0}  |  Estabilidade: ${diagnostic.stabilityPercent ?? 0}%`,
    `Landmarks: ${diagnostic.landmarksPerHand ?? 0}/21  |  Duração: ${((diagnostic.durationMs ?? 0) / 1000).toFixed(1)}s`,
  ];

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 12, height - 55 + i * 20);
  }

  ctx.restore();
}
