import { searchSources } from '@/lib/research/searchSources';
import { formatSourcesByTopic } from '@/lib/research/sourceFormatter';
import { generateWithFallback } from '@/lib/llm-providers';
import { extractTopics } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { decideReuse } from '@/lib/reuseDecision';
import {
  countQuestionsForTopic,
  insertQuestions,
  searchQuestions,
} from './questionBank';
import { buildExtractQuestionsPrompt } from './prompts';
import type {
  QuestionDificuldade,
  QuestionOrigem,
  ResearchQuestionsResponse,
  TutorQuestion,
} from './types';

const REUSE_MIN_QUESTIONS = 6;
const MAX_QUESTIONS_PER_RESEARCH = 8;

interface ExtractedQuestion {
  enunciado: string;
  alternativas?: Record<string, string> | null;
  gabarito?: string | null;
  explicacao?: string;
  assunto?: string;
  subassunto?: string | null;
  disciplina?: string | null;
  instituicao?: string | null;
  ano?: number | null;
  tipo_prova?: string | null;
  fonte?: string | null;
  fonte_url?: string | null;
  origem?: QuestionOrigem;
  dificuldade?: QuestionDificuldade;
}

function normalizeDificuldade(value: unknown): QuestionDificuldade {
  const v = String(value || '').toLowerCase();
  if (v.includes('aplic')) return 'aplicacao';
  if (v.includes('detalh') || v.includes('aprofund')) return 'detalhamento';
  return 'basica';
}

function normalizeOrigem(value: unknown, fallback: QuestionOrigem): QuestionOrigem {
  const v = String(value || '').toLowerCase();
  if (v === 'pesquisada' || v === 'gerada' || v === 'artigo') return v;
  return fallback;
}

