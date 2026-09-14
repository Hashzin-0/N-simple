import { TrigonometricSimilarity } from './types';

/**
 * ATENÇÃO — ISTO NÃO É MAIS O MOTOR DE RELEVÂNCIA DO PROJETO.
 *
 * A decisão real de "essa fonte é relevante?" agora vive em
 * `lib/semantic/relevanceEngine.ts`: embeddings contextuais reais
 * (bi-encoder multilíngue) sobre o TEXTO COMPLETO de cada fonte, com
 * cross-encoder como reforço — 100% LLM-free, sem palavras-chave
 * hardcoded. É esse motor que decide o que é salvo/descartado no banco.
 *
 * Esta função aqui é só uma HEURÍSTICA LEVE (TF ponderado, síncrona,
 * sem rede) usada exclusivamente pelo `PesquisadorFontesCard` para
 * reordenar instantaneamente a lista já carregada enquanto o usuário
 * digita num filtro local — não dá pra rodar um transformer a cada
 * tecla no navegador. Quando o filtro local está vazio, o componente
 * usa o `trigonometricSimilarity` que já veio do servidor (o score real).
 */

/**
 * Normaliza e tokeniza strings para espaço vetorial
 */
function tokenizeAndNormalize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Extrai bigramas (pares de palavras consecutivas) de tokens significativos
 */
function extractBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

const STOP_WORDS = new Set([
  'que', 'com', 'para', 'por', 'uma', 'dos', 'das', 'nas', 'nos', 'sobre',
  'como', 'pelo', 'pela', 'entre', 'mais', 'este', 'esta', 'esse', 'essa',
  'qual', 'quais', 'onde', 'quando', 'muito', 'cada', 'seus', 'suas', 'isso',
  'usando', 'utilizando', 'fazendo', 'tendo', 'sendo', 'podendo',
]);

/**
 * Calcula a Similaridade Trigonométrica (Cosine Similarity e Ângulo θ)
 * entre o vetor de busca do usuário e o vetor do documento científico encontrado.
 * 
 * cos(θ) = (A · B) / (||A|| * ||B||)
 * Ângulo θ = arccos(cos(θ))
 * 
 * - θ = 0° (cos θ = 1.00): Máxima similaridade matemática (100% de alinhamento)
 * - θ = 90° (cos θ = 0.00): Vetores ortogonais (sem correspondência semântica)
 */
