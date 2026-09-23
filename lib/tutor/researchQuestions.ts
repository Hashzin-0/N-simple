import { searchSources } from '@/lib/research/searchSources';
import { formatSourcesByTopic } from '@/lib/research/sourceFormatter';
import { generateWithFallback } from '@/lib/llm-providers';
import { extractTopics } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
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
  if (v === 'pesquisada' || v === 'gerada') return v;
  return fallback;
}

/**
 * Pesquisa e prepara questões para o Tutor.
 *
 * 1. Reusa questões já salvas no Supabase (vector + tópico).
 * 2. Se insuficiente, pesquisa fontes acadêmicas (ENEM, universidades,
 *    materiais de Agronegócio) via searchSources.
 * 3. Extrai/gera questões estruturadas com LLM, marcando origem.
 * 4. Persiste com embedding para reuso futuro.
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
      errors: ['Supabase não configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.'],
      message: 'Banco de questões indisponível sem Supabase.',
    };
  }

  // ── 1. Reuso de questões já pesquisadas ──
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
      errors,
      message: `${reused.length} questões reutilizadas da memória acadêmica.`,
    };
  }

  // ── 2. Pesquisa em fontes acadêmicas ──
  const searchQuery = buildResearchQuery(tema, subtema);
  let fontesContext = '';
  let sourcesCount = 0;

  try {
    const result = await searchSources({ query: searchQuery, customTopics: topics });
    sourcesCount = result.sources.length;
    fontesContext = formatSourcesByTopic(
      result.sources,
      result.topics,
      'FONTES ACADÊMICAS PESQUISADAS'
    );
    if (result.errors.length > 0) {
      errors.push(...result.errors.slice(0, 3));
    }
  } catch (err) {
    errors.push(`Falha ao pesquisar fontes: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 3. Extração/geração de questões via LLM ──
  let extracted: ExtractedQuestion[] = [];
  if (fontesContext.trim().length > 0 || assunto.trim().length > 0) {
    try {
      const context = fontesContext.trim().length > 0
        ? fontesContext
        : `Sem fontes externas. Elabore questões didáticas de agronomia sobre: ${assunto}.`;

      const prompt = buildExtractQuestionsPrompt({
        tema,
        subtema,
        fontesContext: context,
        origemPadrao: sourcesCount > 0 ? 'pesquisada' : 'gerada',
      });

      const llmResult = await generateWithFallback({ prompt });
      let fullText = '';
      const reader = llmResult.stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += value.text;
      }

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { questions?: ExtractedQuestion[] };
        extracted = Array.isArray(parsed.questions) ? parsed.questions : [];
      } else {
        errors.push('LLM não retornou JSON de questões.');
      }
    } catch (err) {
      errors.push(`Falha ao extrair questões: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Mantém as reaproveitadas e as novas
  const seen = new Set(reused.map((q) => q.enunciado.toLowerCase().slice(0, 80)));
  const novel: Array<Omit<TutorQuestion, 'id' | 'similarity'>> = [];

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
      origem: normalizeOrigem(raw.origem, sourcesCount > 0 ? 'pesquisada' : 'gerada'),
      dificuldade: normalizeDificuldade(raw.dificuldade),
    });
  }

  // ── 4. Persistência para reuso ──
  let insertedCount = 0;
  if (novel.length > 0) {
    try {
      const insertResult = await insertQuestions(novel, topics);
      insertedCount = insertResult.inserted;
      if (insertResult.errors > 0) {
        errors.push(`${insertResult.errors} questões com erro ao salvar.`);
      }
    } catch (err) {
      errors.push(`Falha ao salvar questões: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const insertedQuestions = insertedCount > 0
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
    errors,
    message: all.length > 0
      ? `${all.length} questões prontas (${reused.length} reaproveitadas, ${insertedCount} novas).`
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
