-- ============================================================
-- MIGRATION: Tutor Plano 2 — modo, origem artigo, fila de erros
-- Idempotente. Seguro de re-executar.
-- Requer tutor-schema.sql aplicado previamente.
-- ============================================================

-- 1) questions.origem: incluir 'artigo' (questões elaboradas a partir de artigos já pesquisados)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_origem_check;
ALTER TABLE questions
  ADD CONSTRAINT questions_origem_check
  CHECK (origem IN ('pesquisada', 'gerada', 'artigo'));

-- 2) tutor_attempts: modo da sessão + flag de fila resolvida
ALTER TABLE tutor_attempts ADD COLUMN IF NOT EXISTS modo TEXT;
ALTER TABLE tutor_attempts ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tutor_attempts_unresolved
  ON tutor_attempts(user_id, resolved, created_at DESC)
  WHERE resolved = false OR resolved IS NULL;

-- ============================================================
-- VERIFICAÇÃO (após aplicar):
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'questions'::regclass AND conname = 'questions_origem_check';
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'tutor_attempts' AND column_name IN ('modo', 'resolved');
-- ============================================================