async function llmExtractQuestions(args: {
  tema: string;
  subtema?: string;
  fontesContext: string;
  origemPadrao: QuestionOrigem;
}): Promise<{ extracted: ExtractedQuestion[]; error?: string }> {
  try {
    const prompt = buildExtractQuestionsPrompt(args);
    const llmResult = await generateWithFallback({ prompt });
    let fullText = '';
    const reader = llmResult.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += value.text;
    }
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { extracted: [], error: 'LLM não retornou JSON de questões.' };
    const parsed = JSON.parse(jsonMatch[0]) as { questions?: ExtractedQuestion[] };
    return { extracted: Array.isArray(parsed.questions) ? parsed.questions : [] };
  } catch (err) {
    return {
      extracted: [],
      error: `Falha ao extrair questões: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Cascata de questões:
 * 1. Reuso do banco salvo (questions).
 * 2. Artigos/fontes já pesquisados (evidence memory) → origem "artigo".
 * 3. Fontes acadêmicas novas (ENEM, faculdades) via searchSources → "pesquisada".
 * 4. Gemini puro → "gerada".
 */
export async function researchQuestions(
  tema: string,
  subtema?: string
): Promise<ResearchQuestionsResponse> {
  const assunto = subtema ? `${tema} — ${subtema}` : tema;
  const topics = extractTopics(assunto);
  const errors: string[] = [];

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      decision: 'unavailable',
      questions: [],
      reusedCount: 0,
      researchedCount: 0,
      generatedCount: 0,
      artigoCount: 0,
      errors: ['Supabase não configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.'],
      message: 'Banco de questões indisponível sem Supabase.',
    };
  }

  // ── 1. Reuso de questões já salvas ──
  const existingCount = await countQuestionsForTopic(tema, subtema);
  let reused: TutorQuestion[] = [];
  if (existingCount > 0) {
    reused = await searchQuestions({
      query: assunto,
      assunto: tema,
      limit: MAX_QUESTIONS_PER_RESEARCH,
      threshold: 30,
    });
  }

  if (reused.length >= REUSE_MIN_QUESTIONS) {
    return {
      ok: true,
      decision: 'reuse',
      questions: shuffled(reused),
      reusedCount: reused.length,
      researchedCount: 0,
      generatedCount: 0,
      artigoCount: 0,
      errors,
      message: `${reused.length} questões reutilizadas da memória acadêmica.`,
    };
  }

  const seen = new Set(reused.map((q) => q.enunciado.toLowerCase().slice(0, 80)));
  const novel: Array<Omit<TutorQuestion, 'id' | 'similarity'>> = [];

  const pushExtracted = (
    extracted: ExtractedQuestion[],
    fallbackOrigem: QuestionOrigem
  ) => {
    for (const raw of extracted) {
      if (!raw?.enunciado || raw.enunciado.trim().length < 15) continue;
      const key = raw.enunciado.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      novel.push({
        enunciado: raw.enunciado.trim(),
        alternativas: raw.alternativas ?? null,
        gabarito: raw.gabarito ?? null,
        explicacao: raw.explicacao ?? null,
        assunto: raw.assunto?.trim() || tema,
        subassunto: raw.subassunto?.trim() || subtema || null,
        disciplina: raw.disciplina ?? null,
        instituicao: raw.instituicao ?? null,
        ano: typeof raw.ano === 'number' ? raw.ano : null,
        tipo_prova: raw.tipo_prova ?? null,
        fonte: raw.fonte ?? null,
        fonte_url: raw.fonte_url ?? null,
        origem: normalizeOrigem(raw.origem, fallbackOrigem),
        dificuldade: normalizeDificuldade(raw.dificuldade),
      });
    }
  };

  // ── 2. Artigos já pesquisados (evidence memory) → origem "artigo" ──
  let artigoContext = '';
  let artigoSourceCount = 0;
  try {
    const reuse = await decideReuse(assunto, topics);
    const artigos = (reuse.sourcesToReuse || []).filter((s) => {
      const t = String(s.sourceType || '').toLowerCase();
      return (
        t.includes('artigo') ||
        t.includes('periodico') ||
        t.includes('ensaio') ||
        t.includes('tese') ||
        t.includes('dissert') ||
        t.includes('boletim')
      );
    });
    artigoSourceCount = artigos.length;
    if (artigos.length > 0) {
      artigoContext =
        '=== ARTIGOS / FONTES JÁ PESQUISADAS ===\n' +
        artigos
          .slice(0, 8)
          .map((s, i) =>
            [
              `[Artigo ${i + 1}] ${s.abntCitation || s.title}`,
              s.abstract ? `Resumo: ${String(s.abstract).slice(0, 600)}` : '',
              s.sourceName ? `Fonte: ${s.sourceName}` : '',
              s.directUrl ? `URL: ${s.directUrl}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          )
          .join('\n\n');

      const artigoExtract = await llmExtractQuestions({
        tema,
        subtema,
        fontesContext: artigoContext,
        origemPadrao: 'artigo',
      });
      if (artigoExtract.error) errors.push(artigoExtract.error);
      pushExtracted(artigoExtract.extracted, 'artigo');
    }
  } catch (err) {
    errors.push(
      `Falha ao montar questões de artigos: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── 3. Fontes acadêmicas novas (ENEM/faculdades) se ainda insuficiente ──
  let academicContext = '';
  let sourcesCount = 0;
  const stillNeed = novel.length + reused.length < REUSE_MIN_QUESTIONS;

  if (stillNeed) {
    const searchQuery = buildResearchQuery(tema, subtema);
    try {
      const result = await searchSources({ query: searchQuery, customTopics: topics });
      sourcesCount = result.sources.length;
      academicContext = formatSourcesByTopic(
        result.sources,
        result.topics,
        'FONTES ACADÊMICAS PESQUISADAS'
      );
      if (result.errors.length > 0) {
        errors.push(...result.errors.slice(0, 3));
      }
    } catch (err) {
      errors.push(
        `Falha ao pesquisar fontes: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (academicContext.trim().length > 0 || assunto.trim().length > 0) {
      const context =
        academicContext.trim().length > 0
          ? academicContext
          : `Sem fontes externas. Elabore questões didáticas de agronomia sobre: ${assunto}.`;
      const academicExtract = await llmExtractQuestions({
        tema,
        subtema,
        fontesContext: context,
        origemPadrao: sourcesCount > 0 ? 'pesquisada' : 'gerada',
      });
      if (academicExtract.error) errors.push(academicExtract.error);
      pushExtracted(academicExtract.extracted, sourcesCount > 0 ? 'pesquisada' : 'gerada');
    }
  } else if (artigoSourceCount === 0 && sourcesCount === 0 && stillNeed === false) {
    // não precisa de scrapers
  }

  // ── 4. Gemini puro se ainda abaixo da meta ──
  if (reused.length + novel.length < REUSE_MIN_QUESTIONS) {
    const pureExtract = await llmExtractQuestions({
      tema,
      subtema,
      fontesContext: `Sem fontes adicionais disponíveis. Elabore questões didáticas de agronomia brasileira sobre: ${assunto}. Inclua terminologia técnica (Embrapa, normas de adubação, fertilidade).`,
      origemPadrao: 'gerada',
    });
    if (pureExtract.error) errors.push(pureExtract.error);
    pushExtracted(pureExtract.extracted, 'gerada');
  }

  // ── Persistência para reuso ──
  let insertedCount = 0;
  if (novel.length > 0) {
    try {
      const insertResult = await insertQuestions(novel, topics);
      insertedCount = insertResult.inserted;
      if (insertResult.errors > 0) {
        errors.push(`${insertResult.errors} questões com erro ao salvar.`);
      }
    } catch (err) {
      errors.push(
        `Falha ao salvar questões: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const insertedQuestions =
    insertedCount > 0
      ? await searchQuestions({
          query: assunto,
          assunto: tema,
          limit: MAX_QUESTIONS_PER_RESEARCH,
          threshold: 25,
        })
      : [];

  const all = dedupeQuestions([...reused, ...insertedQuestions]);

  const generatedCount = all.filter((q) => q.origem === 'gerada').length;
  const researchedCount = all.filter((q) => q.origem === 'pesquisada').length;
  const artigoCount = all.filter((q) => q.origem === 'artigo').length;

  if (all.length === 0) {
    errors.push('Nenhuma questão encontrada ou gerada para este tema.');
  }

  return {
    ok: all.length > 0,
    decision: 'new_search',
    questions: shuffled(all).slice(0, MAX_QUESTIONS_PER_RESEARCH),
    reusedCount: reused.length,
    researchedCount,
    generatedCount,
    artigoCount,
    errors,
    message:
      all.length > 0
        ? `${all.length} questões prontas (${reused.length} reaproveitadas, ${artigoCount} de artigos, ${insertedCount} novas).`
        : 'Não foi possível obter questões para este tema.',
  };
}

function buildResearchQuery(tema: string, subtema?: string): string {
  const base = subtema ? `${tema} ${subtema}` : tema;
  return [
    `questões ENEM vestibular agronomia ${base}`,
    `banco de questões ${base} universidade faculdade`,
    `questões curso técnico agronegócio ${base} escola de agronegócio`,
  ].join(' | ');
}

function dedupeQuestions(list: TutorQuestion[]): TutorQuestion[] {
  const seen = new Set<string>();
  const out: TutorQuestion[] = [];
  for (const q of list) {
    const key = q.enunciado.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function shuffled<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
