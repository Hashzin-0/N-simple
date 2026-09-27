-- ============================================================
-- MIGRATION: webhook do Supabase → fase 2 do semântico
-- ============================================================
-- Rede de segurança: fontes gravadas com semantic_status='light'
-- FORA da aplicação (SQL manual, seed, migração antiga) também
-- acionam a cadeia Inngest — sem esperar uma nova pesquisa.
--
-- DENTRO da aplicação o gatilho é o próprio
-- `lib/evidenceIndex.indexSources` (chama `enqueueFullSemantic()`
-- logo após cada lote gravado); este trigger cobre o resto.
--
-- Fluxo:
--   INSERT/UPDATE light em sources
--     → public.notify_semantic_light()
--     → POST /api/semantic/light-registered (Authorization: Bearer)
--     → enqueueFullSemantic() → evento semantic/light.registered
--     → semantic-light-kick (debounce 5s) → cadeia semantic-full
--       drena TODA a fila 'light' (novas + legadas).
--
-- ── CONFIGURAÇÃO (uma vez, no SQL Editor; NÃO precisa de superuser) ──
--   INSERT INTO public.semantic_webhook_config (id, url, secret)
--   VALUES (
--     true,
--     'https://<APP_URL>/api/semantic/light-registered',
--     '<gerar com: openssl rand -hex 32>'   -- = env SEMANTIC_WEBHOOK_SECRET
--   )
--   ON CONFLICT (id) DO UPDATE
--     SET url = EXCLUDED.url, secret = EXCLUDED.secret;
--
-- Por que tabela e não `ALTER DATABASE ... SET "app.settings.x"`:
-- gravar um GUC placeholder (qualquer nome `a.b` não declarado por
-- extensão) em nível de banco/role exige SUPERUSER — no Supabase o
-- role `postgres` não é superuser e o Postgres responde
-- `42501 permission denied to set parameter "app.settings..."`.
-- (GUCs continuam aceitos como OVERRIDE para quem for superuser —
--  lidos antes da tabela.)
--
-- A tabela é deny-by-default: RLS sem policies + REVOKE de
-- PUBLIC/anon/authenticated/service_role. Só o trigger (SECURITY
-- DEFINER, dono = quem rodou a migration) lê. O segredo NUNCA é
-- gravado neste arquivo.
--
-- Sem config (ou sem os dois campos) o trigger existe mas não envia
-- nada (inerte — a rota também responde 503 se o segredo não bater).
--
-- Idempotente: IF NOT EXISTS + CREATE OR REPLACE + DROP TRIGGER IF.
-- Requer pg_net (habilitado por padrão no Supabase). Sem ele — ou com
-- qualquer erro — o trigger só emite WARNING: nunca derruba a
-- gravação da fonte (webhook é melhor esforço).
--
-- Pode coexistir com o webhook do Dashboard (Database → Webhooks):
-- os dois mandam para a mesma rota, que é barata, e o debounce do
-- Inngest coalesce os eventos duplicados num único disparo.
-- ============================================================

-- ── 1. Configuração (1 linha; não versionar valores reais) ──
CREATE TABLE IF NOT EXISTS public.semantic_webhook_config (
  id     boolean PRIMARY KEY DEFAULT true CHECK (id),
  url    text,
  secret text
);

COMMENT ON TABLE public.semantic_webhook_config IS
  'Config do webhook da fase 2 semântica (url + segredo). Deny-by-default: lida só pela função de trigger SECURITY DEFINER.';

ALTER TABLE public.semantic_webhook_config ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy: nenhum papel (nem o dono via PostgREST) passa
-- pelo RLS; o owner da tabela continua lendo (dono não é afetado
-- pelo RLS sem FORCE ROW LEVEL SECURITY).
REVOKE ALL ON public.semantic_webhook_config FROM PUBLIC, anon, authenticated, service_role;

