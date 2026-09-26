-- ============================================================
-- MIGRATION: user_settings — preferências do usuário (voz)
-- ============================================================
-- Contexto: o supressor de ruído "modo próximo" do agente de voz
-- precisa persistir em NUVEM além do localStorage (preferência
-- entre dispositivos/sessões). Uma linha por usuário, payload em
-- JSONB para não exigir migration a cada novo campo de voz.
--
-- Coluna `voice` (JSONB), forma atual:
--   { "modo": "automatico|manual|desligado",
--     "distancia_cm": 30,
--     "updatedAt": 1735689600000 }
--   `updatedAt` é epoch ms usado pelo client para reconciliar
--   local × nuvem (vence o mais novo).
--
-- Padrão alinhado com migration-libras-progress.sql:
-- RLS permissivo "Allow all for service role" (a API usa
-- SUPABASE_PUBLISHABLE_KEY, sem JWT da sessão).
--
-- Idempotente: seguro para reexecutar (IF NOT EXISTS /
-- DROP POLICY IF EXISTS / DO block de remoção de policies).
-- ============================================================

-- ── 1. Tabela (no-op se já existir) ──
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    TEXT PRIMARY KEY,
  voice      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. RLS ──
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

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
      AND tablename = 'user_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_settings', pol.policyname);
  END LOOP;
END $$;

-- Permissiva para o client server-side (publishable/anon key), igual ao Tutor.
CREATE POLICY "Allow all for service role" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--   SELECT polname, pg_get_expr(polqual, polrelid)
--   FROM pg_policy WHERE polrelid = 'user_settings'::regclass;
--   -- deve retornar "Allow all for service role" com qualificação true
--
--   INSERT INTO user_settings (user_id, voice)
--   VALUES ('test-rls-check', '{"modo":"automatico","distancia_cm":30}'::jsonb)
--   ON CONFLICT (user_id) DO UPDATE SET voice = EXCLUDED.voice, updated_at = now();
--   SELECT voice FROM user_settings WHERE user_id = 'test-rls-check';
--   DELETE FROM user_settings WHERE user_id = 'test-rls-check';
-- ============================================================
