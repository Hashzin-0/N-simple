/**
 * Libras Landmark Processing
 * Processes MediaPipe hand landmarks for sign language recognition
 */

export interface HandLandmarks {
  x: number;
  y: number;
  z: number;
}

export interface ProcessedLandmarks {
  positions: number[];
  distances: number[];
  angles: number[];
  fingerStates: boolean[];
}

// MediaPipe hand landmark indices
const WRIST = 0;
const THUMB_CMC = 1;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_FINGER_MCP = 5;
const INDEX_FINGER_PIP = 6;
const INDEX_FINGER_DIP = 7;
const INDEX_FINGER_TIP = 8;
const MIDDLE_FINGER_MCP = 9;
const MIDDLE_FINGER_PIP = 10;
const MIDDLE_FINGER_DIP = 11;
const MIDDLE_FINGER_TIP = 12;
const RING_FINGER_MCP = 13;
const RING_FINGER_PIP = 14;
const RING_FINGER_DIP = 15;
const RING_FINGER_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_DIP = 19;
const PINKY_TIP = 20;

function euclideanDistance(a: HandLandmarks, b: HandLandmarks): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

function calculateAngle(a: HandLandmarks, b: HandLandmarks, c: HandLandmarks): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = (radians * 180) / Math.PI;
  if (degrees < 0) degrees += 360;
  return degrees;
}

function isFingerExtended(landmarks: HandLandmarks[], fingerTip: number, fingerPip: number): boolean {
  return landmarks[fingerTip].y < landmarks[fingerPip].y;
}

function isThumbExtended(landmarks: HandLandmarks[]): boolean {
  // Thumb is extended if tip is far from palm center
  const palmCenter = {
    x: (landmarks[WRIST].x + landmarks[MIDDLE_FINGER_MCP].x) / 2,
    y: (landmarks[WRIST].y + landmarks[MIDDLE_FINGER_MCP].y) / 2,
    z: (landmarks[WRIST].z + landmarks[MIDDLE_FINGER_MCP].z) / 2,
  };
  return euclideanDistance(landmarks[THUMB_TIP], palmCenter) > 0.15;
}

export function processLandmarks(landmarks: HandLandmarks[]): ProcessedLandmarks {
  // Normalize positions relative to wrist
  const wrist = landmarks[WRIST];
  const positions = landmarks.flatMap(l => [
    l.x - wrist.x,
    l.y - wrist.y,
    l.z - wrist.z,
  ]);

  // Calculate distances between key points
  const distances = [
    euclideanDistance(landmarks[THUMB_TIP], landmarks[INDEX_FINGER_TIP]),
    euclideanDistance(landmarks[INDEX_FINGER_TIP], landmarks[MIDDLE_FINGER_TIP]),
    euclideanDistance(landmarks[MIDDLE_FINGER_TIP], landmarks[RING_FINGER_TIP]),
    euclideanDistance(landmarks[RING_FINGER_TIP], landmarks[PINKY_TIP]),
    euclideanDistance(landmarks[WRIST], landmarks[MIDDLE_FINGER_MCP]),
    euclideanDistance(landmarks[THUMB_MCP], landmarks[INDEX_FINGER_MCP]),
  ];

  // Calculate angles between fingers
  const angles = [
    calculateAngle(landmarks[THUMB_MCP], landmarks[THUMB_IP], landmarks[THUMB_TIP]),
    calculateAngle(landmarks[INDEX_FINGER_MCP], landmarks[INDEX_FINGER_PIP], landmarks[INDEX_FINGER_TIP]),
    calculateAngle(landmarks[MIDDLE_FINGER_MCP], landmarks[MIDDLE_FINGER_PIP], landmarks[MIDDLE_FINGER_TIP]),
    calculateAngle(landmarks[RING_FINGER_MCP], landmarks[RING_FINGER_PIP], landmarks[RING_FINGER_TIP]),
    calculateAngle(landmarks[PINKY_MCP], landmarks[PINKY_PIP], landmarks[PINKY_TIP]),
  ];

  // Detect finger states (extended or not)
  const fingerStates = [
    isThumbExtended(landmarks),
    isFingerExtended(landmarks, INDEX_FINGER_TIP, INDEX_FINGER_PIP),
    isFingerExtended(landmarks, MIDDLE_FINGER_TIP, MIDDLE_FINGER_PIP),
    isFingerExtended(landmarks, RING_FINGER_TIP, RING_FINGER_PIP),
    isFingerExtended(landmarks, PINKY_TIP, PINKY_PIP),
  ];

  return { positions, distances, angles, fingerStates };
}

export function flattenProcessedLandmarks(processed: ProcessedLandmarks): number[] {
  return [
    ...processed.positions,
    ...processed.distances,
    ...processed.angles,
    ...processed.fingerStates.map(f => f ? 1 : 0),
  ];
}

export function calculateSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let sumSquaredDiff = 0;
  for (let i = 0; i < a.length; i++) {
    sumSquaredDiff += Math.pow(a[i] - b[i], 2);
  }

  const mse = sumSquaredDiff / a.length;
  return Math.max(0, 1 - Math.sqrt(mse));
}

export function detectMotion(
  previousLandmarks: HandLandmarks[],
  currentLandmarks: HandLandmarks[]
): { direction: string; magnitude: number } {
  const wristPrev = previousLandmarks[WRIST];
  const wristCurr = currentLandmarks[WRIST];

  const dx = wristCurr.x - wristPrev.x;
  const dy = wristCurr.y - wristPrev.y;
  const magnitude = Math.sqrt(dx * dx + dy * dy);

  let direction = 'static';
  if (magnitude > 0.01) {
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }
  }

  return { direction, magnitude };
}
