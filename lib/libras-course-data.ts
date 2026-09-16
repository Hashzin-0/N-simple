import type { LibrasWord, LibrasPhrase, LibrasModule, LibrasArea } from './libras-types';

// ─── MODULE 1: Vocabulário Básico ───
const MODULO_1_WORDS: LibrasWord[] = [
  {
    id: 'agricultura',
    word: 'Agricultura',
    emoji: '🌾',
    category: 'agricultura',
    searchQueries: ['agricultura em libras', 'sinal agricultura libras', 'agricultura língua de sinais'],
  },
  {
    id: 'gado',
    word: 'Gado',
    emoji: '🐄',
    category: 'pecuaria',
    searchQueries: ['gado em libras', 'sinal gado libras', 'gado língua de sinais'],
  },
  {
    id: 'milho',
    word: 'Milho',
    emoji: '🌽',
    category: 'agricultura',
    searchQueries: ['milho em libras', 'sinal milho libras', 'milho língua de sinais'],
  },
  {
    id: 'pecuaria',
    word: 'Pecuária',
    emoji: '🐄',
    category: 'pecuaria',
    searchQueries: ['pecuária em libras', 'sinal pecuária libras', 'pecuária língua de sinais'],
  },
  {
    id: 'trator',
    word: 'Trator',
    emoji: '🚜',
    category: 'maquinas',
    searchQueries: ['trator em libras', 'sinal trator libras', 'trator língua de sinais'],
  },
  {
    id: 'plantacao',
    word: 'Plantação',
    emoji: '🌱',
    category: 'agricultura',
    searchQueries: ['plantação em libras', 'sinal plantação libras', 'plantação língua de sinais'],
  },
  {
    id: 'colheita',
    word: 'Colheita',
    emoji: '🌾',
    category: 'agricultura',
    searchQueries: ['colheita em libras', 'sinal colheita libras', 'colheita língua de sinais'],
  },
  {
    id: 'irrigacao',
    word: 'Irrigação',
    emoji: '💧',
    category: 'agricultura',
    searchQueries: ['irrigação em libras', 'sinal irrigação libras', 'irrigação língua de sinais'],
  },
  {
    id: 'produtor_rural',
    word: 'Produtor rural',
    emoji: '🧑‍🌾',
    category: 'gestao',
    searchQueries: ['produtor rural em libras', 'sinal produtor rural libras', 'fazendeiro língua de sinais'],
  },
];

// ─── MODULE 2: Frases do Campo ───
const MODULO_2_PHRASES: LibrasPhrase[] = [
  {
    id: 'frase_trabalho_agricultura',
    phrase: 'Eu trabalho com agricultura.',
    breakdown: ['EU', 'TRABALHAR', 'AGRICULTURA'],
    category: 'agricultura',
  },
  {
    id: 'frase_criacao_gado',
    phrase: 'Eu trabalho com criação de gado.',
    breakdown: ['EU', 'TRABALHAR', 'CRIAÇÃO', 'GADO'],
    category: 'pecuaria',
  },
  {
    id: 'frase_plantar_milho',
    phrase: 'Vamos plantar milho.',
    breakdown: ['NÓS', 'PLANTAR', 'MILHO'],
    category: 'agricultura',
  },
  {
    id: 'frase_colheita_amanha',
    phrase: 'A colheita começa amanhã.',
    breakdown: ['COLHEITA', 'COMEÇAR', 'AMANHÃ'],
    category: 'agricultura',
  },
  {
    id: 'frase_irrigar_plantacao',
    phrase: 'Precisamos irrigar a plantação.',
    breakdown: ['NÓS', 'PRECISAR', 'IRRIGAR', 'PLANTAÇÃO'],
    category: 'agricultura',
  },
  {
    id: 'frase_gado_pasto',
    phrase: 'O gado está no pasto.',
    breakdown: ['GADO', 'ESTAR', 'PASTO'],
    category: 'pecuaria',
  },
  {
    id: 'frase_preco_soja',
    phrase: 'Qual é o preço da soja?',
    breakdown: ['QUAL', 'PREÇO', 'SOJA'],
    category: 'gestao',
  },
  {
    id: 'frase_ajuda',
    phrase: 'Você precisa de ajuda?',
    breakdown: ['VOCÊ', 'PRECISAR', 'AJUDA'],
    category: 'gestao',
  },
];

