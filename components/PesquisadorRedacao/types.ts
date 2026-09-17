import { UnderstoodSource } from '@/lib/semantic/relevanceEngine';

// ── Modo e passo da redação ──

export type RedacaoMode = 'automatico' | 'construir' | 'revisar';

export type RedacaoPasso =
  | 'tema'
  | 'pesquisa'
  | 'repertorio'
  | 'expressoes'
  | 'planejamento'
  | 'redacao'
  | 'validacao';

// ── Contexto de pesquisa ──

export interface RedacaoResearchContext {
  tema: string;
  fontes: UnderstoodSource[];
  repertorio: RepertorioItem[];
  expressoes: ExpressionGroup[];
  metadata: {
    researchedAt: string;
    reusedSources: number;
    newSources: number;
    totalSources: number;
    contextVersion: string;
    sourceSnapshot: string;
  };
}

// ── Repertório ──

export type RepertorioTipo =
  | 'conceito'
  | 'dado'
  | 'autor'
  | 'fato_historico'
  | 'exemplo'
  | 'argumento'
  | 'contraponto'
  | 'causa'
  | 'consequencia';

export interface RepertorioItem {
  id: string;
  tipo: RepertorioTipo;
  titulo: string;
  conteudo: string;
  fonteId?: string;
  fonteTitulo?: string;
  aplicacoes: string[];
  argumentosRelacionados: string[];
  confianca: number;
  verificacao: {
    status: 'verified' | 'needs_review';
    sourceId?: string;
  };
}

// ── Expressões ──

export type ExpressionCategoria =
  | 'contextualizacao'
  | 'problema'
  | 'argumento'
  | 'contraposicao'
  | 'conclusao';

export interface ExpressionGroup {
  categoria: ExpressionCategoria;
  funcao: string;
  opcoes: string[];
}

// ── Estrutura da redação ──

export interface ParagrafoRedacao {
  tipo: 'desenvolvimento';
  numero: 1 | 2 | 3;
  argumento: string;
  topicoFrasal: string;
  explicacao: string;
  repertorio: string[];
  relacaoComTema: string;
  conclusaoParcial: string;
}

export interface RedacaoEstrutura {
  introducao: {
    conteudo: string;
    tese: string;
    argumentos: string[];
  };
  desenvolvimentos: ParagrafoRedacao[];
  conclusao: {
    conteudo: string;
  };
  temTerceiroDesenvolvimento: boolean;
}

export interface RedacaoSecoes {
  introducao: string;
  desenvolvimento1: string;
  desenvolvimento2: string;
  desenvolvimento3?: string;
  conclusao: string;
}

// ── Validação ──

export type ValidacaoCategoria =
  | 'estrutura'
  | 'coerencia'
  | 'coesao'
  | 'repertorio'
  | 'fontes';

export type ValidacaoTipo = 'factual' | 'citacao' | 'estrutura' | 'coesao';

export interface ValidacaoItem {
  categoria: ValidacaoCategoria;
  tipo: ValidacaoTipo;
  status: 'ok' | 'warning' | 'error';
  trecho?: string;
  paragrafo?: number;
  inicio?: number;
  fim?: number;
  explicacao: string;
  fonteEsperada?: string;
  sugestao?: string;
}

export interface ValidacaoResult {
  itens: ValidacaoItem[];
  resumo: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };
}

// ── Metadados ──

export interface RedacaoMetadata {
  id: string;
  tema: string;
  createdAt: string;
  updatedAt: string;
  mode: RedacaoMode;
  paragraphCount: number;
  sourceCount: number;
  reusedSourceCount: number;
  validationVersion: string;
  promptVersion: string;
}

// ── Estado da UI ──

export interface RedacaoState {
  tema: string;
  modo: RedacaoMode;
  passo: RedacaoPasso;
  context: RedacaoResearchContext | null;
  estrutura: RedacaoEstrutura | null;
  redacao: string;
  redacaoSecoes: RedacaoSecoes;
  validacao: ValidacaoResult | null;
  metadata: RedacaoMetadata | null;
  isLoading: boolean;
  error: string | null;
}

// ── Ações do reducer ──

export type RedacaoAction =
  | { type: 'SET_TEMA'; payload: string }
  | { type: 'SET_MODO'; payload: RedacaoMode }
  | { type: 'SET_PASSO'; payload: RedacaoPasso }
  | { type: 'SET_CONTEXT'; payload: RedacaoResearchContext | null }
  | { type: 'SET_ESTRUTURA'; payload: RedacaoEstrutura | null }
  | { type: 'UPDATE_SECAO'; payload: { chave: keyof RedacaoSecoes; valor: string } }
  | { type: 'SET_REDACAO'; payload: string }
  | { type: 'SET_VALIDACAO'; payload: ValidacaoResult | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };
