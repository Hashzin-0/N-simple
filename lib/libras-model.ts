/**
 * Libras Sign Classification Model
 * Template-based classifier for Brazilian Sign Language
 */

import {
  type HandLandmarks,
  processLandmarks,
  flattenProcessedLandmarks,
  calculateSimilarity,
  detectMotion,
} from './libras-landmarks';

export interface SignTemplate {
  label: string;
  description: string;
  landmarks: number[][];
  isDynamic: boolean;
  motionDirection?: string;
  category: 'alphabet' | 'number' | 'phrase' | 'command' | 'custom';
}

export interface RecognitionResult {
  label: string;
  confidence: number;
  description: string;
  category: string;
}

// Pre-defined Libras alphabet templates (simplified representations)
const LIBRAS_ALPHABET: SignTemplate[] = [
  {
    label: 'A',
    description: 'Mão fechada, polegar para cima',
    landmarks: generateFingerPose([false, false, false, false], true),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'B',
    description: 'Mão aberta, dedos juntos',
    landmarks: generateFingerPose([true, true, true, true], false),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'C',
    description: 'Mão em forma de C',
    landmarks: generateCurvedPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'D',
    description: 'Dedo indicador para cima',
    landmarks: generateFingerPose([true, false, false, false], false),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'E',
    description: 'Mão fechada, dedos enrolados',
    landmarks: generateClosedPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'F',
    description: ' polegar e indicador juntos',
    landmarks: generatePinchPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'G',
    description: 'Indicador e médio apontando',
    landmarks: generateFingerPose([true, true, false, false], false),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'H',
    description: 'Mão horizontal, dedos apontando',
    landmarks: generateHorizontalPose(),
    isDynamic: true,
    motionDirection: 'right',
    category: 'alphabet',
  },
  {
    label: 'I',
    description: 'Mindinho para cima',
    landmarks: generateFingerPose([false, false, false, true], false),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'J',
    description: 'Mindinho fazendo movimento',
    landmarks: generateFingerPose([false, false, false, true], false),
    isDynamic: true,
    motionDirection: 'down',
    category: 'alphabet',
  },
  {
    label: 'K',
    description: 'Indicador e médio em V',
    landmarks: generateVPose(),
    isDynamic: true,
    motionDirection: 'up',
    category: 'alphabet',
  },
  {
    label: 'L',
    description: 'Indicador e polegar em L',
    landmarks: generateLPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'M',
    description: 'Três dedos sobre polegar',
    landmarks: generateThreeFingersPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'N',
    description: 'Dois dedos sobre polegar',
    landmarks: generateTwoFingersPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'O',
    description: 'Mão em forma de O',
    landmarks: generateOPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'P',
    description: 'Indicador apontando para baixo',
    landmarks: generatePointDownPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'Q',
    description: 'Indicador apontando para baixo e para trás',
    landmarks: generatePointDownBackPose(),
    isDynamic: true,
    motionDirection: 'down',
    category: 'alphabet',
  },
  {
    label: 'R',
    description: 'Indicador e médio cruzados',
    landmarks: generateCrossedFingersPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'S',
    description: 'Mão fechada, polegar sobre dedos',
    landmarks: generateClosedOverPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'T',
    description: 'Polegar entre indicador e médio',
    landmarks: generateThumbBetweenPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'U',
    description: 'Indicador e médio juntos para cima',
    landmarks: generateFingerPose([true, true, false, false], false),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'V',
    description: 'Indicador e médio em V',
    landmarks: generateVPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'W',
    description: 'Três dedos abertos',
    landmarks: generateFingerPose([true, true, true, false], false),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'X',
    description: 'Indicador fazendo gancho',
    landmarks: generateHookPose(),
    isDynamic: true,
    motionDirection: 'right',
    category: 'alphabet',
  },
  {
    label: 'Y',
    description: 'Polegar e mindinho estendidos',
    landmarks: generateYPose(),
    isDynamic: false,
    category: 'alphabet',
  },
  {
    label: 'Z',
    description: 'Indicador desenhando Z',
    landmarks: generateFingerPose([true, false, false, false], false),
    isDynamic: true,
    motionDirection: 'right',
    category: 'alphabet',
  },
];

// Common Libras phrases for the calculator
const COMMON_PHRASES: SignTemplate[] = [
  {
    label: 'OLA',
    description: 'Olá / Saudação',
    landmarks: generateWavePose(),
    isDynamic: true,
    motionDirection: 'right',
    category: 'phrase',
  },
  {
    label: 'OBRIGADO',
    description: 'Obrigado / Agradecimento',
    landmarks: generateThankYouPose(),
    isDynamic: false,
    category: 'phrase',
  },
  {
    label: 'POR_FAVOR',
    description: 'Por favor',
    landmarks: generatePleasePose(),
    isDynamic: false,
    category: 'phrase',
  },
  {
    label: 'AJUDA',
    description: 'Preciso de ajuda',
    landmarks: generateHelpPose(),
    isDynamic: true,
    motionDirection: 'up',
    category: 'phrase',
  },
  {
    label: 'CALCULAR',
    description: 'Quero calcular',
    landmarks: calculatePose(),
    isDynamic: true,
    motionDirection: 'right',
    category: 'command',
  },
  {
    label: 'SALVAR',
    description: 'Quero salvar',
    landmarks: generateSavePose(),
    isDynamic: false,
    category: 'command',
  },
  {
    label: 'LIMPAR',
    description: 'Limpar / Recomeçar',
    landmarks: generateClearPose(),
    isDynamic: true,
    motionDirection: 'left',
    category: 'command',
  },
  {
    label: 'SIM',
    description: 'Sim / Confirmar',
    landmarks: generateYesPose(),
    isDynamic: true,
    motionDirection: 'down',
    category: 'phrase',
  },
  {
    label: 'NAO',
    description: 'Não / Recusar',
    landmarks: generateNoPose(),
    isDynamic: true,
    motionDirection: 'right',
    category: 'phrase',
  },
  {
    label: 'MILHO',
    description: 'Milho',
    landmarks: generateCornPose(),
    isDynamic: false,
    category: 'phrase',
  },
  {
    label: 'Nitrogenio',
    description: 'Nitrogênio / Adubo',
    landmarks: generateNitrogenPose(),
    isDynamic: false,
    category: 'phrase',
  },
  {
    label: 'PRODUTIVIDADE',
    description: 'Produtividade',
    landmarks: generateProductivityPose(),
    isDynamic: true,
    motionDirection: 'up',
    category: 'phrase',
  },
];

