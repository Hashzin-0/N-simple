export type SourceType = 
  | 'artigo_periodico' 
  | 'boletim_tecnico' 
  | 'ensaio_cientifico' 
  | 'tese_dissertacao' 
  | 'livro_manual'
  | 'video_tecnico';

export interface TrigonometricSimilarity {
  cosTheta: number; // 0.0 to 1.0 (Cosine similarity)
  angleDegrees: number; // Angle θ in degrees (0° = identical, 90° = orthogonal)
  percentage: number; // 0% to 100%
  alignmentQuality: 'Excepcional' | 'Muito Alta' | 'Alta' | 'Moderada';
}

export interface ScientificSource {
  id: string;
  title: string;
  authors: string;
  year: number;
  publication: string;
  sourceName: 'Google Acadêmico' | 'SciELO' | 'Embrapa' | 'CAPES' | 'FAO AGRIS' | 'BDTD' | 'Universidade' | 'YouTube';
  sourceType: SourceType;
  abstract: string;
  keywords: string[];
  directUrl?: string;
  searchUrl: string;
  doi?: string;
  abntCitation: string;
  vantagens?: string[];
  desvantagens?: string[];
  caracteristicas?: string[];
  trigonometricSimilarity?: TrigonometricSimilarity;
}

export interface ReliablePortal {
  id: string;
  name: string;
  shortName: string;
  organization: string;
  description: string;
  focusArea: string;
  badge: string;
  badgeColor: string;
  baseUrl: string;
  searchUrlTemplate: string;
  highlightedJournals?: string[];
  features: string[];
}

export interface TopicSourceReference {
  id?: string;
  citationABNT: string;
  authors: string;
  year: number;
  title: string;
  repository: string;
  contribution: string;
}

export interface ArticleTopicSection {
  number: string; // Ex: "3.1", "3.2", "3.3"
  title: string; // Ex: "3.1 Fundamentos e Características", "3.2 Vantagens e Eficiência", "3.3 Desvantagens e Riscos"
  content: string; // Parágrafos fundamentados
  fontesConsultadas: TopicSourceReference[]; // Mínimo 3, até 10 fontes por tópico
}

export interface DirectComparisonItem {
  praticaSuperadaOuTradicional: string;
  praticaContemporaneaRecomendada: string;
  parametroComparado: string;
  impactoAgroeconomico: string;
  evidenciaCientifica: string;
}

export interface ScientificArticleABNT {
  theme: string;
  title: string;
  subtitle?: string;
  titleEn: string;
  authors: Array<{
    name: string;
    titulation: string;
    affiliation: string;
    email?: string;
  }>;
  resumo: string;
  palavrasChave: string[];
  abstractEn: string;
  keywordsEn: string[];
  introducao: string;
  metodologia: string;
  topicosDesenvolvimento: ArticleTopicSection[];
  analiseComparativaDireta?: DirectComparisonItem[];
  consideracoesFinais: string;
  referenciasABNT: string[];
  generatedAt: string;
}
