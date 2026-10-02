-- ============================================================
-- MIGRATION: pipeline semântica via identidade privilegiada
-- ============================================================
-- Contexto: a migration anterior (migration-rls-pipeline-writes.sql,
-- JÁ APLICADA em produção) instalou "Allow all for service role"
-- (FOR ALL USING(true), roles={public}) nas 4 tabelas semânticas para
-- destravar as gravações via publishable key. Funciona, mas deixa
-- anon/authenticated com INSERT/UPDATE/DELETE/TRUNCATE — abertura
-- demais para tabelas que nenhum client browser acessa.
--
-- Arquitetura-alvo (revisão de segurança, itens 1-6):
--   • Escritas E leituras da pipeline semântica saem pelo cliente
--     `supabaseSemantic` (lib/supabase.ts) que usa SUPABASE_SECRET_KEY
--     (JWT Signing Keys → sb_secret_*; fallback legado
--     SUPABASE_SERVICE_ROLE_KEY) — a role service_role bypassa RLS.
--     Arquivos trocados: lib/evidenceIndex.ts, lib/semantic/phase2.ts,
--     lib/reuseDecision.ts (nenhum componente/browser toca estas tabelas).
--   • RLS das 4 tabelas volta a ser fechada: SÓ SELECT público (os dados
--     são fontes científicas públicas por design; o browser não lê estas
--     tabelas, mas leituras server-side via publishable fallback seguem
--     funcionando).
--   • GRANTs: revoga INSERT/UPDATE/DELETE/TRUNCATE de anon+authenticated
--     nas 4 tabelas (SELECT mantido — RLS já bastaria; grant é a segunda
--     camada). Em search_queries: revoga UPDATE/DELETE/TRUNCATE/SELECT,
--     mantém INSERT (policy INSERT-only existente é recriada — o log
--     continua privado, item 4 da revisão).
--   • match_sources_by_embedding recriada com SET search_path (item 6:
--     função não é SECURITY DEFINER, mas evitar search_path mutável é
--     higiene; corpo idêntico à versão atual de
--     migration-semantic-status.sql).
--   • semantic_webhook_config: mantida FECHADA (item 3) — RLS habilitada
--     sem policies + REVOKE = deny-by-default; só a função trigger
--     SECURITY DEFINER lê. Nada a mudar aqui, só confirmar.
--
-- ORDEM DE APLICAÇÃO (importante — nesta sequência nada quebra):
--   1. Deploy do código novo + SUPABASE_SECRET_KEY (ou
--      SUPABASE_SERVICE_ROLE_KEY) definida em .env local e no ambiente
--      do deploy;
--   2. npx tsx scripts/test-persistence.ts → modo=admin, tudo verde;
--   3. Executar ESTA migration (fecha policies/grants de escrita);
--   4. Repetir o teste (agora sem nenhuma policy pública de escrita)
--      e conferir as queries de verificação do rodapé.
--
-- Idempotente: seguro para reexecutar (ENABLE ROW LEVEL SECURITY /
-- DO block de remoção de policies / CREATE POLICY / DROP FUNCTION IF
-- EXISTS + CREATE / REVOKE).
-- ============================================================

-- ── 1-4. Tabelas da pipeline: só SELECT público ────────────────────
-- Remove "Allow all for service role" (e qualquer outra policy legada)
-- de sources / source_chunks / source_categories / source_topics e
-- instala policy de leitura apenas.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sources', 'source_chunks', 'source_categories', 'source_topics'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY "Public can read %s" ON %I FOR SELECT USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Grants: anon/authenticated perdem DML+TRUNCATE (guarda contra bypass
-- futuro de RLS); SELECT permanece para leitura pública via publishable.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON sources, source_chunks, source_categories, source_topics
  FROM anon, authenticated;

-- ── 5. search_queries — mantém só INSERT (histórico privado) ───────
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'search_queries'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON search_queries', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow insert for search log" ON search_queries
  FOR INSERT WITH CHECK (true);

REVOKE UPDATE, DELETE, TRUNCATE, SELECT
  ON search_queries FROM anon, authenticated;

-- ── 6. match_sources_by_embedding — search_path explícito ──────────
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
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
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

-- ── 3 (confirmação). semantic_webhook_config segue deny-by-default ──
COMMENT ON TABLE public.semantic_webhook_config IS
  'Config do webhook da fase 2 semântica (url + segredo). Deny-by-default: RLS habilitada sem policies + REVOKE = só a função trigger SECURITY DEFINER lida (migration-semantic-webhook.sql). Sem configuração o trigger fica inerte.';

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--
--   -- Policies (esperado: 4× "Public can read ..." = SELECT;
--   --                    search_queries = só INSERT):
--   SELECT tablename, policyname, cmd, roles
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('sources','source_chunks','source_categories',
--                        'source_topics','search_queries')
--    ORDER BY tablename;
--
--   -- Grants (esperado anon/authenticated: SELECT=true nas 4 tabelas;
--   --         INSERT/UPDATE/DELETE/TRUNCATE=false; search_queries só INSERT):
--   SELECT table_name, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon','authenticated')
--      AND table_name IN ('sources','source_chunks','source_categories',
--                         'source_topics','search_queries')
--    ORDER BY table_name, privilege_type;
--
--   -- search_path da RPC (esperado proconfig = {search_path=public, extensions}):
--   SELECT p.proname, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'match_sources_by_embedding';
--
--   -- Teste definitivo como o app (chave privilegiada) enxerga:
--   --   npx tsx scripts/test-persistence.ts   → modo=admin, verde
--   -- Sem a chave (fallback publishable) as escritas devem FALHAR
--   -- ruidosamente (é o esperado pós-lockdown — configure a chave).
-- ============================================================