// ─── ÁREA: Agricultura ───
const PALAVRAS_AGRICULTURA: LibrasWord[] = [
  { id: 'agr_agricultura', word: 'Agricultura', emoji: '🌾', category: 'agricultura', searchQueries: ['agricultura em libras', 'sinal agricultura libras'] },
  { id: 'agr_plantio', word: 'Plantio', emoji: '🌱', category: 'agricultura', searchQueries: ['plantio em libras', 'sinal plantio libras'] },
  { id: 'agr_semente', word: 'Semente', emoji: '🫘', category: 'agricultura', searchQueries: ['semente em libras', 'sinal semente libras'] },
  { id: 'agr_solo', word: 'Solo', emoji: '🪨', category: 'agricultura', searchQueries: ['solo em libras', 'sinal solo libras'] },
  { id: 'agr_adubo', word: 'Adubo', emoji: '🧪', category: 'agricultura', searchQueries: ['adubo em libras', 'sinal adubo libras'] },
  { id: 'agr_fertilizante', word: 'Fertilizante', emoji: '🧪', category: 'agricultura', searchQueries: ['fertilizante em libras', 'sinal fertilizante libras'] },
  { id: 'agr_calcario', word: 'Calcário', emoji: '🪨', category: 'agricultura', searchQueries: ['calcário em libras', 'sinal calcário libras'] },
  { id: 'agr_gessagem', word: 'Gessagem', emoji: '🪨', category: 'agricultura', searchQueries: ['gessagem em libras', 'sinal gessagem libras'] },
  { id: 'agr_irrigacao', word: 'Irrigação', emoji: '💧', category: 'agricultura', searchQueries: ['irrigação em libras', 'sinal irrigação libras'] },
  { id: 'agr_praga', word: 'Praga', emoji: '🐛', category: 'agricultura', searchQueries: ['praga em libras', 'sinal praga libras'] },
  { id: 'agr_doenca_planta', word: 'Doença', emoji: '🦠', category: 'agricultura', searchQueries: ['doença de planta em libras', 'sinal doença libras'] },
  { id: 'agr_herbicida', word: 'Herbicida', emoji: '🧪', category: 'agricultura', searchQueries: ['herbicida em libras', 'sinal herbicida libras'] },
  { id: 'agr_inseticida', word: 'Inseticida', emoji: '🧪', category: 'agricultura', searchQueries: ['inseticida em libras', 'sinal inseticida libras'] },
  { id: 'agr_colheita', word: 'Colheita', emoji: '🌾', category: 'agricultura', searchQueries: ['colheita em libras', 'sinal colheita libras'] },
  { id: 'agr_produtividade', word: 'Produtividade', emoji: '📊', category: 'agricultura', searchQueries: ['produtividade em libras', 'sinal produtividade libras'] },
];

// ─── ÁREA: Pecuária ───
const PALAVRAS_PECUARIA: LibrasWord[] = [
  { id: 'pec_gado', word: 'Gado', emoji: '🐄', category: 'pecuaria', searchQueries: ['gado em libras', 'sinal gado libras'] },
  { id: 'pec_bovino', word: 'Bovino', emoji: '🐂', category: 'pecuaria', searchQueries: ['bovino em libras', 'sinal bovino libras'] },
  { id: 'pec_boi', word: 'Boi', emoji: '🐂', category: 'pecuaria', searchQueries: ['boi em libras', 'sinal boi libras'] },
  { id: 'pec_vaca', word: 'Vaca', emoji: '🐄', category: 'pecuaria', searchQueries: ['vaca em libras', 'sinal vaca libras'] },
  { id: 'pec_bezerro', word: 'Bezerro', emoji: '🐮', category: 'pecuaria', searchQueries: ['bezerro em libras', 'sinal bezerro libras'] },
  { id: 'pec_pasto', word: 'Pasto', emoji: '🌿', category: 'pecuaria', searchQueries: ['pasto em libras', 'sinal pasto libras'] },
  { id: 'pec_racao', word: 'Ração', emoji: '🌾', category: 'pecuaria', searchQueries: ['ração em libras', 'sinal ração libras'] },
  { id: 'pec_alimentacao', word: 'Alimentação', emoji: '🍽️', category: 'pecuaria', searchQueries: ['alimentação em libras', 'sinal alimentação libras'] },
  { id: 'pec_leite', word: 'Leite', emoji: '🥛', category: 'pecuaria', searchQueries: ['leite em libras', 'sinal leite libras'] },
  { id: 'pec_carne', word: 'Carne', emoji: '🥩', category: 'pecuaria', searchQueries: ['carne em libras', 'sinal carne libras'] },
  { id: 'pec_reproducao', word: 'Reprodução', emoji: '🐄', category: 'pecuaria', searchQueries: ['reprodução animal em libras', 'sinal reprodução libras'] },
  { id: 'pec_vacinacao', word: 'Vacinação', emoji: '💉', category: 'pecuaria', searchQueries: ['vacinação em libras', 'sinal vacinação libras'] },
  { id: 'pec_manejo', word: 'Manejo', emoji: '🤝', category: 'pecuaria', searchQueries: ['manejo em libras', 'sinal manejo libras'] },
  { id: 'pec_bem_estar', word: 'Bem-estar animal', emoji: '💚', category: 'pecuaria', searchQueries: ['bem-estar animal em libras', 'sinal bem-estar animal libras'] },
];

