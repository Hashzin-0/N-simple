import type { TutorProgressEntry } from '@/lib/tutor/types';

export type TutorProgressMap = Record<string, TutorProgressEntry>;
export type LibrasProgressMap = Record<string, { learned: boolean; quizScore: number }>;

export interface LibrasCloudEntry {
  word_id: string;
  learned?: boolean;
  quiz_score?: number;
  module_id?: string;
}

function unionLists(a: string[] = [], b: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [...a, ...b]) {
    const clean = (item || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, 6);
}

function laterIso(a?: string, b?: string): string {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  if (tb > ta) return b || a || '';
  return a || b || '';
}

/**
 * Mescla um tópico do Tutor: mantém o lado mais avançado
 * (max attempts OU max mastery) e une strengths/weaknesses.
 */
export function mergeTutorEntry(
  local?: TutorProgressEntry | null,
  cloud?: TutorProgressEntry | null,
): TutorProgressEntry | null {
  if (!local && !cloud) return null;
  if (!local) return { ...cloud! };
  if (!cloud) return { ...local };

  const localAttempts = local.attempts || 0;
  const cloudAttempts = cloud.attempts || 0;
  const localMastery = typeof local.masteryEstimate === 'number' ? local.masteryEstimate : 0;
  const cloudMastery = typeof cloud.masteryEstimate === 'number' ? cloud.masteryEstimate : 0;

  // Mais avançado: mais tentativas OU domínio maior (não só um eixo).
  const cloudAhead =
    cloudAttempts > localAttempts ||
    (cloudAttempts === localAttempts && cloudMastery > localMastery) ||
    (cloudMastery > localMastery && cloudAttempts >= localAttempts);

  const base = cloudAhead ? cloud : local;
  const other = cloudAhead ? local : cloud;

  return {
    topic: base.topic || other.topic,
    attempts: Math.max(localAttempts, cloudAttempts),
    masteryEstimate:
      Math.round(Math.max(localMastery, cloudMastery) * 1000) / 1000,
    strengths: unionLists(local.strengths, cloud.strengths),
    weaknesses: unionLists(local.weaknesses, cloud.weaknesses),
    lastReview: laterIso(local.lastReview, cloud.lastReview),
  };
}

export function mergeTutorMaps(
  localMap: TutorProgressMap,
  cloudEntries: TutorProgressEntry[],
): TutorProgressMap {
  const merged: TutorProgressMap = { ...localMap };
  for (const entry of cloudEntries) {
    if (!entry?.topic) continue;
    merged[entry.topic] = mergeTutorEntry(merged[entry.topic], entry)!;
  }
  return merged;
}

/** Mescla palavra do Libras: learned = OR, quiz_score = max. */
export function mergeLibrasEntry(
  local?: { learned: boolean; quizScore: number } | null,
  cloud?: { learned?: boolean; quiz_score?: number } | null,
): { learned: boolean; quizScore: number } {
  const localLearned = Boolean(local?.learned);
  const cloudLearned = Boolean(cloud?.learned);
  const localScore = Number(local?.quizScore) || 0;
  const cloudScore = Number(cloud?.quiz_score) || 0;
  if (!local && !cloud) return { learned: false, quizScore: 0 };
  return {
    learned: localLearned || cloudLearned,
    quizScore: Math.max(localScore, cloudScore),
  };
}

export function mergeLibrasMap(
  localMap: LibrasProgressMap,
  cloudEntries: LibrasCloudEntry[],
): LibrasProgressMap {
  const merged: LibrasProgressMap = { ...localMap };
  for (const entry of cloudEntries) {
    if (!entry?.word_id) continue;
    merged[entry.word_id] = mergeLibrasEntry(merged[entry.word_id], entry);
  }
  return merged;
}
