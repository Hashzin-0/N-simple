const STOP_WORDS = new Set([
  'que', 'com', 'para', 'por', 'uma', 'dos', 'das', 'nas', 'nos', 'sobre',
  'como', 'pelo', 'pela', 'entre', 'mais', 'este', 'esta', 'esse', 'essa',
  'qual', 'quais', 'onde', 'quando', 'muito', 'cada', 'seus', 'suas', 'isso',
  'usando', 'utilizando', 'fazendo', 'tendo', 'sendo', 'podendo', 'sao',
  'pode', 'devem', 'deve', 'ser', 'ter', 'está', 'estao', 'foi', 'era',
]);

const SYNONYM_MAP: Record<string, string[]> = {
  calagem: ['calagem', 'calcar', 'calcario', 'correcao da acidez', 'acidificacao'],
  acidez: ['acidez', 'ph', 'aluminio', 'toxicidade', 'solo acido'],
  vantagens: ['vantagens', 'beneficios', 'vantajoso', 'eficiencia', 'qualidade'],
  desvantagens: ['desvantagens', 'limitacoes', 'riscos', 'problemas', 'negativos'],
  caracteristicas: ['caracteristicas', 'propriedades', 'composicao', 'qualidades'],
  produtividade: ['produtividade', 'producao', 'rendimento', 'yield', 'colheita'],
  nitrogenio: ['nitrogenio', 'n', 'adubacao nitrogenada', 'fertirrigacao'],
  solo: ['solo', 'solo', 'terra', 'camada', 'perfil', 'horizonte'],
  milho: ['milho', 'zea mays', 'corn', 'cereal'],
  soja: ['soja', 'glycine max', 'leguminosa'],
  micronutrientes: ['micronutrientes', '微量元素', 'fe', 'mn', 'zn', 'cu', 'bor', 'molibdenio'],
  fósforo: ['fosforo', 'p', 'adubacao fosfatada', 'superfosfato'],
  potassio: ['potassio', 'k', 'adubacao potassica', 'cloreto de potassio'],
  ph: ['ph', 'acidez', 'alcalinidade', 'reacao do solo'],
  calcio: ['calcio', 'ca', 'saturacao por bases', 'sb'],
  magnesio: ['magnesio', 'mg', 'saturacao por bases'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function extractTokens(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Extrai tópicos normalizados de uma query do usuário.
 * Retorna tópicos como strings normalizadas (lowercase, sem acento, snake_case).
 */
export function extractTopics(query: string): string[] {
  const normalized = normalizeText(query);
  const tokens = extractTokens(query);
  const topics: string[] = [];
  const seen = new Set<string>();

  // 1. Tokens diretos como tópicos
  for (const token of tokens) {
    if (!seen.has(token) && token.length > 3) {
      topics.push(token);
      seen.add(token);
    }
  }

  // 2. Bigramas (pares de palavras significativas)
  const significantTokens = tokens.filter(t => t.length > 3);
  for (let i = 0; i < significantTokens.length - 1; i++) {
    const bigram = `${significantTokens[i]}_${significantTokens[i + 1]}`;
    if (!seen.has(bigram)) {
      topics.push(bigram);
      seen.add(bigram);
    }
  }

  // 3. Detecção de sinônimos/conceitos relacionados
  for (const [concept, synonyms] of Object.entries(SYNONYM_MAP)) {
    const queryLower = normalized;
    for (const synonym of synonyms) {
      if (queryLower.includes(synonym) && !seen.has(concept)) {
        topics.push(concept);
        seen.add(concept);
        break;
      }
    }
  }

  // 4. Detecção de padrões compostos conhecidos
  const compoundPatterns: [RegExp, string[]][] = [
    [/vantag\w*\s+e\s+desvantag\w*/, ['vantagens', 'desvantagens']],
    [/vantag\w*\s+desvantag\w*/, ['vantagens', 'desvantagens']],
    [/calag\w*\s+caract/, ['calagem', 'caracteristicas']],
    [/calag\w*\s+vantag/, ['calagem', 'vantagens']],
    [/calag\w*\s+desvantag/, ['calagem', 'desvantagens']],
    [/calag\w*\s+produtiv/, ['calagem', 'produtividade']],
    [/calag\w*\s+acidez/, ['calagem', 'acidez']],
    [/calag\w*\s+sol/, ['calagem', 'solo']],
    [/calag\w*\s+necessidade/, ['calagem', 'necessidade']],
    [/calag\w*\s+calc/, ['calagem', 'calcario']],
    [/nitrog\w*\s+milho/, ['nitrogenio', 'milho']],
    [/adubac\w*\s+nitrog/, ['nitrogenio', 'adubacao']],
    [/adubac\w*\s+fosfat/, ['fosforo', 'adubacao']],
    [/adubac\w*\s+potassic/, ['potassio', 'adubacao']],
  ];

  for (const [pattern, synTopics] of compoundPatterns) {
    if (pattern.test(normalized)) {
      for (const t of synTopics) {
        if (!seen.has(t)) {
          topics.push(t);
          seen.add(t);
        }
      }
    }
  }

  return topics;
}

/**
 * Normaliza um tópico individual (para indexação e lookup).
 */
export function normalizeTopic(topic: string): string {
  return normalizeText(topic).replace(/\s+/g, '_');
}

/**
 * Gera a key normalizada de uma fonte (para deduplicação).
 */
export function sourceKeyFromTitle(title: string): string {
  return normalizeText(title).replace(/\s+/g, '').slice(0, 80);
}