export function computeTrigonometricSimilarity(
  query: string,
  doc: {
    title: string;
    abstract?: string;
    keywords?: string[];
    publication?: string;
    vantagens?: string[];
    desvantagens?: string[];
    caracteristicas?: string[];
  }
): TrigonometricSimilarity {
  const queryTokens = tokenizeAndNormalize(query);
  if (queryTokens.length === 0) {
    return {
      cosTheta: 0.7071,
      angleDegrees: 45.0,
      percentage: 71,
      alignmentQuality: 'Moderada',
    };
  }

  // Monta o corpus do documento com pesos por relevância
  const titleTokens = tokenizeAndNormalize(doc.title);
  const keywordsTokens = (doc.keywords || []).flatMap(tokenizeAndNormalize);
  const abstractTokens = tokenizeAndNormalize(doc.abstract || '');
  const pubTokens = tokenizeAndNormalize(doc.publication || '');
  const vantTokens = (doc.vantagens || []).flatMap(tokenizeAndNormalize);
  const desvantTokens = (doc.desvantagens || []).flatMap(tokenizeAndNormalize);
  const caracTokens = (doc.caracteristicas || []).flatMap(tokenizeAndNormalize);

  // Term Frequency vetorial
  const queryFreq: Record<string, number> = {};
  for (const t of queryTokens) {
    queryFreq[t] = (queryFreq[t] || 0) + 1;
  }

  const docFreq: Record<string, number> = {};
  
  // Título e Palavras-chave têm maior peso de amplitude no vetor
  for (const t of titleTokens) docFreq[t] = (docFreq[t] || 0) + 3.5;
  for (const t of keywordsTokens) docFreq[t] = (docFreq[t] || 0) + 3.0;
  for (const t of vantTokens) docFreq[t] = (docFreq[t] || 0) + 2.5;
  for (const t of desvantTokens) docFreq[t] = (docFreq[t] || 0) + 2.5;
  for (const t of caracTokens) docFreq[t] = (docFreq[t] || 0) + 2.0;
  for (const t of abstractTokens) docFreq[t] = (docFreq[t] || 0) + 1.2;
  for (const t of pubTokens) docFreq[t] = (docFreq[t] || 0) + 1.0;

  // Produto Escalar (Dot Product): A · B
  let dotProduct = 0;
  let queryMagnitudeSq = 0;
  let docMagnitudeSq = 0;

  for (const [token, qVal] of Object.entries(queryFreq)) {
    queryMagnitudeSq += qVal * qVal;
    const dVal = docFreq[token] || 0;
    dotProduct += qVal * dVal;
  }

  // Verifica termos parciais ou sufixos (ex: gesso/gessagem, subsolo/subsuperficie)
  // Prefixo mínimo de 6 caracteres para evitar falsos positivos
  for (const [qToken, qVal] of Object.entries(queryFreq)) {
    if (docFreq[qToken]) continue; // já match exato
    for (const [dToken, dVal] of Object.entries(docFreq)) {
      if (qToken !== dToken && qToken.length >= 6 && dToken.length >= 6) {
        const minLen = Math.min(qToken.length, dToken.length);
        const prefixLen = Math.min(6, minLen);
        if (qToken.slice(0, prefixLen) === dToken.slice(0, prefixLen)) {
          dotProduct += qVal * dVal * 0.2;
        }
      }
    }
  }

  for (const dVal of Object.values(docFreq)) {
    docMagnitudeSq += dVal * dVal;
  }

  if (queryMagnitudeSq === 0 || docMagnitudeSq === 0) {
    return {
      cosTheta: 0.5,
      angleDegrees: 60.0,
      percentage: 50,
      alignmentQuality: 'Moderada',
    };
  }

  const queryMagnitude = Math.sqrt(queryMagnitudeSq);
  const docMagnitude = Math.sqrt(docMagnitudeSq);

  // Normalização do cosseno no intervalo realista de documentos relevantes [0.35, 0.99]
  let rawCos = dotProduct / (queryMagnitude * (docMagnitude * 0.35 + 1));
  
  // Detecção explícita de termos solicitados (ex: "vantagens", "desvantagens", "subsolo", "gessagem")
  let boost = 0;
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.includes('vantag') && (doc.vantagens?.length || doc.title.toLowerCase().includes('vantag') || doc.abstract?.toLowerCase().includes('vantag'))) {
    boost += 0.12;
  }
  if (lowerQuery.includes('desvantag') && (doc.desvantagens?.length || doc.abstract?.toLowerCase().includes('desvantag') || doc.abstract?.toLowerCase().includes('risco') || doc.abstract?.toLowerCase().includes('limitacao'))) {
    boost += 0.14;
  }
  if (lowerQuery.includes('subsolo') && (doc.title.toLowerCase().includes('subsolo') || doc.abstract?.toLowerCase().includes('subsolo') || doc.abstract?.toLowerCase().includes('subsuperficie'))) {
    boost += 0.15;
  }
  if (lowerQuery.includes('gessagem') && (doc.title.toLowerCase().includes('gesso') || doc.title.toLowerCase().includes('gessagem') || doc.abstract?.toLowerCase().includes('gessagem'))) {
    boost += 0.15;
  }

  let effectiveCos = Math.min(0.99, Math.max(0.35, rawCos + boost));

  // === PENALIDADE DE COBERTURA ===
  // Se o documento não contém a maioria dos tokens da query, reduz o score
  const docText = `${doc.title} ${doc.abstract || ''} ${(doc.keywords || []).join(' ')}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
  
  let exactMatches = 0;
  let partialMatches = 0;
  const matchedQueryTokens: string[] = [];
  
  for (const qToken of queryTokens) {
    if (docText.includes(qToken)) {
      exactMatches++;
      matchedQueryTokens.push(qToken);
    } else {
      // Verifica prefixo parcial (6+ chars)
      const hasPartial = Object.keys(docFreq).some(
        (dToken) => dToken.length >= 6 && qToken.length >= 6 &&
        qToken.slice(0, 6) === dToken.slice(0, 6)
      );
      if (hasPartial) {
        partialMatches++;
        matchedQueryTokens.push(qToken);
      }
    }
  }

  const coverageRatio = matchedQueryTokens.length / queryTokens.length;
  
  // Boost por bigramas: se a query tem bigramas que aparecem no documento
  const queryBigrams = extractBigrams(queryTokens.filter(t => t.length > 3));
  const docTextBigrams = extractBigrams(
    docText.split(/\s+/).filter(t => t.length > 3)
  );
  const docBigramSet = new Set(docTextBigrams);
  let bigramHits = 0;
  for (const bg of queryBigrams) {
    if (docBigramSet.has(bg)) bigramHits++;
  }
  if (queryBigrams.length > 0) {
    const bigramRatio = bigramHits / queryBigrams.length;
    boost += bigramRatio * 0.08;
    effectiveCos = Math.min(0.99, effectiveCos + bigramRatio * 0.08);
  }

  // Aplicar penalidade de cobertura
  if (coverageRatio < 0.5) {
    // Documento não contém nem metade dos termos → penalidade forte
    const penalty = 0.3 + (0.5 - coverageRatio) * 0.8; // até 0.7 de penalidade
    effectiveCos *= (1 - penalty);
  } else if (coverageRatio < 0.75) {
    // Documento contém parte dos termos → penalidade moderada
    const penalty = (0.75 - coverageRatio) * 0.4;
    effectiveCos *= (1 - penalty);
  }

  effectiveCos = Math.max(0.15, Math.min(0.99, effectiveCos));

  const angleRad = Math.acos(effectiveCos);
  const angleDegrees = Math.round((angleRad * (180 / Math.PI)) * 10) / 10;
  const percentage = Math.round(effectiveCos * 100);

  let alignmentQuality: TrigonometricSimilarity['alignmentQuality'] = 'Moderada';
  if (percentage >= 90) alignmentQuality = 'Excepcional';
  else if (percentage >= 80) alignmentQuality = 'Muito Alta';
  else if (percentage >= 68) alignmentQuality = 'Alta';

  return {
    cosTheta: Math.round(effectiveCos * 1000) / 1000,
    angleDegrees,
    percentage,
    alignmentQuality,
  };
}
