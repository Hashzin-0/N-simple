# AGENTS.md

## What This Is

Next.js 15 App Router application — a Brazilian corn nitrogen calculator ("Agronômica N-Pro") with Gemini Live voice assistant and 3D visualization. Runs as a Google AI Studio applet on Cloud Run.

## Key Commands

- `npm run dev` — start dev server
- `npm run build` — production build (standalone output)
- `npm run lint` — ESLint (next config)
- `npm run clean` — `next clean`

No test framework or test files exist. No CI workflows.

## Build Quirks

- ESLint is ignored during builds (`eslint.ignoreDuringBuilds: true` in `next.config.ts`)
- TypeScript errors are NOT ignored — `typescript.ignoreBuildErrors: false`
- Standalone output mode (`output: 'standalone'`)
- HMR is disabled in AI Studio via `DISABLE_HMR=true` env var (webpack watchOptions ignore all files)
- `motion` package is transpiled via `transpilePackages`

## Environment

Core env vars (see `.env.example`):
- `GEMINI_API_KEY` — injected by AI Studio at runtime from user secrets
- `APP_URL` — injected by AI Studio with Cloud Run service URL
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` — server-side Supabase; passed to the client via `AuthProvider` props from `app/layout.tsx` (**do not use `NEXT_PUBLIC_*`** — deployment constraint)
- `YOUTUBE_API_KEY` — YouTube Data API v3 (server-side; Libras search + research scraper)
- `LIBRAS_CHANNEL_HANDLES` — optional, comma-separated `@handles` prioritized for Libras sign search (default `@angelagirardi,@academiadelibras,@netolibras`); preferred channels first, then global fallback

Google login (optional; One Tap + footer fallback → Supabase OAuth redirect if no client id):
- `GOOGLE_CLIENT_ID` — Web OAuth client ID (or leave empty)
- `SUPABASE_MANAGEMENT_TOKEN` — Supabase PAT; lets the server read `external_google_client_id` from Management API (`lib/authConfig.ts`)
- UI: `components/auth/GoogleSignInIsland.tsx` tries `google.accounts.id.prompt()` (One Tap) when signed out; if not displayed, shows the fixed footer bar with GIS `continue_with` / OAuth button. `AuthProvider` supplies session, `user.id` cloud gate, and island height for the voice HUD.

Do not hardcode or commit secrets. The `.env` file is gitignored.

Embeddings / research (optional, see `.env.example`):
- `GEMINI_API_KEYS` — comma-separated keys; rotation + per-key RPM budget
- `EMBEDDING_RPM_PER_KEY` — max embed requests/min **per key** (default `80`, hard cap `95`; must stay **below** free-tier 100 RPM)
- `SCRAPER_CONCURRENCY` — parallel scrapers (default 3)
- `EMBEDDING_CONCURRENCY` — legacy, no longer the primary throttle (RPM window is)
- `SEMANTIC_SCHOLAR_API_KEY` — optional (free, sent by email); header `x-api-key`, 1 RPS guaranteed
- `INNGEST_DEV=1` — fala com o dev server local (`npx inngest-cli@latest dev`); produção usa `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`

## Semantic Scholar scraper (rate limit)

O scraper **não** usa mais só `/paper/search` — a API anônima responde **429
quase sempre** a partir de IPs de nuvem e o código antigo devolvia `[]`
silenciosamente (chip verde "(0)" sem explicação).

Fluxo atual em `lib/scrapers/semanticScholarClient.ts` (usado por
`lib/scrapers/semantic-scholar.ts` e pela estratégia 2 de `lib/scrapers/cnpem.ts`):

1. `/paper/search` (relevância) — **1 tentativa**, timeout 8 s. Quando dá 429
   responde na hora, então tentar é barato e o ranking é o melhor.
2. `/paper/search/bulk?sort=citationCount:desc` — pool anônimo muito mais
   tolerante (~75% de sucesso); até 3 tentativas com backoff (1,5 s/3 s,
   honra `Retry-After`) e timeout 12 s (payload pode chegar a ~2 MB).
3. Se o bulk devolve `total: 0` (a sintaxe do bulk exige **todos** os termos),
   repete com OR (`tok1 | tok2 | …`, máx. 8 tokens).

Comportamento de erro (importante para a UI):
- API respondeu 200 sem resultados → `[]` → chip **verde (0)** legítimo.
- 429/5xx/timeout → **lança** `SemanticScholarError` → `runOne` em
  `lib/scrapers/index.ts` → evento SSE `scraper_error` → chip **vermelho
  "Erro (0)"** em `PesquisadorFontesCard.tsx` (tooltip com a mensagem).
- **Pacing module-level**: fila serial com ≥1,5 s entre chamadas (1,1 s com
  chave) — o fan-out por tópico dispara várias chamadas em paralelo.
- **Circuit breaker**: 2× 429 seguidos → 60 s de fail-fast (não segura slot
  de `SCRAPER_CONCURRENCY` pagando retry).
- Query é sanitizada (remove `" | + ~ * ( ) -` do operador booleano do S2).

