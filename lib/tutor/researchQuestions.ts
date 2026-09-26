import { searchSources } from '@/lib/research/searchSources';
import { formatSourcesByTopic } from '@/lib/research/sourceFormatter';
import { generateWithFallback } from '@/lib/llm-providers';
import { extractTopics } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { decideReuse, ReuseDecision } from '@/lib/reuseDecision';
import {
  countQuestionsForTopic,
  fetchQuestionIdsByHash,
  insertQuestions,
  questionHash,
  searchQuestions,
} from './questionBank';
import { buildExtractQuestionsPrompt } from './prompts';
import { seedsForTema, SEED_SIMILARITY } from './seeds';
import type {
  QuestionDificuldade,
  QuestionOrigem,
  ResearchQuestionsResponse,
  TutorQuestion,
} from './types';

const REUSE_MIN_QUESTIONS = 6;
const MAX_QUESTIONS_PER_RESEARCH = 8;
/** Máximo de extrações LLM por request (artigo + acadêmica/pura). */
const MAX_LLM_EXTRACTS = 2;
/** Timeout por chamada LLM (evita travar até o kill da plataforma). */
const LLM_TIMEOUT_MS = 18_000;
/**
 * Orçamento de tempo da cascata. Pesos pesados (scrapers / decideReuse
 * extras) só rodam antes disso; o caminho cedo retorna parcial com erro
 * em `errors` em vez de ser morto em ~60s (Vercel default).
 */
const HEAVY_BUDGET_MS = 40_000;
/** Corta LLM se o request já passou deste ponto (deixa margem p/ persistência). */
const HARD_STOP_MS = 55_000;
/** Perfil enxuto de scrapers para contexto de questões (não é pesquisa completa). */
const TUTOR_MAX_PER_SOURCE: Record<string, number> = {
  Crossref: 10,
  OpenAlex: 10,
  'Semantic Scholar': 8,
  Embrapa: 8,
  SciELO: 8,
  CAPES: 6,
  BDTD: 6,
  YouTube: 5,
  CNPEM: 5,
  INPA: 5,
  IPEA: 5,
};

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
  if (v === 'pesquisada' || v === 'gerada' || v === 'artigo' || v === 'documento' || v === 'prova_real')
    return v;
  return fallback;
}

async function llmExtractQuestions(args: {
  tema: string;
  subtema?: string;
  fontesContext: string;
  origemPadrao: QuestionOrigem;
  signal?: AbortSignal;
}): Promise<{ extracted: ExtractedQuestion[]; error?: string }> {
  try {
    const prompt = buildExtractQuestionsPrompt(args);
    const signal =
      args.signal ??
      AbortSignal.timeout(LLM_TIMEOUT_MS);
    const llmResult = await generateWithFallback({ prompt, signal });
    let fullText = '';
    const reader = llmResult.stream.getReader();
    const readAll = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += value.text;
      }
    })();
    const onAbort = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(signal.reason ?? new Error('Timeout LLM'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => reject(signal.reason ?? new Error('Timeout LLM')),
        { once: true }
      );
    });
    await Promise.race([readAll, onAbort]);
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
 * Prepara as seeds de prova real do tema: persiste no banco (para ganhar
 * embedding e reuso futuro) e resolve o id UUID real. Se o insert falhar
 * (ex.: migration `prova_real` ainda não aplicada), segue com id local.
 */
async function prepareSeedQuestions(
  tema: string,
  subtema: string | undefined,
  topics: string[]
): Promise<TutorQuestion[]> {
  const raw = seedsForTema(tema, subtema);
  if (raw.length === 0) return [];

  let questions: TutorQuestion[] = raw.map((q, i) => ({
    ...q,
    id: `seed_${i + 1}`,
    similarity: SEED_SIMILARITY,
  }));

  if (isSupabaseConfigured()) {
    try {
      const hashes = raw.map((q) => questionHash(q.enunciado));
      let ids = await fetchQuestionIdsByHash(hashes);
      if (Object.keys(ids).length < hashes.length) {
        // Ainda não persistidas (ou insert parcial) → grava para ganhar embedding.
        await insertQuestions(raw, topics);
        ids = await fetchQuestionIdsByHash(hashes);
      }
      questions = questions.map((q, i) => {
        const realId = ids[hashes[i]];
        return realId ? { ...q, id: realId } : q;
      });
    } catch {
      // mantém ids locais — só o log de tutor_attempts pode degradar
    }
  }

  return questions;
}

