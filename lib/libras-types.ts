export interface LibrasVideoResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

export interface LibrasSearchResponse {
  results: LibrasVideoResult[];
  totalFound: number;
  query: string;
}

export type LibrasCategory =
  | 'agricultura'
  | 'pecuaria'
  | 'maquinas'
  | 'gestao'
  | 'meio_ambiente';

export interface LibrasWord {
  id: string;
  word: string;
  emoji: string;
  category: LibrasCategory;
  searchQueries: string[];
}

export interface LibrasPhrase {
  id: string;
  phrase: string;
  breakdown: string[];
  category: string;
}

export interface LibrasModule {
  id: string;
  title: string;
  emoji: string;
  description: string;
  type: 'vocabulary' | 'phrases' | 'area';
  words: LibrasWord[];
  phrases?: LibrasPhrase[];
}

export interface LibrasArea {
  id: string;
  name: string;
  emoji: string;
  modules: LibrasModule[];
}

export interface LibrasProgressRecord {
  id: string;
  user_id: string;
  word_id: string;
  learned: boolean;
  quiz_score: number;
  module_id: string;
  created_at: string;
  updated_at: string;
}

export interface LibrasModuleProgress {
  moduleId: string;
  totalWords: number;
  learnedWords: number;
  quizScore: number;
  completed: boolean;
}

export interface LibrasQuizQuestion {
  wordId: string;
  word: string;
  options: LibrasVideoResult[];
  correctIndex: number;
}
