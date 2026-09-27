-- ============================================================
-- MIGRATION: cefsa_verifications — aluno ativo do CEFSA
--            (gate do painel de admin)
-- ============================================================
-- Contexto: POST /api/auth/verify-cefsa valida RA/RM + senha contra
-- o Moodle do CEFSA (ead.cefsa.edu.br, Web Services habilitados) e
-- grava UMA linha por usuário do app. Linha vigente
-- (expires_at > now()) = aluno confirmado ⇒ acesso ao painel de admin.
-- A SENHA NUNCA É GRAVADA — só identidade devolvida pelo Moodle + datas.
--
-- Colunas:
--   user_id        TEXT PK   — id do usuário Supabase do app
--   ra_rm          TEXT      — RA/RM informado (username no Moodle)
--   moodle_user_id TEXT      — userid no Moodle (core_webservice_get_site_info)
--   full_name      TEXT      — nome completo
--   email          TEXT      — e-mail institucional (NULL se a função WS
--                              core_user_get_users_by_field não estiver
--                              liberada no service do Moodle)
--   site_url       TEXT      — wwwroot do Moodle verificado
--   verified_at    TIMESTAMPTZ — quando a senha foi confirmada
--   expires_at     TIMESTAMPTZ — validade (7 dias; revalidar via POST)
--
-- Revogar o acesso de um usuário:
--   DELETE FROM cefsa_verifications WHERE user_id = '<uuid>';
--
-- Padrão alinhado com migration-user-settings.sql: RLS permissivo
-- "Allow all for service role" (a API usa SUPABASE_PUBLISHABLE_KEY,
-- sem JWT da sessão).
--
-- Idempotente: seguro para reexecutar (IF NOT EXISTS /
-- DROP POLICY IF EXISTS / DO block de remoção de policies).
-- ============================================================

-- ── 1. Tabela (no-op se já existir) ──
CREATE TABLE IF NOT EXISTS cefsa_verifications (
  user_id        TEXT PRIMARY KEY,
  ra_rm          TEXT NOT NULL,
  moodle_user_id TEXT,
  full_name      TEXT,
  email          TEXT,
  site_url       TEXT,
  verified_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cefsa_verifications_expires
  ON cefsa_verifications (expires_at DESC);

-- ── 2. RLS ──
ALTER TABLE cefsa_verifications ENABLE ROW LEVEL SECURITY;

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
      AND tablename = 'cefsa_verifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cefsa_verifications', pol.policyname);
  END LOOP;
END $$;

-- Permissiva para a API server-side (publishable/anon key), igual às demais.
CREATE POLICY "Allow all for service role" ON cefsa_verifications
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'cefsa_verifications' ORDER BY ordinal_position;
--   -- esperado: user_id, ra_rm, moodle_user_id, full_name, email,
--   --           site_url, verified_at, expires_at, created_at, updated_at
--
--   SELECT polname FROM pg_policies
--   WHERE tablename = 'cefsa_verifications';
--   -- deve retornar "Allow all for service role"
--
--   INSERT INTO cefsa_verifications (user_id, ra_rm, expires_at)
--   VALUES ('test-cefsa-check', '000000', now() + interval '1 day')
--   ON CONFLICT (user_id) DO UPDATE SET updated_at = now();
--   SELECT expires_at > now() AS vigente FROM cefsa_verifications
--   WHERE user_id = 'test-cefsa-check';
--   DELETE FROM cefsa_verifications WHERE user_id = 'test-cefsa-check';
-- ============================================================