/**
 * Cascata de questões:
 * S. Seeds de prova real (temas de ética/moral) → origem "prova_real"
 *    (sempre entram, deduplicadas contra o restante — ver lib/tutor/seeds.ts).
 * 0. Material enviado pelo aluno (PDFs) → origem "documento" (fonte primária).
 * 1. Reuso do banco salvo (questions).
 * 2. Artigos/fontes já pesquisados (evidence memory) → origem "artigo".
 * 3. Fontes acadêmicas novas (ENEM, faculdades) via searchSources light → "pesquisada".
 * 4. Gemini puro → "gerada" (só se ainda faltar e couber no orçamento).
 *
 * Orçamento: HEAVY_BUDGET_MS para scrapers/decideReuse; no máximo
 * MAX_LLM_EXTRACTS extrações; HARD_STOP_MS corta LLM. Compartilha
 * `decideReuse` com searchSources (priorDecision) para não re-embedar.
 */
export async function researchQuestions(
  tema: string,
  subtema?: string,
  options?: { documentContext?: string }
): Promise<ResearchQuestionsResponse> {
  const startedAt = Date.now();
  const elapsedMs = () => Date.now() - startedAt;
  const overHeavy = () => elapsedMs() > HEAVY_BUDGET_MS;
  const overHard = () => elapsedMs() > HARD_STOP_MS;
  const assunto = subtema ? `${tema} — ${subtema}` : tema;
  const topics = extractTopics(assunto);
  const errors: string[] = [];
  let llmExtractsUsed = 0;
  const canExtract = () =>
    llmExtractsUsed < MAX_LLM_EXTRACTS && !overHard();

  // ── 0. Seeds de prova real (temas de ética/moral) ──
  const seeds = await prepareSeedQuestions(tema, subtema, topics);

  if (!isSupabaseConfigured()) {
    if (seeds.length > 0) {
      return {
        ok: true,
        decision: 'reuse',
        questions: shuffled(seeds),
        reusedCount: 0,
        researchedCount: 0,
        generatedCount: 0,
        seedsCount: seeds.length,
        errors: ['Supabase não configurado — usando apenas questões de prova real locais.'],
        message: `${seeds.length} questões de prova real disponíveis sem banco.`,
      };
    }
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

  const seen = new Set(reused.map((q) => q.enunciado.toLowerCase().slice(0, 80)));
  for (const s of seeds) seen.add(s.enunciado.toLowerCase().slice(0, 80));
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

  // ── 0. Material enviado pelo aluno (PDFs) → origem "documento" (fonte primária) ──
  const documentContext = options?.documentContext?.trim();
  if (documentContext && canExtract()) {
    llmExtractsUsed += 1;
    const docExtract = await llmExtractQuestions({
      tema,
      subtema,
      fontesContext: documentContext.slice(0, 40_000),
      origemPadrao: 'documento',
    });
    if (docExtract.error) errors.push(docExtract.error);
    pushExtracted(docExtract.extracted, 'documento');
  }

  if (reused.length >= REUSE_MIN_QUESTIONS && novel.length === 0) {
    const reuseAll = dedupeQuestions([...seeds, ...reused]);
    return {
      ok: true,
      decision: 'reuse',
      questions: shuffled(reuseAll),
      reusedCount: reuseAll.filter((q) => q.origem !== 'prova_real').length,
      researchedCount: 0,
      generatedCount: 0,
      seedsCount: reuseAll.filter((q) => q.origem === 'prova_real').length,
      errors,
      message: `${reuseAll.length} questões reutilizadas da memória acadêmica (${reuseAll.filter((q) => q.origem === 'prova_real').length} de prova real).`,
    };
  }

  // ── 2. Artigos já pesquisados (evidence memory) → origem "artigo" ──
  // decideReuse roda UMA vez; o resultado é repassado a searchSources.
  let reuseDecision: ReuseDecision | null = null;
  try {
    reuseDecision = await decideReuse(assunto, topics);
    const artigos = (reuseDecision.sourcesToReuse || []).filter((s) => {
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
    if (artigos.length > 0 && canExtract()) {
      llmExtractsUsed += 1;
      const artigoContext =
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
  const stillNeed = () => novel.length + reused.length < REUSE_MIN_QUESTIONS;

  if (stillNeed() && !overHeavy()) {
    const searchQuery = buildResearchQuery(tema, subtema);
    const searchTopics = (
      reuseDecision?.topicsNeedingSearch?.length
        ? reuseDecision.topicsNeedingSearch
        : topics
    ).slice(0, 2);
    try {
      const result = await searchSources({
        query: searchQuery,
        customTopics: searchTopics.length > 0 ? searchTopics : topics,
        priorDecision: reuseDecision,
        light: true,
        maxTopicsForSearch: 2,
        searchOptions: {
          maxPerSource: TUTOR_MAX_PER_SOURCE,
          language: 'pt-br',
        },
      });
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

    if (stillNeed() && canExtract()) {
      const context =
        academicContext.trim().length > 0
          ? academicContext
          : `Sem fontes externas. Elabore questões didáticas de agronomia sobre: ${assunto}.`;
      llmExtractsUsed += 1;
      const academicExtract = await llmExtractQuestions({
        tema,
        subtema,
        fontesContext: context,
        origemPadrao: sourcesCount > 0 ? 'pesquisada' : 'gerada',
      });
      if (academicExtract.error) errors.push(academicExtract.error);
      pushExtracted(academicExtract.extracted, sourcesCount > 0 ? 'pesquisada' : 'gerada');
    }
  } else if (stillNeed() && overHeavy()) {
    errors.push(
      `Pesquisa de fontes adiada por limite de tempo (${Math.round(elapsedMs() / 1000)}s).`
    );
  }

  // ── 4. Gemini puro se ainda abaixo da meta e couber no orçamento ──
  if (stillNeed() && canExtract()) {
    llmExtractsUsed += 1;
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
          limit: Math.min(MAX_QUESTIONS_PER_RESEARCH + novel.length, 16),
          threshold: 25,
        })
      : [];

  const seedKeys = new Set(seeds.map((q) => q.enunciado.toLowerCase().slice(0, 80)));
  const rest = dedupeQuestions([...reused, ...insertedQuestions]).filter(
    (q) => !seedKeys.has(q.enunciado.toLowerCase().slice(0, 80))
  );
  const all = [...seeds, ...rest];

  const generatedCount = all.filter((q) => q.origem === 'gerada').length;
  const researchedCount = all.filter((q) => q.origem === 'pesquisada').length;
  const artigoCount = all.filter((q) => q.origem === 'artigo').length;
  const documentoCount = all.filter((q) => q.origem === 'documento').length;
  const seedsCount = all.filter((q) => q.origem === 'prova_real').length;

  if (all.length === 0) {
    errors.push('Nenhuma questão encontrada ou gerada para este tema.');
  }

  // Seeds sempre entram (fica o corte sobre as demais).
  const demais = shuffled(rest).slice(
    0,
    Math.max(0, MAX_QUESTIONS_PER_RESEARCH - seeds.length)
  );
  const finalList = shuffled([...seeds, ...demais]);

  return {
    ok: all.length > 0,
    decision: 'new_search',
    questions: finalList,
    reusedCount: reused.filter((q) => q.origem !== 'prova_real').length,
    researchedCount,
    generatedCount,
    artigoCount,
    documentoCount,
    seedsCount,
    errors,
    message:
      all.length > 0
        ? `${all.length} questões prontas (${reused.filter((q) => q.origem !== 'prova_real').length} reaproveitadas, ${seedsCount} de prova real, ${documentoCount} do seu material, ${artigoCount} de artigos, ${insertedCount} novas).`
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
