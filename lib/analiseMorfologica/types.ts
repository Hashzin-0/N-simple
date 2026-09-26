export type ClasseGramatical =
  | 'substantivo'
  | 'verbo'
  | 'adjetivo'
  | 'advérbio'
  | 'artigo'
  | 'numeral'
  | 'preposição'
  | 'conjunção'
  | 'pronome'
  | 'interjeição';

export interface ClasseInfo {
  id: ClasseGramatical;
  label: string;
  dica: string;
  cor: string;
  corDark: string;
}

export const CLASSES: ClasseInfo[] = [
  {
    id: 'substantivo',
    label: 'Substantivo',
    dica: 'Nome de pessoa, lugar, coisa ou ideia.',
    cor: '#2E6F40',
    corDark: '#86efac',
  },
  {
    id: 'verbo',
    label: 'Verbo',
    dica: 'Indica ação ou estado (conjugado).',
    cor: '#8D6E63',
    corDark: '#CBB5A1',
  },
  {
    id: 'adjetivo',
    label: 'Adjetivo',
    dica: 'Qualifica o substantivo.',
    cor: '#D4A373',
    corDark: '#E0A96D',
  },
  {
    id: 'advérbio',
    label: 'Advérbio',
    dica: 'Modifica verbo, adjetivo ou outro advérbio.',
    cor: '#4A6FA5',
    corDark: '#93B7D8',
  },
  {
    id: 'artigo',
    label: 'Artigo',
    dica: 'Determina o substantivo (o, a, um, uma...).',
    cor: '#5A5A40',
    corDark: '#9CB386',
  },
  {
    id: 'numeral',
    label: 'Numeral',
    dica: 'Indica quantidade ou ordem (um, dois, três, primeiro...).',
    cor: '#5B5BD6',
    corDark: '#A5B4FC',
  },
  {
    id: 'preposição',
    label: 'Preposição',
    dica: 'Liga palavras ou orações (de, em, com, para...).',
    cor: '#6B5B95',
    corDark: '#B3A5E0',
  },
  {
    id: 'conjunção',
    label: 'Conjunção',
    dica: 'Liga palavras ou orações (e, mas, porque...).',
    cor: '#A85A3C',
    corDark: '#E09B7B',
  },
  {
    id: 'pronome',
    label: 'Pronome',
    dica: 'Substitui ou acompanha o substantivo (eu, ele, isso...).',
    cor: '#3E7C74',
    corDark: '#8FCFC4',
  },
  {
    id: 'interjeição',
    label: 'Interjeição',
    dica: 'Expressa emoção ou reação (Nossa!, Ufa!).',
    cor: '#B5484D',
    corDark: '#F0929A',
  },
];

export const CLASSE_MAP: Record<ClasseGramatical, ClasseInfo> = CLASSES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<ClasseGramatical, ClasseInfo>
);

export interface Token {
  palavra: string;
  classe?: ClasseGramatical;
  pontuacao?: boolean;
  /**
   * Tokens consecutivos com o mesmo `grupo` são renderizados num único bloco
   * (ex.: contração "às" = preposição "a" + artigo "as"). Cada parte continua
   * clicável e corrigida separadamente.
   */
  grupo?: string;
  /** Forma original escrita no texto (ex.: "às") — só exibição/título. */
  grupoLabel?: string;
}

export interface Frase {
  id: string;
  tokens: Token[];
  origem: 'local' | 'ia' | 'prova';
}

export interface ProgressoAnalise {
  acertos: number;
  erros: number;
  frasesResolvidas: number;
  sequenciaAtual: number;
  melhorSequencia: number;
}

export const PROGRESSO_INICIAL: ProgressoAnalise = {
  acertos: 0,
  erros: 0,
  frasesResolvidas: 0,
  sequenciaAtual: 0,
  melhorSequencia: 0,
};
