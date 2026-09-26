import type { ClasseGramatical } from './types';

export interface Banco {
  classe: ClasseGramatical;
  palavras: string[];
}

/**
 * Dicionário global: palavra (minúsculas) → classe gramatical.
 * Só entra aqui palavra de classe única e incontestável em qualquer contexto
 * (invariáveis e formas fixas). Palavras com ambiguidade (ex.: "que", "muito")
 * NÃO estão aqui — elas só aparecem dentro de bancos de template específico.
 */
export const DICT: Record<string, ClasseGramatical> = {
  // Artigos
  o: 'artigo',
  a: 'artigo',
  os: 'artigo',
  as: 'artigo',
  um: 'artigo',
  uma: 'artigo',
  uns: 'artigo',
  umas: 'artigo',

  // Preposições (sem contração)
  de: 'preposição',
  com: 'preposição',
  sem: 'preposição',
  sobre: 'preposição',
  sob: 'preposição',
  entre: 'preposição',
  para: 'preposição',
  por: 'preposição',
  contra: 'preposição',
  durante: 'preposição',
  até: 'preposição',
  desde: 'preposição',
  após: 'preposição',
  em: 'preposição',

  // Conjunções
  e: 'conjunção',
  mas: 'conjunção',
  ou: 'conjunção',
  nem: 'conjunção',
  porque: 'conjunção',
  pois: 'conjunção',
  quando: 'conjunção',
  enquanto: 'conjunção',
  embora: 'conjunção',
  se: 'conjunção',
  então: 'conjunção',

  // Pronomes (pessoais, demonstrativos neutros, indefinidos)
  eu: 'pronome',
  tu: 'pronome',
  ele: 'pronome',
  ela: 'pronome',
  nós: 'pronome',
  você: 'pronome',
  vocês: 'pronome',
  eles: 'pronome',
  elas: 'pronome',
  isto: 'pronome',
  isso: 'pronome',
  aquilo: 'pronome',
  alguém: 'pronome',
  ninguém: 'pronome',
  algo: 'pronome',
  tudo: 'pronome',
  mim: 'pronome',

  // Advérbios
  ontem: 'advérbio',
  hoje: 'advérbio',
  amanhã: 'advérbio',
  sempre: 'advérbio',
  nunca: 'advérbio',
  já: 'advérbio',
  ainda: 'advérbio',
  aqui: 'advérbio',
  ali: 'advérbio',
  acolá: 'advérbio',
  agora: 'advérbio',
  cedo: 'advérbio',
  tarde: 'advérbio',
  depressa: 'advérbio',
  devagar: 'advérbio',
  facilmente: 'advérbio',
  calmamente: 'advérbio',
  novamente: 'advérbio',
  diariamente: 'advérbio',
  longe: 'advérbio',

  // Interjeições
  nossa: 'interjeição',
  oxente: 'interjeição',
  eita: 'interjeição',
  ué: 'interjeição',
  vixe: 'interjeição',
  opa: 'interjeição',
  ai: 'interjeição',
  ufa: 'interjeição',
  ah: 'interjeição',

  // Verbos fixos (ser / estar / ter)
  é: 'verbo',
  está: 'verbo',
  estão: 'verbo',
  são: 'verbo',
  foi: 'verbo',
  foram: 'verbo',
  tem: 'verbo',
  tinha: 'verbo',

  // Numerais cardinais/ordinais (classe única inequívoca; "um"/"uma" já
  // estão em DICT como artigo)
  dois: 'numeral',
  três: 'numeral',
  quatro: 'numeral',
  cinco: 'numeral',
  seis: 'numeral',
  sete: 'numeral',
  oito: 'numeral',
  nove: 'numeral',
  dez: 'numeral',
  primeiro: 'numeral',
  segunda: 'numeral',
};

