/**
 * Libras Gesture Templates
 * CRUD operations for gesture reference data + persistence.
 */

import type { GestureTemplate, SignerRecord, GestureExample, LibrasCategory } from './libras-types';

const STORAGE_KEY = 'agronomic_libras_templates_v2';

// ─── Default Templates (seed data) ───

export const DEFAULT_TEMPLATES: GestureTemplate[] = [
  {
    id: 'milho',
    label: 'Milho',
    emoji: '🌽',
    category: 'agricultura',
    isDynamic: true,
    requiredHand: 'right',
    description: 'Mão em formato de espiga, puxar para baixo',
    signers: [],
  },
  {
    id: 'gado',
    label: 'Gado',
    emoji: '🐄',
    category: 'pecuaria',
    isDynamic: false,
    requiredHand: 'both',
    description: 'Mãos como chifres na cabeça',
    signers: [],
  },
  {
    id: 'trator',
    label: 'Trator',
    emoji: '🚜',
    category: 'maquinas',
    isDynamic: true,
    requiredHand: 'both',
    description: 'Movimento de girar volante',
    signers: [],
  },
  {
    id: 'plantar',
    label: 'Plantar',
    emoji: '🌱',
    category: 'agricultura',
    isDynamic: true,
    requiredHand: 'right',
    description: 'Mão como semente caindo no solo',
    signers: [],
  },
  {
    id: 'agua',
    label: 'Água',
    emoji: '💧',
    category: 'meio_ambiente',
    isDynamic: false,
    requiredHand: 'right',
    description: 'Mão ondulando como água',
    signers: [],
  },
  {
    id: 'gado_pasto',
    label: 'Pasto',
    emoji: '🌿',
    category: 'pecuaria',
    isDynamic: false,
    requiredHand: 'both',
    description: 'Mãos abertas como gramado',
    signers: [],
  },
  {
    id: 'colheita',
    label: 'Colheita',
    emoji: '🌾',
    category: 'agricultura',
    isDynamic: true,
    requiredHand: 'right',
    description: 'Movimento de segurar e cortar',
    signers: [],
  },
  {
    id: 'vaca',
    label: 'Vaca',
    emoji: '🐄',
    category: 'pecuaria',
    isDynamic: false,
    requiredHand: 'both',
    description: 'Chifres com dedos estendidos',
    signers: [],
  },
];

// ─── CRUD Operations ───

let cachedTemplates: GestureTemplate[] | null = null;

export function loadTemplates(): GestureTemplate[] {
  if (cachedTemplates) return cachedTemplates;

  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedTemplates = DEFAULT_TEMPLATES;
      return cachedTemplates;
    }
    cachedTemplates = JSON.parse(raw);
    return cachedTemplates!;
  } catch {
    cachedTemplates = DEFAULT_TEMPLATES;
    return cachedTemplates;
  }
}

export function saveTemplates(templates: GestureTemplate[]): void {
  cachedTemplates = templates;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save templates:', e);
  }
}

export function getTemplate(id: string): GestureTemplate | undefined {
  return loadTemplates().find((t) => t.id === id);
}

export function addTemplate(template: GestureTemplate): void {
  const templates = loadTemplates();
  const existing = templates.findIndex((t) => t.id === template.id);
  if (existing >= 0) {
    templates[existing] = template;
  } else {
    templates.push(template);
  }
  saveTemplates(templates);
}

export function removeTemplate(id: string): void {
  const templates = loadTemplates().filter((t) => t.id !== id);
  saveTemplates(templates);
}

// ─── Example Management ───

export function addExampleToTemplate(
  templateId: string,
  signerId: string,
  signerLabel: string,
  example: GestureExample
): void {
  const templates = loadTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;

  let signer = template.signers.find((s) => s.signerId === signerId);
  if (!signer) {
    signer = { signerId, signerLabel, examples: [] };
    template.signers.push(signer);
  }

  signer.examples.push(example);
  saveTemplates(templates);
}

export function removeExampleFromTemplate(
  templateId: string,
  signerId: string,
  exampleIndex: number
): void {
  const templates = loadTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;

  const signer = template.signers.find((s) => s.signerId === signerId);
  if (!signer) return;

  signer.examples.splice(exampleIndex, 1);

  // Remove signer if no examples left
  if (signer.examples.length === 0) {
    template.signers = template.signers.filter((s) => s.signerId !== signerId);
  }

  saveTemplates(templates);
}

// ─── Helpers ───

export function getTemplateExamples(templateId: string): number[][][] {
  const template = getTemplate(templateId);
  if (!template) return [];
  return template.signers.flatMap((s) => s.examples.map((e) => e.features));
}

export function getTemplatesByCategory(category: LibrasCategory): GestureTemplate[] {
  return loadTemplates().filter((t) => t.category === category);
}

export function getTemplateCount(): number {
  return loadTemplates().length;
}

export function getTotalExamples(): number {
  return loadTemplates().reduce(
    (sum, t) => sum + t.signers.reduce((s, signer) => s + signer.examples.length, 0),
    0
  );
}

export function clearAllTemplates(): void {
  saveTemplates([]);
}
