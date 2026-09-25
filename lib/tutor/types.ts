export type QuestionDificuldade = 'basica' | 'aplicacao' | 'detalhamento';

export type QuestionOrigem = 'pesquisada' | 'gerada' | 'artigo' | 'documento';

export type StatusGeral = 'dominou' | 'parcial' | 'revisar';

export type DimensaoStatus = 'correto' | 'parcial' | 'errado' | 'nao_avaliado';

export type TutorModo = 'sessao' | 'socratico' | 'revisar_erros' | 'rapida' | 'conversar';

export const TUTOR_MODOS: TutorModo[] = ['sessao', 'socratico', 'revisar_erros', 'rapida', 'conversar'];

export const TUTOR_META_POR_MODO: Record<TutorModo, number | null> = {
  sessao: 8,
  socratico: 8,
  revisar_erros: 8,
  rapida: 3,
  conversar: null,
};

export interface SocraticState {
  tentativa: number;
  hintsUsed: number;
  revealed: boolean;
}

export interface TutorQuestion {
  id: string;
  enunciado: string;
  alternativas?: Record<string, string> | null;
  gabarito?: string | null;
  explicacao?: string | null;
  assunto: string;
  subassunto?: string | null;
  disciplina?: string | null;
  instituicao?: string | null;
  ano?: number | null;
  tipo_prova?: string | null;
  fonte?: string | null;
  fonte_url?: string | null;
  origem: QuestionOrigem;
  dificuldade: QuestionDificuldade;
  similarity?: number;
}

export interface DimensaoAvaliacao {
  status: DimensaoStatus;
  comentario: string;
}

export interface FormulacaoAvaliacao {
  antes: string;
  depois: string;
  dica: string;
}

export interface AvaliacaoResultado {
  statusGeral: StatusGeral;
  dimensoes: {
    conteudo: DimensaoAvaliacao;
    completude: DimensaoAvaliacao;
    coerencia: DimensaoAvaliacao;
    formulacao: FormulacaoAvaliacao;
  };
  conceitosCorretos: string[];
  omissoes: string[];
  errosConceituais: string[];
  feedbackOral: string;
  pista?: string | null;
}

export interface SessionTema {
  tema: string;
  subtema?: string;
}

export type SessionStatus =
  | 'idle'
  | 'loading'
  | 'question'
  | 'evaluating'
  | 'feedback'
  | 'done'
  | 'error'
  | 'conversando';

export interface SessionAnswerRecord {
  questionId: string;
  dificuldade: QuestionDificuldade;
  answerText: string;
  avaliacao: AvaliacaoResultado;
  topic: string;
}

export interface TutorSessionState {
  status: SessionStatus;
  tema: SessionTema | null;
  currentQuestion: TutorQuestion | null;
  askedIds: string[];
  history: SessionAnswerRecord[];
  contextFontes: string;
  errorMessage: string | null;
  meta: number;
  modo: TutorModo;
  socratic: SocraticState;
}

export interface TutorProgressEntry {
  topic: string;
  attempts: number;
  strengths: string[];
  weaknesses: string[];
  masteryEstimate: number;
  lastReview: string;
}

export interface TutorAttemptPayload {
  userId: string;
  questionId?: string | null;
  assunto?: string | null;
  subassunto?: string | null;
  topic: string;
  answerText: string;
  evaluation: AvaliacaoResultado;
  dificuldade?: QuestionDificuldade;
  modo?: TutorModo;
}

export interface ResearchQuestionsRequest {
  tema: string;
  subtema?: string;
  maxSources?: number;
}

export interface ResearchQuestionsResponse {
  ok: boolean;
  decision: 'reuse' | 'new_search' | 'unavailable';
  questions: TutorQuestion[];
  reusedCount: number;
  researchedCount: number;
  generatedCount: number;
  artigoCount?: number;
  documentoCount?: number;
  errors: string[];
  message?: string;
}

export interface TutorErrorAttempt {
  id: string;
  questionId: string | null;
  assunto: string | null;
  subassunto: string | null;
  topic: string | null;
  answerText: string;
  statusGeral: StatusGeral;
  dificuldade: QuestionDificuldade | null;
  createdAt: string;
}

export interface TutorErrorsResponse {
  ok: boolean;
  attempts: TutorErrorAttempt[];
  questions: TutorQuestion[];
  source: 'supabase' | 'empty' | 'supabase_unavailable' | 'error';
  message?: string;
}
