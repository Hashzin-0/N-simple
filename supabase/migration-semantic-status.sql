-- ============================================================
-- MIGRATION: semantic_status + semantic_query (fase 1/2 do motor)
-- ============================================================
-- Execute APÓS schema.sql + migration-semantic-engine.sql.
--
-- Contexto (arquitetura de duas fases):
--   FASE 1 (foreground): todas as fontes dos scrapers passam pelo
--     semântico em modo light e são gravadas com semantic_status='light'.
--   FASE 2 (Inngest, 2º plano): understandOne completo (full-text +
--     cross-encoder + categorias) → semantic_status='full'.
--   REUSO: decideReuse só considera fontes 'full'. Matches de fontes
--     'light' são enfileirados para a fase 2 antes de poderem ser
--     reutilizados.
--
-- Idempotente: pode ser reexecutado sem erro (IF NOT EXISTS /
-- DROP FUNCTION IF EXISTS / CREATE OR REPLACE).
--
-- Requer extensão pgvector (já criada pelas migrations anteriores).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. Colunas de status da pipeline em duas fases ──
-- Linhas EXISTENTES recebem 'light' via DEFAULT (backfill escolhido pelo
-- usuário: tudo recomeça em light e o cron da fase 2 faz o upgrade para
-- 'full' progressivamente — priorizando fontes mais reutilizadas).
ALTER TABLE sources ADD COLUMN IF NOT EXISTS semantic_status TEXT NOT NULL DEFAULT 'light';
-- Query que descobriu a fonte (contexto usado pela fase 2 para
-- understandOne quando não há query melhor disponível).
ALTER TABLE sources ADD COLUMN IF NOT EXISTS semantic_query TEXT;

-- Fila da fase 2: só o que ainda está 'light' entra no carregamento.
CREATE INDEX IF NOT EXISTS idx_sources_semantic_status
  ON sources(semantic_status)
  WHERE semantic_status = 'light';

-- ── 2. RPC de busca vetorial com status ──
-- CREATE OR REPLACE não muda o tipo de retorno: DROP + CREATE.
-- A fase de reuso precisa do semantic_status para (a) contar só 'full'
-- no coverage/diversity e (b) enfileirar 'light' na fase 2.
DROP FUNCTION IF EXISTS match_sources_by_embedding(vector, float, int);

CREATE FUNCTION match_sources_by_embedding(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.45,
  match_count INTEGER DEFAULT 15
)
RETURNS TABLE (
  source_id UUID,
  similarity FLOAT,
  semantic_status TEXT
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id AS source_id,
    1 - (s.embedding <=> query_embedding) AS similarity,
    s.semantic_status AS semantic_status
  FROM sources s
  WHERE s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) >= match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'sources'
--      AND column_name IN ('semantic_status', 'semantic_query');
--   SELECT p.proname, p.proargtypes::regtype[]
--     FROM pg_proc p WHERE p.proname = 'match_sources_by_embedding';
--   SELECT semantic_status, count(*) FROM sources GROUP BY 1;
--   -- esperado após o backfill: só 'light' (até o cron da fase 2 rodar)
-- ============================================================