CNPEM mantém `catch → []` de propósito: lá o S2 é fallback da estratégia 1
(OpenAlex), então rate limit não pode deixar o chip CNPEM vermelho.

Verificação: `npx --yes tsx scripts/test-scrapers.ts` (Semantic Scholar deve
retornar > 0 com a query `adubação nitrogenada milho`).

## Database / Supabase migrations

| File | Role |
|------|------|
| `supabase/schema.sql` | **Baseline** already applied on production. Do not edit it to add new features — re-running a modified baseline can conflict with live objects. |
| `supabase/migration-*.sql` | **Incremental, idempotent** migrations. New schema changes go here only (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`). Safe to re-run. |
| `supabase/tutor-schema.sql` | Additive schema for Tutor Inteligente (separate feature). |
| `supabase/migration-tutor-plano2.sql` | Tutor Plano 2: `questions.origem` + `'artigo'`, `tutor_attempts.modo`/`resolved`, partial index for error queue. |
| `supabase/migration-semantic-engine.sql` | Adds `sources.embedding` + semantic columns, `source_chunks`, `source_categories`, RPC `match_sources_by_embedding`, RLS for new tables. Required by `lib/semantic/**`, `lib/evidenceIndex.ts`, `lib/reuseDecision.ts`. |
| `supabase/migration-semantic-status.sql` | Two-phase pipeline: `sources.semantic_status` (DEFAULT 'light' = backfill of existing rows) + `semantic_query`, partial index for the phase-2 queue, and recreates RPC `match_sources_by_embedding` returning `semantic_status`. Required by `lib/semantic/phase2.ts`, `lib/semantic/portalQueues.ts`, `lib/reuseDecision.ts`. |
| `supabase/migration-libras-progress.sql` | Mini-curso Libras: ensures `libras_progress` table + unique `(user_id,word_id)`, drops conflicting RLS policies, installs permissive `FOR ALL USING (true)` (fixes POST 42501 with publishable key). |
| `supabase/migration-tutor-documentos.sql` | Documentos enviados (PDF/TXT): `tutor_documents`, `tutor_document_chunks` (VECTOR 768) + RPC `match_document_chunks`, `tutor_flashcards` (SM-2), `review_artifacts` (simulado/quiz/mapa_mental/seminario/resumo/plano), `questions.origem += 'documento'`. Required by `lib/tutor/documents.ts`, `lib/tutor/review.ts`, `/api/tutor/documents*`, `/api/tutor/review`, `/api/tutor/flashcards`. |
| `supabase/migration-tutor-prova-real.sql` | Questões de provas reais: `questions.origem += 'prova_real'`. Required by `lib/tutor/seeds.ts` (seeds de ética), badge "Prova real" em `components/TutorInteligente/QuestionCard.tsx`. |
| `supabase/migration-user-settings.sql` | Preferências do usuário em nuvem: `user_settings` (PK `user_id`, `voice JSONB`) + RLS permissivo. Required by `app/api/user/settings` (sync do supressor de ruído via `hooks/useVoiceSettings.ts`). |

Rules:
1. Never rewrite an already-applied baseline file with new DDL — create the next `migration-*.sql` instead.
2. Migrations must be re-runnable (idempotent).
3. Document each new migration in this table.
4. After deploy, run the verification queries at the bottom of the migration file.

## Tutor research timeout

`POST /api/tutor/research` runs a long cascade (reuse → optional light scrapers → ≤2 LLM extracts). It **must** stay under the Vercel function budget:

- `vercel.json` → `functions["app/api/tutor/research/route.ts"].maxDuration = 300` (mirrors route `export const maxDuration = 300`). Without this entry, the platform default (~60s) kills the request with `FUNCTION_INVOCATION_FAILED`.
- `lib/tutor/researchQuestions.ts` enforces a soft budget (`HEAVY_BUDGET_MS` for scrapers, `HARD_STOP_MS` for LLM, `MAX_LLM_EXTRACTS = 2`) and returns partial results + `errors` instead of hanging.
- Tutor path calls `searchSources({ light: true, priorDecision, maxTopicsForSearch: 2, searchOptions.maxPerSource })` so it does not run full `understandSources` (retrieval/rerank/full-text) or topic×scraper fan-out. Light mode **still persists** scraped sources via `persistPartialBatch` (metadata only, `shouldPersist: true`) so research progress is not lost.

When changing this route or `searchSources`, keep those three constraints (vercel.json entry, time budget, light mode) in sync.

## Semantic analysis persistence (two-phase pipeline)

Full (non-light) `searchSources` runs in **two phases** (portal queues + background understanding):

### FASE 1 — light, no foreground (`lib/semantic/portalQueues.ts`)

1. Scrapers finish → `onProcessingStart(totalFound, 'Analisando filas por portal (fase leve)...')`.
2. `runLightPhase` batches ALL sources (memory pool + scraper hits) — 1 embed per source, no full-text — scores them (query cosine + domain anchor) and builds `queues: Map<portal, sources[]>` sorted 1→2→3.
3. `roundRobinQueueItems` walks the queues fairly (portal A pos 1, portal B pos 1, …) → `processLightPhase` persists in batches of 25 with `semantic_status='light'` + `semantic_query`, emitting `onPortalQueuesReady`, per-portal `onSourceVerified` (`portal`/`queueIndex`/`queueTotal`) and finally `onPhase2Enqueued`.
4. If the phase throws (quota/OOM), everything is wrapped as light and persisted anyway (fallback path in `searchSources`).
5. Final `persistSearchOutcome` is an idempotent upsert + `search_queries` log.

### FASE 2 — full, background (Inngest — `lib/semantic/phase2.ts`)

- `enqueueFullSemantic({query, sourceIds})` → event `semantic/full.requested`; chain step processes `PHASE2_CHUNK_SIZE=8` rows per invocation (`ENGINE_CONCURRENCY=2`), requeues until empty or `MAX_CHAIN_ROUNDS=120`. Checkpoint is the DB column — crash-safe/resumable by design.
- Each row: `understandFullOne` (retrieve → rerank → full-text → chunks → categorias) → `indexSources` with `semanticStatus:'full'`. **Fallback leve (`understandOneLight`) does NOT promote** — stays `'light'` for a later backfill retry.
- `semanticBackfillFn` (cron `*/10 * * * *`) kicks a chain for ALL remaining `'light'` rows (old DB rows backfilled by migration `DEFAULT 'light'`), ordered by `reuse_count` with portal round-robin.
- Endpoint: `app/api/inngest/route.ts` (`maxDuration = 300` in `vercel.json`). Dev: `npx inngest-cli@latest dev` + `INNGEST_DEV=1` (see `.env.example`). Prod: `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`.
- Status polling: `GET /api/gemini/semantic-status` → `{pending, full, lightByPortal}` (chip "classificando em 2º plano" in `PesquisadorFontesCard.tsx`, polls every 10s).

### Reuse gate (`lib/reuseDecision.ts`)

- `decideReuse` counts **only `semantic_status='full'`** in coverage/diversity (topic rows + `match_sources_by_embedding`, which now RETURNS `semantic_status`).
- Light matches are excluded from `sourcesToReuse` and returned as `pendingFullSemanticIds` → `searchSources` enqueues them to phase 2 immediately (`enqueueFullSemantic` right after the decision).
- `indexSource` never downgrades `'full'` → `'light'`; `understandFullOne` stamps the stage on every result.

Progress events: SSE `processing_progress` → client `verifiedIds` (blue badges) + `%` counter + per-portal chips; `portal_queues` and `semantic_full_queued` carry phase transitions. `onSourceVerified`/`onPortalQueuesReady`/`onPhase2Enqueued` live on `SourceSearchProgress`.

When changing this pipeline keep in sync: migration `supabase/migration-semantic-status.sql`, `vercel.json` inngest entry, `INNGEST_DEV` docs, and the SSE consumers in `PesquisadorFontesCard.tsx`.

### Memory / SIGKILL (Vercel)

- Stealth/Chromium: **disabled when `process.env.VERCEL`** unless `ENABLE_STEALTH=1`; also honor `DISABLE_STEALTH=1`. Lazy `import()` in `fullTextFetcher` (no static puppeteer in the module graph).
- Always `closeBrowser()` in route `finally` blocks (pesquisador-fontes/artigo, redacao-pesquisa, evidence/*).
- HTML/PDF full-text: hard byte caps before parse (`MAX_RAW_HTML_BYTES` / `MAX_RAW_PDF_BYTES` in `fullTextFetcher.ts`).
- `SCRAPER_CONCURRENCY` defaults to **2 on Vercel**, 3 elsewhere.
- Category extractor embeds ≤24 candidates (was 80) to cut embedding memory.

If function still SIGKILLs: raise **Function Memory** in Vercel Dashboard (Fluid Compute does not read `memory` from `vercel.json`).

## Voice agent hub (global ↔ tutor ↔ libras)

Uma **orb compartilhada** (`VoiceAssistantHUD`) serve a **três** agentes Gemini Live que se trocam **em sessão** via session resumption (global ↔ tutor ↔ libras):

- `lib/voiceHub.ts` — singleton (store `useSyncExternalStore`): registra os runtimes, expõe `{activeAgentId, handoff}` e implementa `callAgent(target, {transitionText, delayNavigation})` / `syncTab(tab)`.
- `lib/liveSession.ts` — `sessionResumption` no setup, captura `sessionResumptionUpdate` (handle, validade ~2h), `switchPersona(options)` reabre o socket com o handle + novo systemInstruction/tools (config só vale no setup — troca = nova conexão).
- Fluxo do handoff: captura handle → `activeAgentId` + `handoff=true` + navega para a aba do destino (navigator registrado pelo `page.tsx`) → grace de **2,5s** (deixa a resposta da ferramenta e a fala de despedida saírem no socket antigo) → `disconnect()` do origem + `switchPersona({resumeHandle, transitionText})` no destino. Se o destino ainda não montou (ex: tab tutor lazy), guarda `pendingSwitch` e aplica no `register()`.
- `syncTab()` roda no efeito de `activeTab` do `page.tsx`: handoff se houver sessão viva, senão só troca o agente ativo; cancela handoff pendente cujo destino não é a nova aba.
- Tools de voz: `chamarAgente(alvo)` existe nos **três** agentes (`useGeminiLiveAgent` → `'tutor'|'libras'`; `useTutorLiveAgent` → `'global'|'libras'`; `useLibrasLiveAgent` → `'global'|'tutor'` — os dois últimos com `delayNavigation: true` para não desmontar a aba atual antes da despedida).
- HUD mostra a orb em `isConnected || isConnecting` e mantém "conectando" durante `handoff` (`page.tsx` mescla o estado via `hudAgentState`).
- Registro: cada hook registra o runtime em `useEffect(() => {voiceHub.register(...)}, [])` e notifica `voiceHub.agentStateChanged()` a cada mudança de estado.

Tools do agente **Libras** (`hooks/useLibrasLiveAgent.ts`, 17 tools — montado em `components/LibrasNoAgro/index.tsx` via prop `voiceBridge`, padrão do Tutor; a aba só existe quando `activeTab === 'libras'`, então o hub usa `pendingArmed` no handoff): busca `buscarSinal` → `lerResultadosSinais` → `mostrarSinalYouTube(indice)` (abre `components/LibrasNoAgro/LibrasVideoModal` via store `lib/librasVideoPlayer.ts`: `openLibrasVideo`/`closeLibrasVideo`/`useLibrasVideo`; também `fecharVideo`); tradutor oficial `mostrarSinalVLibras(palavra)` → `lib/vlibras.ts` automatiza o widget (garante ligado via `setWidgetEnabled`, `window.VLibrasWidget.open()`, menu `#header-menu-button` → "Tradutor" dentro do shadow root de `#vlibras-app-root`, seta valor com o setter nativo do React + evento `input` (debounce 300 ms) e clica "Traduzir"; orçamento duro de 16 s, responde `{ok,message}`); `alternarWidgetVLibras`; mini-curso `progressoLibras`/`iniciarQuizLibras`; prática `iniciarPraticaLibras`; coach de câmera `observarMeuSinal(alvo, segundos)` → `pendingCoach` → `LibrasPractice` (modo livre: abre câmera sem template, captura 3 quadros JPEG 480px → `POST /api/libras/sign-feedback` com `parts` multimodais no `generateTextWithFallback` → report) → `lerFeedbackSinal`; mais `abrirSecaoLibras`, `scrollToSection`, `chamarAgente`, `setSupressorRuido`, `listarCapacidades`, `encerrarConversa`. Reportes vivem em **refs** de `page.tsx` (`librasSearchReportRef`/`librasCoachReportRef`, campo `at` de frescor) lidas pelas getters da ponte — não entram em setState (nenhum UI consome). O padrão "YouTube ou VLibras?" (perguntar antes de mostrar) está na instrução do agente.

Tutor tools de voz adicionais (`useTutorLiveAgent`): `lerDocumento` (POST `/api/tutor/documents/query`), `criarRevisao` (POST `/api/tutor/review` — pode demorar), `listarFlashcards` (GET `/api/tutor/flashcards?due=1`), `scrollToSection` (seção da aba do Tutor → rola direto; seção de outra aba → `voiceHub.callAgent('global', {transitionText com o comando, delayNavigation: true, tab})` e o Puck executa o scroll).

Estúdio de revisão: `components/TutorInteligente/ReviewStudio.tsx` gera simulado/quiz/flashcards/resumo/plano/mapa mental/seminário a partir dos documentos enviados (fonte primária) ou do tema; persiste via `lib/tutor/review.ts` em `review_artifacts`/`tutor_flashcards`; SRS em `/api/tutor/flashcards` (SM-2 simplificado).

### Tools globais de voz (`useGeminiLiveAgent`)

48 tools declaradas em `GLOBAL_TOOLS`, todas com `behavior: 'NON_BLOCKING'`, handler em `executeTool` e menção em `GLOBAL_SYSTEM_INSTRUCTION` (sincronia obrigatória ao adicionar tool: declaração + case + instrução, nesta ordem). Além de navegação/params/cenários/fonte, cobrem:

- **Clima e memória de evidências** (sem chave de API): `consultarPrevisaoTempo` (`local?`/`dias?` → geocoding + forecast Open-Meteo; sem `local` usa `navigator.geolocation` + geocoding reverso) e `consultarMemoriaEvidencias` → `POST /api/evidence/search` com `AbortController` de 45s (pesado: roda `understandSources` no servidor).
- **Análise morfológica (aba ABNT)**: `gerarFraseMorfologica` sorteia `gerarFraseLocal()` **na tool** e devolve o texto (+ nº de palavras, sem as classes) — a frase chega ao componente via `pendingReq {seq, frase}` em `components/AnaliseMorfologica`; `lerProgressoAnalise` lê `n_calc_analise_morfologica_v1` do localStorage.
- **Libras**: NÃO há tools de Libras no agente global — use `chamarAgente(alvo: 'libras')` e responda com uma frase curta de despedida (as tools de Libras vivem em `useLibrasLiveAgent`, ver seção do hub).
- **Leitura/exportação**: `lerProgressoPesquisa` (estado `pesqSearchSnapshot` em `page.tsx`, **não** expira ao contrário do card do header), `copiarArtigo` (`pesqArticleReport.textoCompleto`, formatado por `formatArticleText` em `PesquisadorAutomaticoSection`), `copiarRedacao`/`baixarRedacao` (.txt via Blob).
- **Interface**: `alternarTema` (`useTheme()` via `themeRef` no hook), `abrirAcessibilidade` (estado do painel em `page.tsx`), `alternarWidgetLibras`/`alternarReconhecimentoLibras` (helpers puros exportados por `hooks/useLibrasSettings.ts`).
- **Sessão**: `listarCapacidades` (const `CAPACIDADES` — manter em sincronia com `GLOBAL_TOOLS`), `iniciarRevisao` (`voiceHub.callAgent('tutor')` já com tema/formato), `encerrarConversa` (`sessionControlsRef.disconnect` com 3s de graça para a despedida) e `alternarMudo` (`sessionControlsRef.toggleMute`).
- **Supressor de ruído**: `setSupressorRuido` (`modo: 'automatico'|'manual'|'desligado'` + `distancia_cm?`) — declarada nos **dois** agentes; handler compartilhado `applyNoiseGateToolArgs` em `lib/noiseGate.ts` (ver seção própria abaixo).

- **Pesquisador Agro** (demoram → retornam "iniciado" e o resultado é lido depois): `pesquisarFontes` → `lerResultadosFontes`; `gerarArtigoABNT` → `copiarCitacaoABNT`.
- **Redação** (fluxo): `pesquisarRepertorio` → `gerarRedacao` → `lerRedacao` / `validarRedacao` / `recomecarRedacao`.
- **Sessões empilhadas da aba Libras**: mesma página, âncoras `libras_search`/`librascurso`/`libras_practice`/`libras_tutor`/`libras_capture_test` (scroll-spy do `SectionNavGooey`) — a transferência `chamarAgente('libras')` troca a aba e quem rola é o agente Libras.
- **Scroll universal**: `scrollToSection` aceita **qualquer seção do site** — ids do `SectionNavGooey` (catálogo único em `lib/sectionNav.ts`: `SECTIONS_BY_TAB`/`resolveSection`/`tabForSection`) ou aliases legados (`parametros`, `dose_total`, ...). Troca de aba automática: `onNavigateTab(tab)` + `waitForElement` (polling por rAF, substitui o antigo `setTimeout(400)`), depois `smoothScrollToSection`. Seção da **aba do Tutor** → NÃO troca de aba (mataria a fala do Puck no meio do handoff que `voiceHub.syncTab` dispara ao ver `activeTab === 'tutor'`): `voiceHub.callAgent('tutor', {transitionText com o comando})` e quem rola é o Tutor. Recíproco no Tutor e no **Libras**: seção fora da própria aba → `callAgent(alvo, {transitionText, delayNavigation: true, tab})`. `callAgent` aceita `tab?` para navegar direto à aba da seção (padrão `TAB_FOR_AGENT`).

Padrão de requisição pendente (aba desmonta ao trocar): a tool grava `{seq, ...}` no estado de `page.tsx` (via callbacks `onPesquisarFontes`/`onRedacaoAction`/... que também fazem `setActiveTab`) → o componente consumidor guarda o `seq` num ref e executa uma única vez → o filho reporta o resultado de volta para `page.tsx` (`*Report` state) → `SimulatorContext` → tools de leitura. Report states **não** entram como deps dos memos de conteúdo de aba (loop de render). Na aba Libras os reportes de voz (`LibrasVoiceSearchReport`/`LibrasCoachReport`, campo `at`) ficam só em **refs** de `page.tsx` (sem setState) e chegam ao hook via getters da ponte `librasVoiceBridge`. Componentes-chave: `PesquisadorAgro/index.tsx`, `PesquisadorRedacao/index.tsx` (+ persistência estendida em `hooks/useRedacaoState.ts`), `LibrasNoAgro` (sessões empilhadas; `pendingSearch` chega sempre — guarda por `seq`).

## Supressor de ruído (modo próximo)

Supressor de proximidade do microfone da voz — só passa quem está perto (~30 cm). Estado tem 3 modos: `automatico` (**padrão**: estima o piso de ruído ambiente em tempo real e ajusta a margem sozinho — trânsito/escola/parque fica mais agressivo, ambiente calmo quase transparente), `manual` (para de ajustar e fixa `distancia_cm`, padrão 30) e `desligado` (bypass total).

- **`lib/noiseGate.ts`** — fonte única: store module-level (`useSyncExternalStore` + localStorage `agronomic_voice_noise_v1`, padrão `useLibrasSettings`), `NoiseGateProcessor` (DSP per-sample in-place: RMS do piso com tempos assimétricos 0,8 s/3 s → margem auto `6 + (floorDb+60)·0,55` limitada a 6–18 dB, ou manual `20·log10(60/cm)+6` limitada a 3–24 dB → high-pass 80 Hz + envelope + gate com histerese 0,6× e ataque 8 ms/release 180 ms → `tanh` com makeup ×2) e `applyNoiseGateToolArgs` (handler da tool usado pelos três agentes).
- **`lib/audioStreamer.ts`** — cria o processador no `startRecording` e **assina a store**: mudança em sessão → `setConfig` na hora + `track.applyConstraints({autoGainControl: modo==='desligado'})` (com gate ativo o AGC fica OFF p/ não amplificar fundo; `catch` silencioso — o gate em JS continua valendo). Gate roda no topo de `processAudioChunk` (cobre worklet e ScriptProcessor; volume da orbe passa a medir o áudio já filtrado). `stopRecording` cancela a assinatura.
- **Tool** `setSupressorRuido` — declaração + case + instrução sincronizados nos **três** agentes; `CAPACIDADES` atualizada. Retorna `message` pronta para a fala.
- **Persistência** — local sempre; nuvem com usuário logado via `hooks/useVoiceSettings.ts` (`useVoiceSettingsSync()` montado em `app/page.tsx`): pull no login vence o `updatedAt` mais novo, push com debounce de 400 ms. API `app/api/user/settings` + migration `supabase/migration-user-settings.sql`.
- **HUD** — `VoiceAssistantHUD` lê a store (`useVoiceNoiseState`) e repassa `nearModeActive` → `LiveVoiceOrb3D` faz lerp das partículas para roxo `#8B5CF6` no RAF (mesmo padrão do lerp de cor por status; fallback WebGL tinge o glow, preservando `error` vermelho).

## Architecture

- **App Router**: `app/page.tsx` is the single-page calculator (client component) — orchestrates layout and passes data, no business logic or UI state in results
- **API Routes**: `app/api/gemini/live-token/route.ts` (ephemeral tokens for Gemini Live WebSocket) e `app/api/libras/sign-feedback/route.ts` (Gemini vision avalia quadros da câmera; `maxDuration = 60`, aceita 1–4 `data:image/jpeg;base64`)
- **Components**: `components/` — shared UI building blocks (3D visualizers, toggles, HUD, modals) with 11 top-level components
- **Components Metrics**: `components/metrics/` — modularized result cards and sections (see Modularization below)
- **Hooks**: `hooks/useGeminiLiveAgent.ts` + `hooks/useTutorLiveAgent.ts` + `hooks/useLibrasLiveAgent.ts` — thin wrappers over shared `lib/liveSession.ts` (Gemini Live WebSocket + voice); Tutor modes live in `hooks/useTutorSession.ts`; all three agents register in `lib/voiceHub.ts`
- **Lib**: `lib/audioStreamer.ts` (audio capture/playback), `lib/liveSession.ts` (shared Live WS/audio core), `lib/voiceHub.ts` (hub global↔tutor↔libras com session resumption), `lib/vlibras.ts` (automação do widget VLibras p/ voz), `lib/librasVideoPlayer.ts` (store do player de vídeo por voz), `lib/liveConfig.ts` (`LIVE_MODEL_ID`, `LIVE_VOICE_NAME`), `lib/pageAutomator.ts` (UI automation for voice agent — scroll, spotlight, `waitForElement`), `lib/sectionNav.ts` (catálogo único das seções do `SectionNavGooey` p/ nav + tools de scroll), `lib/storage.ts` (localStorage-based scenario DB), `lib/types.ts` (shared TypeScript interfaces), `lib/calculations.ts` (pure calculation functions), `lib/tutor/**` (Tutor session, cascade research, evaluate, prompts, documents, review), `lib/llm-providers/**` (LLM fallback + `generateTextWithFallback` multimodal), `lib/authConfig.ts` + `lib/supabaseBrowser.ts` (auth config / browser Supabase)
- **Storage**: localStorage with `useSyncExternalStore` for hydration safety; 3 default seed scenarios
- **Language**: App UI is in Portuguese (pt-BR)

## Conventions

- `@/*` path alias maps to root (configured in `tsconfig.json`)
- Tailwind CSS 4 with `@tailwindcss/postcss` plugin; custom dark mode variant: `.dark` class
- Client components use `'use client'` directive
- Icons from `lucide-react`
- Animation from `motion/react` (not `framer-motion`)
- `cn()` utility in `lib/utils.ts` for Tailwind class merging (clsx + tailwind-merge)

## Modularization Rules

### Metric Cards Pattern

Each formula/section is a self-contained component in `components/metrics/`. Each component:
- Owns its own `useState` for toggle state (e.g. `showCalc`)
- Uses `CalculationIsland` (toggle button) and `CalculationMemoryPanel` (animated formula reveal) as shared building blocks
- Receives data via props, never accesses parent state directly
- Preserves required DOM IDs used by `lib/pageAutomator.ts`

### Shared Building Blocks

- `CalculationIsland` — toggle button (absolute positioned, "C" icon) to show/hide formula memory
- `CalculationMemoryPanel` — animated expandable panel wrapping formula children
- `MetricCard` — reusable wrapper for simple label→value→formula→memory pattern (used by ExtracaoTotalCard, NecessidadeLiquidaCard, DoseRecomendadaCard)

### Files

| File | Purpose |
|------|---------|
| `lib/types.ts` | `Calculations` interface, `MetricCardProps` |
| `lib/calculations.ts` | `computeCalculations()` — pure function extracted from useMemo |
| `components/metrics/MetricCard.tsx` | Reusable card wrapper (label + value + formula + memory panel) |
| `components/metrics/ExtracaoTotalCard.tsx` | Formula: `E = sc/ha × N_saca` |
| `components/metrics/NecessidadeLiquidaCard.tsx` | Formula: `N_Liq = E - MOS - Soja` |
| `components/metrics/DoseRecomendadaCard.tsx` | Hero card + Save button, `id="card_dose_total"` (wrapper div in page.tsx) |
| `components/metrics/SecondaryCreditsCard.tsx` | MOS + Soy credits display (no calculation memory) |
| `components/metrics/ParcelamentoSection.tsx` | Split schedule with 3 applications + difference, `id="parceling_section"` |
| `components/metrics/BalancoSection.tsx` | Balance validation with stacked bar visualization |
| `components/metrics/DetailedMathPanel.tsx` | Summary panel for copy |
| `components/metrics/CornYieldResultCard.tsx` | Corn yield results with hero card + sub-metrics + apply button |

### Rules for New Metric Cards

1. Create a new file in `components/metrics/` named after the metric
2. Define a `Props` interface for required data
3. Own `useState(false)` for `showCalc` toggle internally
4. Use `CalculationIsland` + `CalculationMemoryPanel` for formula reveal
5. For simple cards: extend `MetricCard` wrapper. For complex layouts: build custom with the shared building blocks
6. If the card needs a DOM ID for pageAutomator, preserve it on the outermost element
7. Import in `page.tsx` and place in the results section — page.tsx only orchestrates, never owns card state
