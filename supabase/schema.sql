-- ============================================================
-- SCHEMA: Memória Reutilizável de Evidências (Evidence Memory)
-- ============================================================
-- Execute este SQL no painel do Supabase > SQL Editor > New Query
-- ============================================================

-- Tabela principal: fontes conhecidas (Source Cache)
CREATE TABLE IF NOT EXISTS sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key      TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  authors         TEXT,
  year            INTEGER,
  publication     TEXT,
  source_name     TEXT,
  source_type     TEXT,
  abstract        TEXT,
  keywords        TEXT[] DEFAULT '{}',
  direct_url      TEXT,
  search_url      TEXT,
  doi             TEXT,
  abnt_citation   TEXT,
  vantagens       TEXT[] DEFAULT '{}',
  desvantagens    TEXT[] DEFAULT '{}',
  caracteristicas TEXT[] DEFAULT '{}',
  full_text_tsvector TSVECTOR,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_verified   TIMESTAMPTZ DEFAULT now(),
  reuse_count     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sources_key ON sources(source_key);
CREATE INDEX IF NOT EXISTS idx_sources_fts ON sources USING GIN(full_text_tsvector);
CREATE INDEX IF NOT EXISTS idx_sources_doi ON sources(doi) WHERE doi IS NOT NULL;

-- Tabela de evidências por tópico (Evidence Index)
CREATE TABLE IF NOT EXISTS source_topics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           UUID REFERENCES sources(id) ON DELETE CASCADE,
  topic               TEXT NOT NULL,
  topic_normalized    TEXT NOT NULL,
  evidence_strength   FLOAT DEFAULT 0.0,
  has_evidence        BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, topic_normalized)
);

CREATE INDEX IF NOT EXISTS idx_source_topics_lookup ON source_topics(topic_normalized, evidence_strength DESC);
CREATE INDEX IF NOT EXISTS idx_source_topics_source ON source_topics(source_id);
CREATE INDEX IF NOT EXISTS idx_source_topics_strength ON source_topics(has_evidence, evidence_strength DESC);

-- Tabela de log de pesquisas
CREATE TABLE IF NOT EXISTS search_queries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text        TEXT NOT NULL,
  query_normalized  TEXT NOT NULL,
  topics            TEXT[] DEFAULT '{}',
  sources_found     INTEGER DEFAULT 0,
  decision          TEXT,
  coverage_score    FLOAT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queries_text ON search_queries(query_normalized);
CREATE INDEX IF NOT EXISTS idx_queries_date ON search_queries(created_at DESC);

-- Função trigger: atualiza full_text_tsvector automaticamente
CREATE OR REPLACE FUNCTION update_sources_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_text_tsvector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.abstract, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.vantagens, ' '), '') || ' ' || COALESCE(array_to_string(NEW.desvantagens, ' '), '') || ' ' || COALESCE(array_to_string(NEW.caracteristicas, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sources_fts
  BEFORE INSERT OR UPDATE OF title, keywords, abstract, vantagens, desvantagens, caracteristicas
  ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_sources_fts();

-- Função: busca full-text com ranking
CREATE OR REPLACE FUNCTION search_sources_fts(
  search_query TEXT,
  max_results INTEGER DEFAULT 30
)
RETURNS TABLE (
  source_id UUID,
  title TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    ts_rank_cd(s.full_text_tsvector, plainto_tsquery('portuguese', search_query))::REAL AS rank
  FROM sources s
  WHERE s.full_text_tsvector @@ plainto_tsquery('portuguese', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (Row Level Security) - necessário para Supabase
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso total para service role (server-side only)
-- O client Supabase usa publishable key (anon), mas estas tabelas
-- só devem ser acessadas via server-side API routes com service role
CREATE POLICY "Allow all for service role" ON sources FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON source_topics FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON search_queries FOR ALL USING (true);

-- Alternativa mais restritiva (descomente se preferir):
-- CREATE POLICY "Deny anon access" ON sources FOR ALL USING (false);
-- CREATE POLICY "Deny anon access" ON source_topics FOR ALL USING (false);
-- CREATE POLICY "Deny anon access" ON search_queries FOR ALL USING (false);
