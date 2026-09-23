import { normalizeText } from './libras-search-utils';

export interface LibrasWordSense {
  id: string;
  word: string;
  label: string;
  description: string;
  contextKeywords: string[];
  avoidKeywords: string[];
  searchQueries: string[];
}

export interface SenseDetection {
  options: LibrasWordSense[];
  auto: LibrasWordSense | null;
  headWord: string | null;
}

/** Sentidos polissêmicos suportados pela busca de sinais. */
export const LIBRAS_SENSES: LibrasWordSense[] = [
  {
    id: 'construir.criar',
    word: 'construir',
    label: 'Criar / produzir',
    description: 'Sentido de criar, inventar ou produzir algo (não é obra civil)',
    contextKeywords: [
      'criar',
      'criacao',
      'produzir',
      'inventar',
      'elaborar',
      'ideia',
      'projeto criativo',
      'montar',
      'desenvolver',
    ],
    avoidKeywords: ['obra', 'civil', 'alvenaria', 'tijolo', 'cimento', 'edificio', 'muro', 'telhado', 'engenharia'],
    searchQueries: [
      'criar em libras',
      'sinal criar libras',
      'criacao em libras',
      'aprender a criar em libras',
    ],
  },
  {
    id: 'construir.obra',
    word: 'construir',
    label: 'Construção civil',
    description: 'Obra, edificação e construção de estruturas físicas',
    contextKeywords: [
      'obra',
      'civil',
      'alvenaria',
      'edificio',
      'cimento',
      'tijolo',
      'muro',
      'telhado',
      'engenharia',
      'construcao',
      'casa',
      'predio',
    ],
    avoidKeywords: ['criar algo', 'inventar', 'ideia'],
    searchQueries: [
      'construcao civil em libras',
      'sinal construir obra libras',
      'obra em libras',
      'construir em libras',
    ],
  },
  {
    id: 'planta.vegetal',
    word: 'planta',
    label: 'Planta (vegetal)',
    description: 'Plantação, muda, vegetal',
    contextKeywords: [
      'vegetal',
      'muda',
      'folha',
      'flor',
      'arvore',
      'plantio',
      'plantacao',
      'jardim',
      'verde',
      'cultivo',
    ],
    avoidKeywords: ['fabrica', 'usina', 'industrial', 'planta industrial', 'maquina', 'equipamento'],
    searchQueries: [
      'planta vegetal em libras',
      'sinal planta libras',
      'muda em libras',
      'plantação em libras',
    ],
  },
  {
    id: 'planta.estabelecimento',
    word: 'planta',
    label: 'Planta (estabelecimento/fábrica)',
    description: 'Planta industrial, fábrica ou estabelecimento',
    contextKeywords: ['fabrica', 'usina', 'industrial', 'industria', 'estabelecimento', 'galpao'],
    avoidKeywords: ['vegetal', 'muda', 'folha', 'flor', 'plantio'],
    searchQueries: [
      'planta industrial em libras',
      'fabrica em libras',
      'sinal fabrica libras',
    ],
  },
  {
    id: 'criacao.criar',
    word: 'criacao',
    label: 'Criar / fazer nascer',
    description: 'Ato de criar, inventar ou gerar',
    contextKeywords: ['criar', 'inventar', 'gerar', 'produzir', 'elaborar', 'nascimento', 'nascer'],
    avoidKeywords: ['gado', 'boi', 'vaca', 'animal', 'pecuaria', 'rebanho', 'granja'],
    searchQueries: ['criar em libras', 'sinal criar libras', 'criacao de ideias em libras'],
  },
  {
    id: 'criacao.pecuaria',
    word: 'criacao',
    label: 'Criação de animais',
    description: 'Criação de gado/animais (pecuária)',
    contextKeywords: ['gado', 'boi', 'vaca', 'animal', 'pecuaria', 'rebanho', 'granja', 'bezerro', 'criar animais'],
    avoidKeywords: ['inventar', 'ideia', 'gerar'],
    searchQueries: [
      'criação de gado em libras',
      'sinal criação libras',
      'pecuária em libras',
      'criação de animais em libras',
    ],
  },
  {
    id: 'banco.financeiro',
    word: 'banco',
    label: 'Banco (financeiro)',
    description: 'Instituição financeira, dinheiro, empréstimo',
    contextKeywords: ['dinheiro', 'financeiro', 'emprestimo', 'conta', 'pagamento', 'agencia', 'cartao'],
    avoidKeywords: ['agua', 'terra', 'solo', 'reservatorio', 'sentar', 'cadeira'],
    searchQueries: ['banco financeiro em libras', 'sinal banco dinheiro libras', 'banco em libras'],
  },
  {
    id: 'banco.terra',
    word: 'banco',
    label: 'Banco de terra / água',
    description: 'Banco de terra, banco de água ou assento',
    contextKeywords: ['terra', 'agua', 'solo', 'reservatorio', 'sentar', 'banco de terra', 'barragem'],
    avoidKeywords: ['dinheiro', 'financeiro', 'emprestimo', 'cartao'],
    searchQueries: ['banco de terra em libras', 'banco de água em libras', 'sinal banco terra libras'],
  },
  {
    id: 'producao.produzir',
    word: 'producao',
    label: 'Produzir (ato)',
    description: 'Ato de produzir, gerar resultados',
    contextKeywords: ['produzir', 'gerar', 'criar', 'fabricar', 'resultado', 'elaborar'],
    avoidKeywords: ['rural', 'agro', 'lavoura', 'fazenda', 'produtividade'],
    searchQueries: ['produzir em libras', 'sinal produzir libras', 'produção em libras'],
  },
  {
    id: 'producao.rural',
    word: 'producao',
    label: 'Produção rural',
    description: 'Produção agropecuária, lavoura, fazenda',
    contextKeywords: ['rural', 'agro', 'lavoura', 'fazenda', 'produtividade', 'colheita', 'agrícola', 'agricola'],
    avoidKeywords: ['inventar', 'ideia'],
    searchQueries: [
      'produção rural em libras',
      'produção agrícola em libras',
      'sinal produção libras',
    ],
  },
];