// ─── ÁREA: Máquinas ───
const PALAVRAS_MAQUINAS: LibrasWord[] = [
  { id: 'maq_trator', word: 'Trator', emoji: '🚜', category: 'maquinas', searchQueries: ['trator em libras', 'sinal trator libras'] },
  { id: 'maq_colheitadeira', word: 'Colheitadeira', emoji: '🚜', category: 'maquinas', searchQueries: ['colheitadeira em libras', 'sinal colheitadeira libras'] },
  { id: 'maq_plantadeira', word: 'Plantadeira', emoji: '🌱', category: 'maquinas', searchQueries: ['plantadeira em libras', 'sinal plantadeira libras'] },
  { id: 'maq_pulverizador', word: 'Pulverizador', emoji: '💨', category: 'maquinas', searchQueries: ['pulverizador em libras', 'sinal pulverizador libras'] },
  { id: 'maq_arado', word: 'Arado', emoji: '🔧', category: 'maquinas', searchQueries: ['arado em libras', 'sinal arado libras'] },
  { id: 'maq_implemento', word: 'Implemento', emoji: '🔧', category: 'maquinas', searchQueries: ['implemento agrícola em libras', 'sinal implemento libras'] },
  { id: 'maq_maquina', word: 'Máquina agrícola', emoji: '⚙️', category: 'maquinas', searchQueries: ['máquina agrícola em libras', 'sinal máquina agrícola libras'] },
  { id: 'maq_manutencao', word: 'Manutenção', emoji: '🔧', category: 'maquinas', searchQueries: ['manutenção em libras', 'sinal manutenção libras'] },
  { id: 'maq_combustivel', word: 'Combustível', emoji: '⛽', category: 'maquinas', searchQueries: ['combustível em libras', 'sinal combustível libras'] },
];

// ─── ÁREA: Gestão Rural ───
const PALAVRAS_GESTAO: LibrasWord[] = [
  { id: 'ges_produtor', word: 'Produtor rural', emoji: '🧑‍🌾', category: 'gestao', searchQueries: ['produtor rural em libras', 'sinal produtor rural libras'] },
  { id: 'ges_propriedade', word: 'Propriedade rural', emoji: '🏡', category: 'gestao', searchQueries: ['propriedade rural em libras', 'sinal propriedade rural libras'] },
  { id: 'ges_custo', word: 'Custo', emoji: '💰', category: 'gestao', searchQueries: ['custo em libras', 'sinal custo libras'] },
  { id: 'ges_lucro', word: 'Lucro', emoji: '💵', category: 'gestao', searchQueries: ['lucro em libras', 'sinal lucro libras'] },
  { id: 'ges_venda', word: 'Venda', emoji: '🤝', category: 'gestao', searchQueries: ['venda em libras', 'sinal venda libras'] },
  { id: 'ges_compra', word: 'Compra', emoji: '🛒', category: 'gestao', searchQueries: ['compra em libras', 'sinal compra libras'] },
  { id: 'ges_preco', word: 'Preço', emoji: '🏷️', category: 'gestao', searchQueries: ['preço em libras', 'sinal preço libras'] },
  { id: 'ges_mercado', word: 'Mercado', emoji: '🏪', category: 'gestao', searchQueries: ['mercado em libras', 'sinal mercado libras'] },
  { id: 'ges_cooperativa', word: 'Cooperativa', emoji: '🤝', category: 'gestao', searchQueries: ['cooperativa em libras', 'sinal cooperativa libras'] },
  { id: 'ges_producao', word: 'Produção', emoji: '📦', category: 'gestao', searchQueries: ['produção em libras', 'sinal produção libras'] },
];

