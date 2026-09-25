-- ============================================================
-- MIGRATION: Tutor — Documentos enviados (PDF) + Revisão
-- Idempotente. Seguro de re-executar.
-- Requer tutor-schema.sql + migration-tutor-plano2.sql aplicados.
-- ============================================================

-- 1) questions.origem: incluir 'documento' (questões extraídas do material do aluno)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_origem_check;
ALTER TABLE questions
  ADD CONSTRAINT questions_origem_check
  CHECK (origem IN ('pesquisada', 'gerada', 'artigo', 'documento'));

-- ── 2. Documentos enviados pelo aluno ──
CREATE TABLE IF NOT EXISTS tutor_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT,
  name         TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INTEGER DEFAULT 0,
  pages        INTEGER,
  char_count   INTEGER DEFAULT 0,
  file_uri     TEXT,
  file_name    TEXT,
  digest       JSONB,
  status       TEXT NOT NULL DEFAULT 'processing'
               CHECK (status IN ('processing', 'ready', 'failed')),
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_documents_user
  ON tutor_documents(user_id, created_at DESC);

-- ── 3. Chunks do documento (busca semântica com pgvector) ──
CREATE TABLE IF NOT EXISTS tutor_document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES tutor_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text        TEXT NOT NULL,
  embedding   VECTOR(768),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_document_chunks_doc
  ON tutor_document_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_tutor_document_chunks_embedding
  ON tutor_document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── 4. RPC: busca vetorial de trechos do(s) documento(s) ──
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.30,
  match_count INTEGER DEFAULT 6,
  document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  text TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.chunk_index,
    c.text,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
  FROM tutor_document_chunks c
  WHERE c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    AND (document_ids IS NULL OR c.document_id = ANY(document_ids))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ── 5. Flashcards com repetição espaçada ──
CREATE TABLE IF NOT EXISTS tutor_flashcards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  topic       TEXT NOT NULL,
  document_id UUID REFERENCES tutor_documents(id) ON DELETE SET NULL,
  front       TEXT NOT NULL,
  back        TEXT NOT NULL,
  ease        FLOAT NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  reps        INTEGER NOT NULL DEFAULT 0,
  due_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_review TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_flashcards_due
  ON tutor_flashcards(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tutor_flashcards_topic
  ON tutor_flashcards(user_id, topic);

-- ── 6. Artefatos de revisão gerados (simulado, seminário, mapa mental…) ──
CREATE TABLE IF NOT EXISTS review_artifacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT,
  kind       TEXT NOT NULL
             CHECK (kind IN ('simulado', 'quiz', 'mapa_mental', 'seminario', 'resumo', 'plano')),
  topic      TEXT,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_artifacts_user
  ON review_artifacts(user_id, kind, created_at DESC);

-- ── 7. RLS (padrão permissivo do projeto: publishable key, sem JWT) ──
ALTER TABLE tutor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON tutor_documents;
DROP POLICY IF EXISTS "Allow all for service role" ON tutor_document_chunks;
DROP POLICY IF EXISTS "Allow all for service role" ON tutor_flashcards;
DROP POLICY IF EXISTS "Allow all for service role" ON review_artifacts;

CREATE POLICY "Allow all for service role" ON tutor_documents
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON tutor_document_chunks
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON tutor_flashcards
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON review_artifacts
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- VERIFICAÇÃO (após aplicar):
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'questions'::regclass AND conname = 'questions_origem_check';
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name IN ('tutor_documents','tutor_document_chunks',
--                       'tutor_flashcards','review_artifacts');
-- SELECT proname FROM pg_proc WHERE proname = 'match_document_chunks';
-- ============================================================