export function getSenseById(id: string): LibrasWordSense | null {
  return LIBRAS_SENSES.find((s) => s.id === id) ?? null;
}

export function getSensesForWord(word: string): LibrasWordSense[] {
  const n = normalizeText(word);
  return LIBRAS_SENSES.filter((s) => s.word === n);
}

/** Remove scaffolding de query YouTube para expor o termo principal. */
function stripSearchScaffolding(query: string): string {
  return normalizeText(query)
    .replace(
      /\b(lingua brasileira de sinais|lingua de sinais|em libras|de libras|sinal de|sinais de|sinal|sinais|libras)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta sentidos polissêmicos na consulta.
 * Só considera o termo principal (primeira palavra de conteúdo após
 * remover "em libras"/"sinal"/etc.), para não confundir
 * "doença de planta em libras" com a polissemia de "planta".
 * - Sentido único → auto
 * - Vários sentidos sem contexto claro → options (ambíguo)
 * - Contexto da frase escolhe o sentido → auto
 */
export function detectSenseForQuery(query: string, explicitSenseId?: string | null): SenseDetection {
  // Sempre detecta o termo principal para expor as opções irmãs na UI
  const stripped = stripSearchScaffolding(query);
  const head = stripped ? stripped.split(/\s+/)[0] : null;
  const siblings = head ? getSensesForWord(head) : [];

  if (explicitSenseId) {
    const sense = getSenseById(explicitSenseId);
    if (sense) {
      return {
        options: siblings.length > 1 ? siblings : [],
        auto: sense,
        headWord: sense.word,
      };
    }
  }

  if (!stripped) return { options: [], auto: null, headWord: null };
  if (!head || siblings.length === 0) return { options: [], auto: null, headWord: null };
  if (siblings.length === 1) {
    return { options: [], auto: siblings[0], headWord: head };
  }

  const norm = normalizeText(query);
  let best = siblings[0];
  let bestScore = -Infinity;
  let tie = false;

  for (const opt of siblings) {
    let score = 0;
    for (const kw of opt.contextKeywords) {
      if (norm.includes(normalizeText(kw))) score += 2;
    }
    for (const kw of opt.avoidKeywords) {
      if (norm.includes(normalizeText(kw))) score -= 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = opt;
      tie = false;
    } else if (score === bestScore) {
      tie = true;
    }
  }

  if (bestScore > 0 && !tie) {
    return { options: siblings, auto: best, headWord: head };
  }
  return { options: siblings, auto: null, headWord: head };
}