// Helper functions to generate simplified landmark poses
function generateFingerPose(fingers: boolean[], thumbUp: boolean): number[][] {
  const base = Array(21).fill(null).map(() => [0, 0, 0]);
  // Simplified pose generation
  return base;
}

function generateCurvedPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateClosedPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generatePinchPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateHorizontalPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateVPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateLPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateThreeFingersPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateTwoFingersPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateOPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generatePointDownPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generatePointDownBackPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateCrossedFingersPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateClosedOverPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateThumbBetweenPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateHookPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateYPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateWavePose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateThankYouPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generatePleasePose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateHelpPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function calculatePose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateSavePose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateClearPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateYesPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateNoPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateCornPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateNitrogenPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

function generateProductivityPose(): number[][] {
  return Array(21).fill(null).map(() => [0, 0, 0]);
}

export class LibrasClassifier {
  private templates: SignTemplate[];
  private customSigns: Record<string, number[][]>;
  private sensitivity: number;
  private landmarkHistory: HandLandmarks[][];
  private motionHistory: { direction: string; magnitude: number }[];

  constructor(sensitivity: number = 0.7) {
    this.templates = [...LIBRAS_ALPHABET, ...COMMON_PHRASES];
    this.customSigns = {};
    this.sensitivity = sensitivity;
    this.landmarkHistory = [];
    this.motionHistory = [];
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0.1, Math.min(1.0, sensitivity));
  }

  setCustomSigns(customSigns: Record<string, number[][]>): void {
    this.customSigns = customSigns;
  }

  addCustomSign(label: string, landmarks: number[][]): void {
    this.customSigns[label] = landmarks;
  }

  removeCustomSign(label: string): void {
    delete this.customSigns[label];
  }

  classify(landmarks: HandLandmarks[]): RecognitionResult | null {
    if (!landmarks || landmarks.length === 0) return null;

    // Store landmark history for motion detection
    this.landmarkHistory.push(landmarks);
    if (this.landmarkHistory.length > 10) {
      this.landmarkHistory.shift();
    }

    // Process current landmarks
    const processed = processLandmarks(landmarks);
    const flatLandmarks = flattenProcessedLandmarks(processed);

    // Detect motion if we have history
    let motion = { direction: 'static', magnitude: 0 };
    if (this.landmarkHistory.length > 1) {
      const prevLandmarks = this.landmarkHistory[this.landmarkHistory.length - 2];
      motion = detectMotion(prevLandmarks, landmarks);
      this.motionHistory.push(motion);
      if (this.motionHistory.length > 5) {
        this.motionHistory.shift();
      }
    }

    let bestMatch: RecognitionResult | null = null;
    let bestScore = 0;

    // Check built-in templates
    for (const template of this.templates) {
      const score = this.matchTemplate(template, flatLandmarks, motion);
      if (score > bestScore && score >= this.sensitivity) {
        bestScore = score;
        bestMatch = {
          label: template.label,
          confidence: score,
          description: template.description,
          category: template.category,
        };
      }
    }

    // Check custom signs
    for (const [label, customLandmarks] of Object.entries(this.customSigns)) {
      for (const customLandmark of customLandmarks) {
        const similarity = calculateSimilarity(flatLandmarks, customLandmark);
        if (similarity > bestScore && similarity >= this.sensitivity) {
          bestScore = similarity;
          bestMatch = {
            label,
            confidence: similarity,
            description: `Sinal personalizado: ${label}`,
            category: 'custom',
          };
        }
      }
    }

    return bestMatch;
  }

  private matchTemplate(
    template: SignTemplate,
    landmarks: number[],
    motion: { direction: string; magnitude: number }
  ): number {
    // For dynamic signs, check motion direction
    if (template.isDynamic) {
      if (template.motionDirection && motion.direction !== template.motionDirection) {
        return 0;
      }
      if (motion.magnitude < 0.01) {
        return 0;
      }
    }

    // Calculate similarity with template landmarks
    let maxSimilarity = 0;
    for (const templateLandmark of template.landmarks) {
      const flatTemplate = flattenProcessedLandmarks(processLandmarks(templateLandmark as unknown as HandLandmarks[]));
      const similarity = calculateSimilarity(landmarks, flatTemplate);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  clearHistory(): void {
    this.landmarkHistory = [];
    this.motionHistory = [];
  }
}

// Singleton instance
let classifierInstance: LibrasClassifier | null = null;

export function getClassifier(sensitivity?: number): LibrasClassifier {
  if (!classifierInstance) {
    classifierInstance = new LibrasClassifier(sensitivity);
  } else if (sensitivity !== undefined) {
    classifierInstance.setSensitivity(sensitivity);
  }
  return classifierInstance;
}

export function resetClassifier(): void {
  classifierInstance = null;
}