-- ── 2. Função de trigger ──
CREATE OR REPLACE FUNCTION public.notify_semantic_light()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url     text := nullif(current_setting('app.settings.semantic_webhook_url', true), '');
  v_secret  text := nullif(current_setting('app.settings.semantic_webhook_secret', true), '');
  v_schema  text;
  v_payload jsonb;
  v_headers jsonb;
BEGIN
  -- Fallback: tabela (funciona sem superuser). O GUC, se existir, vence.
  IF v_url IS NULL OR v_secret IS NULL THEN
    SELECT coalesce(v_url,  nullif(cfg.url,    '')),
           coalesce(v_secret, nullif(cfg.secret, ''))
      INTO v_url, v_secret
      FROM public.semantic_webhook_config cfg
     WHERE cfg.id;
  END IF;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN new;  -- não configurado: webhook inerte
  END IF;

  -- pg_net vive em 'net' (projetos novos); 'extensions' nos antigos.
  SELECT n.nspname INTO v_schema
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'http_post'
    AND n.nspname IN ('net', 'extensions')
  ORDER BY (n.nspname = 'net') DESC
  LIMIT 1;

  IF v_schema IS NULL THEN
    RAISE WARNING '[semantic-webhook] pg_net indisponível — requisição não enviada';
    RETURN new;
  END IF;

  -- Mesmo envelope do Database Webhook do Supabase (a rota aceita
  -- também o formato `records[]`, mas este é o canônico).
  v_payload := jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', to_jsonb(new),
    'old_record', CASE WHEN tg_op = 'UPDATE' THEN to_jsonb(old) ELSE NULL END
  );
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_secret
  );

  EXECUTE format(
    'SELECT %I.http_post(url => $1, body => $2, headers => $3, timeout_milliseconds => 5000)',
    v_schema
  ) USING v_url, v_payload, v_headers;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[semantic-webhook] falha ao enviar: %', SQLERRM;
    RETURN new;
END;
$$;

-- Sem RPC: é função de trigger (SECURITY DEFINER) e não deve ser
-- chamável via PostgREST por anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.notify_semantic_light() FROM PUBLIC, anon, authenticated, service_role;

-- ── 3. Trigger ──
DROP TRIGGER IF EXISTS trg_sources_light_webhook ON public.sources;

CREATE TRIGGER trg_sources_light_webhook
AFTER INSERT OR UPDATE OF semantic_status
ON public.sources
FOR EACH ROW
WHEN (NEW.semantic_status = 'light')
EXECUTE FUNCTION public.notify_semantic_light();

-- ============================================================
-- FIM DA MIGRATION
-- Verificação rápida após executar:
--
--   -- 1) config presente (sem expor o valor do segredo):
--   SELECT url IS NOT NULL AS url_ok, length(secret) > 0 AS secret_ok
--     FROM public.semantic_webhook_config;
--
--   -- 2) trigger no lugar:
--   SELECT tgname FROM pg_trigger
--    WHERE tgname = 'trg_sources_light_webhook' AND NOT tgisinternal;  -- 1 linha
--
--   -- 3) anon/authenticated NÃO leem a config (deve falhar):
--   SET ROLE anon; SELECT * FROM public.semantic_webhook_config; RESET ROLE;
--
--   -- 4) teste ponta a ponta (insere light → deve logar).
--   --    OBRIGATÓRIO: source_key (NOT NULL UNIQUE) e title (NOT NULL);
--   --    semantic_status nasce 'light' pelo DEFAULT da migration-semantic-status.
--   DELETE FROM sources WHERE source_key = 'webhook-smoke-test';  -- limpa tentativa anterior
--   INSERT INTO sources (source_key, title)
--   VALUES ('webhook-smoke-test', 'webhook smoke test') RETURNING id;
--   SELECT id, status_code, created_at FROM net._http_response
--    ORDER BY id DESC LIMIT 3;   -- status 200 = rota OK
--   DELETE FROM sources WHERE source_key = 'webhook-smoke-test';
--
--   -- 5) sem 'light' não dispara (nada novo em _http_response):
--   UPDATE sources SET semantic_status = 'full'
--    WHERE source_key = 'webhook-smoke-test';
-- ============================================================
