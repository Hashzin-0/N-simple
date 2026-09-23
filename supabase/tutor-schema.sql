-- ============================================================
-- SCHEMA: Tutor Inteligente — Revisão Oral
-- ============================================================
-- Execute este SQL no painel do Supabase > SQL Editor > New Query
-- Requer extensão pgvector (a maioria dos projetos já a tem).
-- Compatível com schema.sql (não altera tabelas existentes).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Banco de questões (pesquisadas em fontes ou geradas) ──
CREATE TABLE IF NOT EXISTS questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_dedup    TEXT UNIQUE NOT NULL,
  enunciado     TEXT NOT NULL,
  alternativas  JSONB,
  gabarito      TEXT,
  explicacao     TEXT,
  assunto       TEXT NOT NULL,
  subassunto    TEXT,
  disciplina    TEXT,
  instituicao   TEXT,
  ano           INTEGER,
  tipo_prova    TEXT,
  fonte         TEXT,
  fonte_url     TEXT,
  origem        TEXT NOT NULL DEFAULT 'pesquisada'
                CHECK (origem IN ('pesquisada', 'gerada')),
  dificuldade   TEXT NOT NULL DEFAULT 'basica'
                CHECK (dificuldade IN ('basica', 'aplicacao', 'detalhamento')),
  embedding     VECTOR(768),
  enunciado_fts TSVECTOR,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_seen     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_embedding ON questions
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_questions_fts ON questions USING GIN(enunciado_fts);
CREATE INDEX IF NOT EXISTS idx_questions_assunto ON questions(assunto, subassunto);
CREATE INDEX IF NOT EXISTS idx_questions_dificuldade ON questions(dificuldade);
CREATE INDEX IF NOT EXISTS idx_questions_origem ON questions(origem);

-- Trigger: mantém enunciado_fts sincronizado
CREATE OR REPLACE FUNCTION update_questions_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.enunciado_fts :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.enunciado, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.assunto, '') || ' ' || COALESCE(NEW.subassunto, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.explicacao, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_questions_fts ON questions;
CREATE TRIGGER trg_questions_fts
  BEFORE INSERT OR UPDATE OF enunciado, assunto, subassunto, explicacao
  ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_questions_fts();

-- ── Tópicos por questão (índice de reuso) ──
CREATE TABLE IF NOT EXISTS question_topics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       UUID REFERENCES questions(id) ON DELETE CASCADE,
  topic             TEXT NOT NULL,
  topic_normalized  TEXT NOT NULL,
  evidence_strength FLOAT DEFAULT 0.0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, topic_normalized)
);

CREATE INDEX IF NOT EXISTS idx_question_topics_lookup
  ON question_topics(topic_normalized, evidence_strength DESC);
CREATE INDEX IF NOT EXISTS idx_question_topics_question
  ON question_topics(question_id);

-- ── Tentativas do aluno (avaliação por resposta) ──
CREATE TABLE IF NOT EXISTS tutor_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  question_id   UUID REFERENCES questions(id) ON DELETE SET NULL,
  assunto       TEXT,
  subassunto    TEXT,
  topic         TEXT,
  answer_text   TEXT NOT NULL,
  evaluation    JSONB NOT NULL,
  status_geral  TEXT NOT NULL CHECK (status_geral IN ('dominou', 'parcial', 'revisar')),
  dificuldade   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_attempts_user ON tutor_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_attempts_status ON tutor_attempts(user_id, status_geral);
CREATE INDEX IF NOT EXISTS idx_tutor_attempts_topic ON tutor_attempts(topic);

-- ── Progresso agregado do aluno por tópico ──
CREATE TABLE IF NOT EXISTS user_progress (
  user_id            TEXT NOT NULL,
  topic              TEXT NOT NULL,
  attempts           INTEGER DEFAULT 0,
  strengths          TEXT[] DEFAULT '{}',
  weaknesses         TEXT[] DEFAULT '{}',
  mastery_estimate   FLOAT DEFAULT 0.0,
  last_review        TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);

-- ── RPC: busca vetorial de questões com exclusão de já perguntadas ──
CREATE OR REPLACE FUNCTION match_questions_by_embedding(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.35,
  match_count INTEGER DEFAULT 10,
  exclude_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  enunciado TEXT,
  alternativas JSONB,
  gabarito TEXT,
  explicacao TEXT,
  assunto TEXT,
  subassunto TEXT,
  disciplina TEXT,
  instituicao TEXT,
  ano INTEGER,
  tipo_prova TEXT,
  fonte TEXT,
  fonte_url TEXT,
  origem TEXT,
  dificuldade TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.enunciado,
    q.alternativas,
    q.gabarito,
    q.explicacao,
    q.assunto,
    q.subassunto,
    q.disciplina,
    q.instituicao,
    q.ano,
    q.tipo_prova,
    q.fonte,
    q.fonte_url,
    q.origem,
    q.dificuldade,
    (1 - (q.embedding <=> query_embedding))::FLOAT AS similarity
  FROM questions q
  WHERE q.embedding IS NOT NULL
    AND (1 - (q.embedding <=> query_embedding)) >= match_threshold
    AND (exclude_ids IS NULL OR NOT (q.id = ANY(exclude_ids)))
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ── RPC: busca por tópico (fallback sem embedding) ──
CREATE OR REPLACE FUNCTION search_questions_by_topic(
  search_topic TEXT,
  match_count INTEGER DEFAULT 10,
  exclude_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  enunciado TEXT,
  alternativas JSONB,
  gabarito TEXT,
  explicacao TEXT,
  assunto TEXT,
  subassunto TEXT,
  disciplina TEXT,
  instituicao TEXT,
  ano INTEGER,
  tipo_prova TEXT,
  fonte TEXT,
  fonte_url TEXT,
  origem TEXT,
  dificuldade TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id, q.enunciado, q.alternativas, q.gabarito, q.explicacao,
    q.assunto, q.subassunto, q.disciplina, q.instituicao, q.ano,
    q.tipo_prova, q.fonte, q.fonte_url, q.origem, q.dificuldade
  FROM questions q
  WHERE (
      q.assunto ILIKE '%' || search_topic || '%'
      OR q.subassunto ILIKE '%' || search_topic || '%'
      OR EXISTS (
        SELECT 1 FROM question_topics qt
        WHERE qt.question_id = q.id AND qt.topic_normalized ILIKE '%' || search_topic || '%'
      )
    )
    AND (exclude_ids IS NULL OR NOT (q.id = ANY(exclude_ids)))
  ORDER BY q.created_at DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ── RLS ──
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON questions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON question_topics FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON tutor_attempts FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON user_progress FOR ALL USING (true);
