export type QuestionDificuldade = 'basica' | 'aplicacao' | 'detalhamento';

export type QuestionOrigem = 'pesquisada' | 'gerada';

export type StatusGeral = 'dominou' | 'parcial' | 'revisar';

export type DimensaoStatus = 'correto' | 'parcial' | 'errado' | 'nao_avaliado';

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
}

export interface SessionTema {
  tema: string;
  subtema?: string;
}

export type SessionStatus = 'idle' | 'loading' | 'question' | 'evaluating' | 'feedback' | 'done' | 'error';

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
  errors: string[];
  message?: string;
}