export const BANCOS: Record<string, Banco> = {
  // ── Substantivos ──
  S_M_ANIM: { classe: 'substantivo', palavras: ['gato', 'cachorro', 'menino', 'pássaro', 'sapo', 'cavalo', 'aluno', 'lobo'] },
  S_F_ANIM: { classe: 'substantivo', palavras: ['menina', 'professora', 'aluna', 'borboleta', 'vaca', 'ovelha', 'gaivota', 'cadela'] },
  S_M_P_ANIM: { classe: 'substantivo', palavras: ['meninos', 'gatos', 'pássaros', 'cavalos', 'alunos', 'cachorros'] },
  S_F_P_ANIM: { classe: 'substantivo', palavras: ['meninas', 'professoras', 'borboletas', 'vacas', 'alunas', 'ovelhas'] },
  S_M_OBJ: { classe: 'substantivo', palavras: ['livro', 'carro', 'relógio', 'lápis', 'brinquedo', 'sapato', 'copo', 'quadro'] },
  S_F_OBJ: { classe: 'substantivo', palavras: ['casa', 'escola', 'mesa', 'cadeira', 'janela', 'rua', 'toalha', 'colher'] },
  S_M_P_OBJ: { classe: 'substantivo', palavras: ['livros', 'carros', 'relógios', 'sapatos', 'quadros', 'copos', 'brinquedos'] },
  S_F_P_OBJ: { classe: 'substantivo', palavras: ['casas', 'mesas', 'cadeiras', 'ruas', 'janelas', 'colheres', 'toalhas'] },
  S_F_INAN: { classe: 'substantivo', palavras: ['casa', 'escola', 'cidade', 'mesa', 'cadeira', 'janela', 'floresta', 'praia'] },
  S_F_EVENTO: { classe: 'substantivo', palavras: ['festa', 'aula', 'reunião', 'viagem', 'partida', 'prova', 'mostra'] },
  S_M_ABST: { classe: 'substantivo', palavras: ['problema', 'medo', 'sonho', 'sucesso', 'acidente', 'remédio', 'esforço', 'orgulho'] },
  S_F_ABST: { classe: 'substantivo', palavras: ['ideia', 'história', 'semana', 'noite', 'manhã', 'culpa', 'alegria', 'raiva'] },

  // ── Verbos (presente) ──
  V_3S_MOVE: { classe: 'verbo', palavras: ['corre', 'brinca', 'pula', 'esconde'] },
  V_3S_PRES: { classe: 'verbo', palavras: ['dorme', 'canta', 'estuda', 'aprende', 'escreve', 'espera', 'chora', 'viaja', 'ri', 'caminha', 'trabalha', 'joga'] },
  V_3S_REST: { classe: 'verbo', palavras: ['dorme', 'espera', 'sorri', 'descansa', 'ri'] },
  V_1S_COM: { classe: 'verbo', palavras: ['estudo', 'aprendo', 'escrevo', 'espero', 'trabalho', 'canto', 'ouço', 'falo'] },
  V_1P: { classe: 'verbo', palavras: ['estudamos', 'aprendemos', 'escrevemos', 'esperamos', 'vimos', 'falamos', 'cantamos', 'viajamos'] },
  V_3P: { classe: 'verbo', palavras: ['dormem', 'correm', 'cantam', 'pulam', 'brincam', 'estudam', 'aprendem', 'chegam', 'viajam', 'esperam'] },
  V_3S_COISA: { classe: 'verbo', palavras: ['começa', 'termina', 'muda', 'cresce', 'aumenta', 'melhora'] },
  V_3S_EVENTO_PRES: { classe: 'verbo', palavras: ['começa', 'termina', 'atrasa', 'muda', 'adianta', 'acontece'] },
  V_3S_EVENTO: { classe: 'verbo', palavras: ['terminou', 'começou', 'atrasou', 'parou', 'adiantou', 'aconteceu'] },
  V_3S_ABST: { classe: 'verbo', palavras: ['acabou', 'terminou', 'apareceu', 'aumentou', 'mudou', 'surgiu', 'melhorou'] },

  // ── Verbos (pretérito perfeito) ──
  V_3S_CHEGOU: { classe: 'verbo', palavras: ['chegou', 'cantou', 'chorou', 'sorriu', 'correu', 'brincou', 'estudou', 'viajou'] },
  V_3S_PAS: { classe: 'verbo', palavras: ['chegou', 'correu', 'cantou', 'abriu', 'viu', 'estudou', 'escreveu', 'ganhou', 'chorou', 'falou', 'viajou', 'sorriu', 'olhou', 'leu', 'disse', 'fez'] },
  V_3S_STATE: { classe: 'verbo', palavras: ['chegou', 'chorou', 'riu', 'dormiu', 'sorriu', 'viajou', 'descansou', 'brincou'] },
  V_3S_PAS_EMOT: { classe: 'verbo', palavras: ['chorou', 'riu', 'sorriu', 'gritou', 'reclamou'] },
  V_COMP: { classe: 'verbo', palavras: ['falou', 'estudou', 'brincou', 'trabalhou', 'viajou', 'conversou', 'olhou', 'jogou'] },
  V_3S_VER: { classe: 'verbo', palavras: ['viu', 'fez', 'disse', 'trouxe', 'leu'] },
  V_3S_TRAGA: { classe: 'verbo', palavras: ['trouxe', 'levou', 'escondeu', 'escolheu', 'carregou'] },
  V_3S_INTRA: { classe: 'verbo', palavras: ['chegou', 'chorou', 'riu', 'dormiu', 'sorriu', 'correu', 'pulou', 'cantou', 'brincou', 'descansou'] },

  // ── Adjetivos (por gênero/número) ──
  A_M_S: { classe: 'adjetivo', palavras: ['alto', 'grande', 'pequeno', 'forte', 'feliz', 'triste', 'alegre', 'magro', 'novo', 'bonito', 'calmo'] },
  A_F_S_FIS: { classe: 'adjetivo', palavras: ['bonita', 'nova', 'alta', 'limpa', 'escura', 'clara', 'quente', 'fria', 'grande', 'pequena', 'velha'] },
  A_F_S_ABST: { classe: 'adjetivo', palavras: ['clara', 'confusa', 'importante', 'interessante', 'difícil', 'fácil', 'pronta', 'tranquila', 'simples'] },
  A_M_S_ABST: { classe: 'adjetivo', palavras: ['grave', 'sério', 'urgente', 'complicado', 'importante', 'difícil', 'fácil', 'certo', 'errado'] },
  A_M_P: { classe: 'adjetivo', palavras: ['altos', 'grandes', 'pequenos', 'fortes', 'felizes', 'tristes', 'alegres', 'novos', 'bonitos', 'calmos', 'magros'] },
  A_F_P: { classe: 'adjetivo', palavras: ['altas', 'grandes', 'pequenas', 'fortes', 'felizes', 'tristes', 'alegres', 'novas', 'bonitas', 'limpas', 'claras'] },

  // ── Advérbios ──
  ADV_TEMPO: { classe: 'advérbio', palavras: ['ontem', 'hoje', 'amanhã', 'sempre', 'nunca', 'já', 'ainda', 'agora', 'cedo', 'tarde'] },
  ADV_LUG: { classe: 'advérbio', palavras: ['aqui', 'ali', 'acolá', 'longe'] },
  ADV_MODO: { classe: 'advérbio', palavras: ['depressa', 'devagar', 'facilmente', 'calmamente', 'novamente', 'diariamente'] },

  // ── Interjeições ──
  INT: { classe: 'interjeição', palavras: ['Nossa', 'Oxente', 'Eita', 'Ué', 'Vixe', 'Opa', 'Ai', 'Ufa'] },

  // ── Conjunções (contextuais) ──
  C_CAUSAL: { classe: 'conjunção', palavras: ['porque', 'pois'] },
  C_COND: { classe: 'conjunção', palavras: ['se', 'quando'] },
  C_CONTRAST: { classe: 'conjunção', palavras: ['mas', 'então'] },
  C_COORD: { classe: 'conjunção', palavras: ['e', 'ou'] },

  // ── Pronomes (variáveis) ──
  PRON_DEMO: { classe: 'pronome', palavras: ['isso', 'isto', 'aquilo'] },
};
