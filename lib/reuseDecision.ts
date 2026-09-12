import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { extractTopics, normalizeTopic } from '@/lib/topicExtractor';

export interface ReuseDecision {
  action: 'reuse' | 'complementary' | 'new_search';
  coverageScore: number;
  reuseScore: number;
  explorationNeed: number;
  sourcesToReuse: ScientificSource[];
  topicsNeedingSearch: string[];
  allTopics: string[];
  diversityScore: number;
  stats: {
    totalSourcesFound: number;
    topicsWithEvidence: number;
    topicsWithoutEvidence: number;
    avgEvidenceStrength: number;
  };
}

interface ReuseOptions {
  minCoverage?: number;
  complementaryThreshold?: number;
  minDiversity?: number;
  maxAgeDays?: number;
}

const DEFAULT_OPTIONS: Required<ReuseOptions> = {
  minCoverage: 0.75,
  complementaryThreshold: 0.45,
  minDiversity: 2,
  maxAgeDays: 90,
};

function computeCoverageScore(
  topicStrengths: Map<string, number[]>,
  allTopics: string[]
): number {
  if (allTopics.length === 0) return 0;

  let totalScore = 0;
  for (const topic of allTopics) {
    const strengths = topicStrengths.get(topic) || [];
    if (strengths.length > 0) {
      const bestStrength = Math.max(...strengths);
      totalScore += bestStrength;
    }
  }

  return totalScore / allTopics.length;
}

function computeDiversityScore(topicSourceCount: Map<string, number>): number {
  if (topicSourceCount.size === 0) return 0;

  let totalDiversity = 0;
  for (const count of topicSourceCount.values()) {
    totalDiversity += Math.min(count, 5) / 5;
  }

  return totalDiversity / topicSourceCount.size;
}

function computeAgePenalty(lastVerified: string, maxAgeDays: number): number {
  const now = new Date();
  const verified = new Date(lastVerified);
  const daysSince = (now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= maxAgeDays) return 0;
  const excess = daysSince - maxAgeDays;
  return Math.min(0.2, excess / 365 * 0.2);
}

function buildSourceFromDb(row: {
  id: string;
  title: string;
  authors: string;
  year: number;
  publication: string;
  source_name: string;
  source_type: string;
  abstract: string;
  keywords: string[];
  direct_url: string;
  search_url: string;
  doi: string;
  abnt_citation: string;
  vantagens: string[];
  desvantagens: string[];
  caracteristicas: string[];
  last_verified: string;
  reuse_count: number;
  source_topics: Array<{
    topic: string;
    evidence_strength: number;
    has_evidence: boolean;
  }>;
}): ScientificSource {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors || '',
    year: row.year || new Date().getFullYear(),
    publication: row.publication || '',
    sourceName: (row.source_name as ScientificSource['sourceName']) || 'Google Acadêmico',
    sourceType: (row.source_type as ScientificSource['sourceType']) || 'artigo_periodico',
    abstract: row.abstract || '',
    keywords: row.keywords || [],
    directUrl: row.direct_url,
    searchUrl: row.search_url || '',
    doi: row.doi,
    abntCitation: row.abnt_citation || '',
    vantagens: row.vantagens || [],
    desvantagens: row.desvantagens || [],
    caracteristicas: row.caracteristicas || [],
    matchedTopics: row.source_topics
      ?.filter(t => t.has_evidence)
      .map(t => t.topic) || [],
  };
}

/**
 * Decision Layer principal.
 * Decide se deve reutilizar fontes existentes, complementar ou pesquisar novamente.
 */
