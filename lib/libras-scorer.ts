/**
 * Libras Gesture Scorer
 * Separates recognition ("what is this?") from evaluation ("how well was it done?").
 */

import type {
  GestureTemplate,
  RecognitionResult,
  EvaluationResult,
} from './libras-types';
import { dtwDistance, compareWithTemplate } from './libras-dtw';

// ─── Confidence Thresholds (experimental, to be calibrated) ───

const THRESHOLDS = {
  high: 0.15,
  medium: 0.30,
  low: 0.50,
};

// ─── Recognition ───

/**
 * Recognize which sign the student is performing.
 * Compares against all templates and all examples per template.
 */
export function recognize(
  studentSequence: number[][],
  allTemplates: GestureTemplate[]
): RecognitionResult {
  if (allTemplates.length === 0 || studentSequence.length === 0) {
    return {
      candidateLabel: '',
      candidateId: '',
      confidence: 'none',
      distance: Infinity,
      allCandidates: [],
    };
  }

  // Compare against all templates
  const candidates = allTemplates.map((template) => {
    const examples = template.signers.flatMap((s) => s.examples.map((e) => e.features));
    const { bestDistance } = compareWithTemplate(studentSequence, examples);
    return { label: template.label, id: template.id, distance: bestDistance };
  });

  // Sort by distance
  candidates.sort((a, b) => a.distance - b.distance);

  const best = candidates[0];

  let confidence: RecognitionResult['confidence'] = 'none';
  if (best.distance < THRESHOLDS.high) confidence = 'high';
  else if (best.distance < THRESHOLDS.medium) confidence = 'medium';
  else if (best.distance < THRESHOLDS.low) confidence = 'low';

  return {
    candidateLabel: best.label,
    candidateId: best.id,
    confidence,
    distance: best.distance,
    allCandidates: candidates.slice(0, 3).map((c) => ({ label: c.label, distance: c.distance })),
  };
}

// ─── Evaluation ───

/**
 * Evaluate how well the student performed a specific sign.
 * Requires a recognized template and the best matching example index.
 */
export function evaluate(
  studentSequence: number[][],
  template: GestureTemplate,
  bestExampleIndex: number
): EvaluationResult {
  const allExamples = template.signers.flatMap((s) => s.examples.map((e) => e.features));
  const bestExample = allExamples[bestExampleIndex] || allExamples[0];

  if (!bestExample || studentSequence.length === 0) {
    return defaultEvaluation();
  }

  // 1. Hand shape: DTW of last frames (static comparison)
  const lastStudentFrame = studentSequence[studentSequence.length - 1];
  const lastTemplateFrame = bestExample[bestExample.length - 1];
  const staticDTW = dtwDistance([lastStudentFrame], [lastTemplateFrame]);
  const handShape = Math.max(0, 100 - staticDTW.normalizedDistance * 200);

  // 2. Motion: full sequence DTW (already computed in recognition)
  const fullDTW = dtwDistance(studentSequence, bestExample);
  const motion = Math.max(0, 100 - fullDTW.normalizedDistance * 150);

  // 3. Orientation: compare palm orientation features (last 3 features per hand in flatten)
  const orientation = computeOrientationScore(studentSequence, bestExample);

  // 4. Relative position: compare tip distances
  const relativePosition = computeRelativePositionScore(studentSequence, bestExample);

  // 5. Timing: is the speed within acceptable range?
  const timingRatio = studentSequence.length / bestExample.length;
  const timingQuality = timingRatio >= 0.5 && timingRatio <= 2.0
    ? Math.max(0, 100 - Math.abs(1 - timingRatio) * 50)
    : 30;

  return {
    handShape: Math.round(Math.min(100, Math.max(0, handShape))),
    motion: Math.round(Math.min(100, Math.max(0, motion))),
    orientation: Math.round(Math.min(100, Math.max(0, orientation))),
    relativePosition: Math.round(Math.min(100, Math.max(0, relativePosition))),
    handednessMatch: true, // TODO: compare with template.requiredHand
    timingQuality: Math.round(Math.min(100, Math.max(0, timingQuality))),
  };
}

// ─── Helpers ───

function computeOrientationScore(student: number[][], template: number[][]): number {
  if (student.length === 0 || template.length === 0) return 50;

  // Compare the last few features (palm orientation) of the last frames
  const studentLast = student[student.length - 1];
  const templateLast = template[template.length - 1];

  // Palm orientation is at indices -6 to -3 (3 per hand, 2 hands)
  // Use last 6 features before handCount/isLeft/isRight
  const orientStart = Math.max(0, studentLast.length - 9);
  const orientEnd = studentLast.length - 3;

  let diff = 0;
  let count = 0;
  for (let i = orientStart; i < orientEnd && i < studentLast.length; i++) {
    diff += Math.abs(studentLast[i] - templateLast[i]);
    count++;
  }

  if (count === 0) return 50;
  const avgDiff = diff / count;
  return Math.max(0, 100 - avgDiff * 2);
}

function computeRelativePositionScore(student: number[][], template: number[][]): number {
  if (student.length === 0 || template.length === 0) return 50;

  const studentLast = student[student.length - 1];
  const templateLast = template[template.length - 1];

  // Tip distances are at indices 40-47 (8 features: 4 per hand)
  const tipStart = 40;
  const tipEnd = 48;

  let diff = 0;
  let count = 0;
  for (let i = tipStart; i < tipEnd && i < Math.min(studentLast.length, templateLast.length); i++) {
    diff += Math.abs(studentLast[i] - templateLast[i]);
    count++;
  }

  if (count === 0) return 50;
  const avgDiff = diff / count;
  return Math.max(0, 100 - avgDiff * 100);
}

function defaultEvaluation(): EvaluationResult {
  return {
    handShape: 0,
    motion: 0,
    orientation: 0,
    relativePosition: 0,
    handednessMatch: false,
    timingQuality: 0,
  };
}

/**
 * Get human-readable feedback message for an evaluation.
 */
export function getFeedbackMessage(
  recognition: RecognitionResult,
  evaluation: EvaluationResult,
  attempt: number
): string {
  if (recognition.confidence === 'none') {
    return 'Não foi possível identificar o sinal. Tente novamente com a mão mais visível à câmera.';
  }

  if (recognition.confidence === 'low') {
    return `Sua execução apresenta semelhança parcial com ${recognition.candidateLabel}. Tente novamente.`;
  }

  const parts: string[] = [];

  if (evaluation.handShape >= 75) {
    parts.push('formato das mãos ficou bom');
  } else if (evaluation.handShape >= 50) {
    parts.push('formato das mãos pode melhorar');
  }

  if (evaluation.motion >= 75) {
    parts.push('movimento está correto');
  } else if (evaluation.motion >= 50) {
    parts.push('o movimento pode ser mais preciso');
  } else {
    parts.push('atenção ao movimento');
  }

  if (evaluation.orientation >= 75) {
    parts.push('orientação boa');
  }

  const prefix = recognition.confidence === 'high'
    ? `Muito bem! Eu reconheci o sinal de ${recognition.candidateLabel}.`
    : `Possível correspondência: ${recognition.candidateLabel}.`;

  if (parts.length === 0) {
    return `${prefix} Continue praticando!`;
  }

  return `${prefix} ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}${parts.length > 1 ? '. ' + parts.slice(1).join('. ') : '.'} ${attempt > 1 ? 'Vamos tentar mais uma vez.' : ''}`;
}
