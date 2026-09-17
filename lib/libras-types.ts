export interface LibrasVideoResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

export interface LibrasSearchResponse {
  results: LibrasVideoResult[];
  totalFound: number;
  query: string;
}

export type LibrasCategory =
  | 'agricultura'
  | 'pecuaria'
  | 'maquinas'
  | 'gestao'
  | 'meio_ambiente';

export interface LibrasWord {
  id: string;
  word: string;
  emoji: string;
  category: LibrasCategory;
  searchQueries: string[];
}

export interface LibrasPhrase {
  id: string;
  phrase: string;
  breakdown: string[];
  category: string;
}

export interface LibrasModule {
  id: string;
  title: string;
  emoji: string;
  description: string;
  type: 'vocabulary' | 'phrases' | 'area';
  words: LibrasWord[];
  phrases?: LibrasPhrase[];
}

export interface LibrasArea {
  id: string;
  name: string;
  emoji: string;
  modules: LibrasModule[];
}

export interface LibrasProgressRecord {
  id: string;
  user_id: string;
  word_id: string;
  learned: boolean;
  quiz_score: number;
  module_id: string;
  created_at: string;
  updated_at: string;
}

export interface LibrasModuleProgress {
  moduleId: string;
  totalWords: number;
  learnedWords: number;
  quizScore: number;
  completed: boolean;
}

export interface LibrasQuizQuestion {
  wordId: string;
  word: string;
  options: LibrasVideoResult[];
  correctIndex: number;
}

export interface HandLandmarks {
  x: number;
  y: number;
  z: number;
}

// ─── Fase 0: Captura e Validação ───

export type HandLabel = 'left' | 'right' | 'both' | 'unknown';

export interface CaptureDiagnostic {
  frameCount: number;
  durationMs: number;
  fps: number;
  handsDetected: number;
  handedness: HandLabel;
  landmarksPerHand: number;
  stabilityPercent: number;
  timestamp: string;
}

export interface CaptureRecording {
  id: string;
  frames: CapturedFrame[];
  diagnostic: CaptureDiagnostic;
  recordedAt: string;
}

export interface CapturedFrame {
  timestamp: number;
  leftLandmarks: HandLandmarks[] | null;
  rightLandmarks: HandLandmarks[] | null;
  handedness: HandLabel;
  handCount: number;
}

// ─── Fase 1: Features ───

export interface FeatureVector {
  angles: number[];
  extensions: number[];
  tipDistances: number[];
  palmOrientation: number[];
  handedness: HandLabel;
  handCount: number;
}

// ─── Fase 2: Temporal Buffer ───

export type GestureState = 'idle' | 'waiting' | 'active' | 'done';

export interface TemporalBufferConfig {
  minFrames: number;
  maxFrames: number;
  motionThreshold: number;
  stabilityFrames: number;
}

// ─── Fase 3: DTW e Scoring ───

export interface DTWResult {
  distance: number;
  path: [number, number][];
  normalizedDistance: number;
}

export interface RecognitionResult {
  candidateLabel: string;
  candidateId: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  distance: number;
  allCandidates: { label: string; distance: number }[];
}

export interface EvaluationResult {
  handShape: number;
  motion: number;
  orientation: number;
  relativePosition: number;
  handednessMatch: boolean;
  timingQuality: number;
}

// ─── Fase 4: Templates ───

export interface GestureTemplate {
  id: string;
  label: string;
  emoji: string;
  category: LibrasCategory;
  isDynamic: boolean;
  requiredHand: 'left' | 'right' | 'both' | 'any';
  description: string;
  signers: SignerRecord[];
}

export interface SignerRecord {
  signerId: string;
  signerLabel: string;
  examples: GestureExample[];
}

export interface GestureExample {
  features: number[][];
  rawLandmarks: { left: HandLandmarks[] | null; right: HandLandmarks[] | null }[];
  metadata: {
    frameCount: number;
    durationMs: number;
    recordedAt: string;
    motionDetected: boolean;
  };
}
