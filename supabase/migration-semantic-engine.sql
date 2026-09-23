-- ============================================================
-- MIGRATION: Motor Semântico — embeddings, chunks, categorias
-- ============================================================
-- Execute APÓS schema.sql (baseline já aplicado no Supabase).
-- NÃO substitui schema.sql: este arquivo só ADICIONA o que faltava
-- para o código do motor semântico (lib/semantic/**, lib/evidenceIndex,
-- lib/reuseDecision) funcionar.
--
-- Idempotente: pode ser reexecutado sem erro (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- Requer extensão pgvector (CREATE EXTENSION IF NOT EXISTS vector).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. Colunas novas em sources (já existente pelo baseline) ──
-- Vetor centróide do documento (Gemini Embedding 2, 768 dims) +
-- metadados do score semântico gravados por lib/evidenceIndex.ts.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS semantic_score FLOAT DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS used_full_text BOOLEAN DEFAULT false;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS best_excerpt TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS domain_score FLOAT DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS in_agro_domain BOOLEAN DEFAULT false;

-- Índice vetorial para match_sources_by_embedding.
-- ivfflat precisa de amostras: só crie DEPOIS de haver linhas com embedding.
-- Descomente quando o volume justificar:
-- CREATE INDEX IF NOT EXISTS idx_sources_embedding ON sources
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── 2. Chunks de texto completo com embedding por chunk ──
-- Escrito por evidenceIndex.indexSource (delete+insert a cada index).
CREATE TABLE IF NOT EXISTS source_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID REFERENCES sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT NOT NULL,
  embedding   vector(768),
  chunk_tsv   TSVECTOR,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_chunks_source ON source_chunks(source_id);

-- FTS de chunks (trigger abaixo)
CREATE OR REPLACE FUNCTION update_chunks_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.chunk_tsv := to_tsvector('portuguese', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_fts ON source_chunks;
CREATE TRIGGER trg_chunks_fts
  BEFORE INSERT OR UPDATE OF chunk_text
  ON source_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_chunks_fts();

-- ── 3. Categorias semânticas (índice de assunto) ──
CREATE TABLE IF NOT EXISTS source_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  UUID REFERENCES sources(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  score      FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_categories_source ON source_categories(source_id);

-- ── 4. RPC de busca vetorial (usada por lib/reuseDecision.ts) ──
-- Sem esta função, findSourcesByVector falha silenciosamente no catch
-- e a memória de reuso fica só com match textual de tópico.
CREATE OR REPLACE FUNCTION match_sources_by_embedding(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.45,
  match_count INTEGER DEFAULT 15
)
RETURNS TABLE (
  source_id UUID,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id AS source_id,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM sources s
  WHERE s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) >= match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── 5. RLS + policies das tabelas novas ──
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON source_chunks;
CREATE POLICY "Allow all for service role" ON source_chunks FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for service role" ON source_categories;
CREATE POLICY "Allow all for service role" ON source_categories FOR ALL USING (true);

-- (sources / source_topics / search_queries já têm RLS+policy no baseline)

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'sources' AND column_name = 'embedding';
--   SELECT proname FROM pg_proc WHERE proname = 'match_sources_by_embedding';
-- ============================================================