export async function decideReuse(
  query: string,
  explicitTopics?: string[],
  options?: ReuseOptions
): Promise<ReuseDecision> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allTopics = explicitTopics?.length
    ? explicitTopics
    : extractTopics(query);

  if (!isSupabaseConfigured() || allTopics.length === 0) {
    return {
      action: 'new_search',
      coverageScore: 0,
      reuseScore: 0,
      explorationNeed: 1,
      sourcesToReuse: [],
      topicsNeedingSearch: allTopics,
      allTopics,
      diversityScore: 0,
      stats: {
        totalSourcesFound: 0,
        topicsWithEvidence: 0,
        topicsWithoutEvidence: allTopics.length,
        avgEvidenceStrength: 0,
      },
    };
  }

  const normalizedTopics = allTopics.map(normalizeTopic);

  const { data: topicRows, error: topicError } = await supabase!
    .from('source_topics')
    .select(`
      source_id,
      topic,
      topic_normalized,
      evidence_strength,
      has_evidence,
      sources!inner(
        id, title, authors, year, publication, source_name, source_type,
        abstract, keywords, direct_url, search_url, doi, abnt_citation,
        vantagens, desvantagens, caracteristicas, last_verified, reuse_count
      )
    `)
    .in('topic_normalized', normalizedTopics)
    .eq('has_evidence', true)
    .gte('evidence_strength', 0.3);

  if (topicError || !topicRows || topicRows.length === 0) {
    return {
      action: 'new_search',
      coverageScore: 0,
      reuseScore: 0,
      explorationNeed: 1,
      sourcesToReuse: [],
      topicsNeedingSearch: allTopics,
      allTopics,
      diversityScore: 0,
      stats: {
        totalSourcesFound: 0,
        topicsWithEvidence: 0,
        topicsWithoutEvidence: allTopics.length,
        avgEvidenceStrength: 0,
      },
    };
  }

  const sourceMap = new Map<string, {
    source: ScientificSource;
    topics: Array<{ topic: string; strength: number }>;
    maxStrength: number;
    lastVerified: string;
    reuseCount: number;
  }>();

  for (const row of topicRows) {
    const src = row.sources as unknown as {
      id: string;
      title: string;
      authors: string;
      year: number;
      publication: string;
      source_name: string;
      source_type: string;
      abstract: string;
      keywords: string[];
      direct_url: string;
      search_url: string;
      doi: string;
      abnt_citation: string;
      vantagens: string[];
      desvantagens: string[];
      caracteristicas: string[];
      last_verified: string;
      reuse_count: number;
    };

    const existing = sourceMap.get(src.id);
    if (existing) {
      existing.topics.push({ topic: row.topic, strength: row.evidence_strength });
      existing.maxStrength = Math.max(existing.maxStrength, row.evidence_strength);
    } else {
      const dbRow = {
        ...src,
        source_topics: [{ topic: row.topic, evidence_strength: row.evidence_strength, has_evidence: row.has_evidence }],
      };
      sourceMap.set(src.id, {
        source: buildSourceFromDb(dbRow),
        topics: [{ topic: row.topic, strength: row.evidence_strength }],
        maxStrength: row.evidence_strength,
        lastVerified: src.last_verified,
        reuseCount: src.reuse_count,
      });
    }
  }

  const topicStrengths = new Map<string, number[]>();
  const topicSourceCount = new Map<string, number>();

  for (const entry of sourceMap.values()) {
    for (const t of entry.topics) {
      const existing = topicStrengths.get(t.topic) || [];
      existing.push(t.strength);
      topicStrengths.set(t.topic, existing);

      topicSourceCount.set(t.topic, (topicSourceCount.get(t.topic) || 0) + 1);
    }
  }

  const topicsWithEvidence = [...topicStrengths.entries()]
    .filter(([_, strengths]) => strengths.some(s => s >= 0.4))
    .map(([topic]) => topic);

  const topicsWithoutEvidence = allTopics.filter(
    t => !topicsWithEvidence.includes(t)
  );

  const allStrengths = [...topicStrengths.values()].flat();
  const avgEvidenceStrength = allStrengths.length > 0
    ? allStrengths.reduce((a, b) => a + b, 0) / allStrengths.length
    : 0;

  let coverageScore = computeCoverageScore(topicStrengths, allTopics);
  const diversityScore = computeDiversityScore(topicSourceCount);

  let agePenalty = 0;
  for (const entry of sourceMap.values()) {
    agePenalty = Math.max(agePenalty, computeAgePenalty(entry.lastVerified, opts.maxAgeDays));
  }
  coverageScore = Math.max(0, coverageScore - agePenalty);

  const reuseCountPenalty = [...sourceMap.values()].some(e => e.reuseCount > 10) ? 0.05 : 0;
  coverageScore = Math.max(0, coverageScore - reuseCountPenalty);

  const diversityBonus = diversityScore >= 0.6 ? 0.05 : 0;
  coverageScore = Math.min(1, coverageScore + diversityBonus);

  let reuseScore = coverageScore;
  if (diversityScore >= 0.6) reuseScore += 0.05;
  if (agePenalty > 0) reuseScore -= agePenalty;
  reuseScore = Math.max(0, Math.min(1, reuseScore));
  const explorationNeed = 1 - reuseScore;

  let action: ReuseDecision['action'];
  const sourcesToReuse = [...sourceMap.values()]
    .sort((a, b) => b.maxStrength - a.maxStrength)
    .map(e => e.source);

  if (coverageScore >= opts.minCoverage && diversityScore >= (opts.minDiversity / 5)) {
    action = 'reuse';
  } else if (coverageScore >= opts.complementaryThreshold) {
    action = 'complementary';
  } else {
    action = 'new_search';
  }

  if (topicsWithoutEvidence.length > 0 && action === 'reuse') {
    action = 'complementary';
  }

  const queryLower = query.toLowerCase();
  if (
    queryLower.includes('recente') ||
    queryLower.includes('atual') ||
    queryLower.includes('ultima') ||
    queryLower.includes('2024') ||
    queryLower.includes('2025') ||
    queryLower.includes('2026')
  ) {
    action = 'new_search';
  }

  return {
    action,
    coverageScore: Math.round(coverageScore * 1000) / 1000,
    reuseScore: Math.round(reuseScore * 1000) / 1000,
    explorationNeed: Math.round(explorationNeed * 1000) / 1000,
    sourcesToReuse,
    topicsNeedingSearch: action === 'new_search' ? allTopics : topicsWithoutEvidence,
    allTopics,
    diversityScore: Math.round(diversityScore * 1000) / 1000,
    stats: {
      totalSourcesFound: sourceMap.size,
      topicsWithEvidence: topicsWithEvidence.length,
      topicsWithoutEvidence: topicsWithoutEvidence.length,
      avgEvidenceStrength: Math.round(avgEvidenceStrength * 1000) / 1000,
    },
  };
}