// ─── ÁREA: Meio Ambiente ───
const PALAVRAS_MEIO_AMBIENTE: LibrasWord[] = [
  { id: 'ma_sustentabilidade', word: 'Sustentabilidade', emoji: '♻️', category: 'meio_ambiente', searchQueries: ['sustentabilidade em libras', 'sinal sustentabilidade libras'] },
  { id: 'ma_conservacao', word: 'Conservação', emoji: '🌿', category: 'meio_ambiente', searchQueries: ['conservação em libras', 'sinal conservação libras'] },
  { id: 'ma_agua', word: 'Água', emoji: '💧', category: 'meio_ambiente', searchQueries: ['água em libras', 'sinal água libras'] },
  { id: 'ma_solo', word: 'Solo', emoji: '🪨', category: 'meio_ambiente', searchQueries: ['solo em libras', 'sinal solo libras'] },
  { id: 'ma_floresta', word: 'Floresta', emoji: '🌳', category: 'meio_ambiente', searchQueries: ['floresta em libras', 'sinal floresta libras'] },
  { id: 'ma_preservacao', word: 'Preservação', emoji: '🛡️', category: 'meio_ambiente', searchQueries: ['preservação em libras', 'sinal preservação libras'] },
  { id: 'ma_recuperacao', word: 'Recuperação', emoji: '🔄', category: 'meio_ambiente', searchQueries: ['recuperação ambiental em libras', 'sinal recuperação libras'] },
  { id: 'ma_biodiversidade', word: 'Biodiversidade', emoji: '🦋', category: 'meio_ambiente', searchQueries: ['biodiversidade em libras', 'sinal biodiversidade libras'] },
];

// ─── EXPORTED MODULES ───

export const MODULO_VOCABULARIO: LibrasModule = {
  id: 'vocabulario_basico',
  title: 'Vocabulário Básico',
  emoji: '🌱',
  description: 'Aprenda os sinais fundamentais do campo',
  type: 'vocabulary',
  words: MODULO_1_WORDS,
};

export const MODULO_FRASES: LibrasModule = {
  id: 'frases_campo',
  title: 'Frases do Campo',
  emoji: '🗣️',
  description: 'Comunique situações reais do dia a dia no agronegócio',
  type: 'phrases',
  words: [],
  phrases: MODULO_2_PHRASES,
};

export const AREAS: LibrasArea[] = [
  {
    id: 'agricultura',
    name: 'Agricultura',
    emoji: '🌱',
    modules: [
      {
        id: 'area_agricultura',
        title: 'Vocabulário de Agricultura',
        emoji: '🌱',
        description: 'Sinais relacionados ao plantio, manejo e colheita',
        type: 'area',
        words: PALAVRAS_AGRICULTURA,
      },
    ],
  },
  {
    id: 'pecuaria',
    name: 'Pecuária',
    emoji: '🐄',
    modules: [
      {
        id: 'area_pecuaria',
        title: 'Vocabulário de Pecuária',
        emoji: '🐄',
        description: 'Sinais relacionados à criação de animais',
        type: 'area',
        words: PALAVRAS_PECUARIA,
      },
    ],
  },
  {
    id: 'maquinas',
    name: 'Máquinas',
    emoji: '🚜',
    modules: [
      {
        id: 'area_maquinas',
        title: 'Vocabulário de Máquinas',
        emoji: '🚜',
        description: 'Sinais de implementos e máquinas agrícolas',
        type: 'area',
        words: PALAVRAS_MAQUINAS,
      },
    ],
  },
  {
    id: 'gestao',
    name: 'Gestão Rural',
    emoji: '💰',
    modules: [
      {
        id: 'area_gestao',
        title: 'Vocabulário de Gestão',
        emoji: '💰',
        description: 'Sinais de administração e finanças rurais',
        type: 'area',
        words: PALAVRAS_GESTAO,
      },
    ],
  },
  {
    id: 'meio_ambiente',
    name: 'Meio Ambiente',
    emoji: '🌎',
    modules: [
      {
        id: 'area_meio_ambiente',
        title: 'Vocabulário de Meio Ambiente',
        emoji: '🌎',
        description: 'Sinais de sustentabilidade e conservação',
        type: 'area',
        words: PALAVRAS_MEIO_AMBIENTE,
      },
    ],
  },
];

export const ALL_MODULES: LibrasModule[] = [
  MODULO_VOCABULARIO,
  MODULO_FRASES,
  ...AREAS.map((a) => a.modules[0]),
];
