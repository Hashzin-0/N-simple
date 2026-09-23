-- ============================================================
-- MIGRATION: libras_progress — RLS + estrutura do mini-curso
-- ============================================================
-- Contexto: a tabela já existe no Supabase de produção (criada
-- manualmente), mas SEM política permissiva para o role `anon`
-- (a API usa SUPABASE_PUBLISHABLE_KEY, sem JWT da sessão).
-- Resultado: INSERT falhava com 42501
-- "new row violates row-level security policy for table libras_progress".
--
-- Padrão alinhado com tutor-schema.sql (user_progress / tutor_attempts).
--
-- Idempotente: seguro para reexecutar (IF NOT EXISTS /
-- DROP POLICY IF EXISTS / DO block de remoção de policies).
-- ============================================================

-- ── 1. Tabela (no-op se já existir em produção) ──
CREATE TABLE IF NOT EXISTS libras_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  word_id     TEXT NOT NULL,
  learned     BOOLEAN NOT NULL DEFAULT false,
  quiz_score  INTEGER NOT NULL DEFAULT 0,
  module_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Unique exigido pelo upsert onConflict: 'user_id,word_id' ──
-- (CREATE UNIQUE INDEX IF NOT EXISTS é no-op se o UNIQUE da tabela já existir)
CREATE UNIQUE INDEX IF NOT EXISTS libras_progress_user_word_key
  ON libras_progress (user_id, word_id);

CREATE INDEX IF NOT EXISTS libras_progress_user_id_idx
  ON libras_progress (user_id);

-- ── 3. RLS ──
ALTER TABLE libras_progress ENABLE ROW LEVEL SECURITY;

-- Remove QUALSEQUER policy anterior (ex.: criada no dashboard com
-- auth.uid()/TO authenticated, que o role anon não satisfaz).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'libras_progress'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON libras_progress', pol.policyname);
  END LOOP;
END $$;

-- Permissiva para o client server-side (publishable/anon key), igual ao Tutor.
CREATE POLICY "Allow all for service role" ON libras_progress
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--   SELECT polname, pg_get_expr(polqual, polrelid)
--   FROM pg_policy WHERE polrelid = 'libras_progress'::regclass;
--   -- deve retornar "Allow all for service role" com qualificação true
--
--   INSERT INTO libras_progress (user_id, word_id, learned, quiz_score, module_id)
--   VALUES ('test-rls-check', 'milho', true, 100, 'vocabulario_basico')
--   ON CONFLICT (user_id, word_id) DO UPDATE SET updated_at = now();
--   DELETE FROM libras_progress WHERE user_id = 'test-rls-check';
-- ============================================================
