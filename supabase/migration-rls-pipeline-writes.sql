-- ============================================================
-- MIGRATION: Escritas da pipeline semântica via publishable key
-- ============================================================
-- Contexto: produção tem policies criadas NO DASHBOARD (nomes que não
-- existem no repo: "Public can read sources" = só SELECT; "No client
-- access to search query history" = deny). O repo declara o contrário
-- (schema.sql:117-119 e migration-semantic-engine.sql:101-105 criam
-- "Allow all for service role" FOR ALL), mas o baseline já aplicado não
-- pode ser re-executado — daí esta migration incremental.
--
-- Efeito observado com a role `anon` (SUPABASE_PUBLISHABLE_KEY):
--   SELECT sources/chunks/categories/topics  ✅ (policy de dashboard)
--   UPDATE sources                          ❌ silencioso (0 linhas,
--       sem erro) → cadeia Inngest "8/8 atualizadas" sem drenar fila
--   INSERT source_chunks/categories/topics   ❌ RLS (ou 22000 prévio,
--       quando o embedding vinha com 3072 dims — bug A, no código)
--   INSERT search_queries                   ❌ deny policy
--
-- Escopo das tabelas escritas por lib/evidenceIndex.ts:
--   sources           insert + update        (indexSource)
--   source_chunks      delete + insert        (substitui chunks)
--   source_categories  delete + insert        (substitui categorias)
--   source_topics      upsert                 (força de evidência)
--   search_queries     insert                 (logSearchQuery)
--
-- Decisão de design em search_queries: só INSERT. O app nunca lê essa
-- tabela (apenas logSearchQuery) e a policy do dashboard expressa
-- intenção de privacidade ("No client access") — o log volta a funcionar
-- sem expor o histórico de consultas ao client. Para seguir o
-- schema.sql:119 (abrir tudo), troque por FOR ALL USING (true).
--
-- Idempotente: seguro para reexecutar (ENABLE ROW LEVEL SECURITY /
-- DO block de remoção de policies / CREATE POLICY).
-- ============================================================

-- ── 1. sources — insert + update (lib/evidenceIndex.indexSource) ──
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sources'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON sources', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow all for service role" ON sources
  FOR ALL USING (true) WITH CHECK (true);

-- ── 2. source_chunks — delete + insert (substituição a cada index) ──
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'source_chunks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON source_chunks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow all for service role" ON source_chunks
  FOR ALL USING (true) WITH CHECK (true);

-- ── 3. source_categories — delete + insert ──
ALTER TABLE source_categories ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'source_categories'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON source_categories', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow all for service role" ON source_categories
  FOR ALL USING (true) WITH CHECK (true);

-- ── 4. source_topics — upsert (ON CONFLICT source_id,topic_normalized) ──
ALTER TABLE source_topics ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'source_topics'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON source_topics', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow all for service role" ON source_topics
  FOR ALL USING (true) WITH CHECK (true);

-- ── 5. search_queries — SÓ insert (histórico continua privado) ──
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'search_queries'
  LOOP
    -- Remove a deny policy do dashboard ("No client access...")
    -- e qualquer outra; SELECT fica sem policy = deny por default.
    EXECUTE format('DROP POLICY IF EXISTS %I ON search_queries', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow insert for search log" ON search_queries
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('sources','source_chunks','source_categories',
--                       'source_topics','search_queries')
--   ORDER BY tablename;
--   -- sources/chunks/categories/topics: "Allow all for service role" (5 cmds)
--   -- search_queries: "Allow insert for search log" (INSERT) — SEM SELECT
--
--   -- Teste definitivo como a aplicação enxerga (publishable/anon):
--   BEGIN;
--   SET LOCAL ROLE anon;
--   WITH u AS (UPDATE sources SET last_verified = last_verified
--              WHERE id = (SELECT id FROM sources LIMIT 1) RETURNING id)
--   SELECT count(*) AS linhas_afetadas FROM u;  -- deve ser 1
--   SELECT count(*) FROM search_queries;        -- deve ser 0 (privado)
--   INSERT INTO search_queries (query_text, query_normalized, topics,
--                               sources_found, decision, coverage_score)
--   VALUES ('rls-check', 'rls_check', '{}', 0, 'new_search', 0);
--   DELETE FROM search_queries WHERE query_text = 'rls-check';
--   ROLLBACK;
--
--   -- Após a primeira busca com o fix do embedBatch (bug A):
--   SELECT count(*) FROM source_chunks;          -- > 0
--   SELECT vector_dims(embedding) FROM sources
--     WHERE embedding IS NOT NULL;               -- 768, 768, ...
-- ============================================================
