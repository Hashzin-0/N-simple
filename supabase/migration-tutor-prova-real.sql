-- ============================================================
-- MIGRATION: Tutor — origem 'prova_real' (questões de provas reais)
-- Idempotente. Seguro de re-executar.
-- Requer tutor-schema.sql (+ plano2/documentos) aplicados.
-- ============================================================

-- 1) questions.origem: incluir 'prova_real' (questões extraídas de provas reais)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_origem_check;
ALTER TABLE questions
  ADD CONSTRAINT questions_origem_check
  CHECK (origem IN ('pesquisada', 'gerada', 'artigo', 'documento', 'prova_real'));

-- 2) Índice por origem já existe (idx_questions_origem) — recria se necessário
CREATE INDEX IF NOT EXISTS idx_questions_origem ON questions(origem);

-- ============================================================
-- VERIFICAÇÃO (rodar após o deploy)
-- ============================================================
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'questions'::regclass AND conname = 'questions_origem_check';
-- Esperado: CHECK (origem = ANY (ARRAY['pesquisada','gerada','artigo','documento','prova_real']))
--
-- INSERT de teste (deve funcionar; reverter depois):
-- INSERT INTO questions (hash_dedup, enunciado, assunto, origem, dificuldade)
-- VALUES ('q_teste_prova_real', 'teste', 'teste', 'prova_real', 'basica');
-- DELETE FROM questions WHERE hash_dedup = 'q_teste_prova_real';
