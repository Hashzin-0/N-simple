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

## Database / Supabase migrations

| File | Role |
|------|------|
| `supabase/schema.sql` | **Baseline** already applied on production. Do not edit it to add new features — re-running a modified baseline can conflict with live objects. |
| `supabase/migration-*.sql` | **Incremental, idempotent** migrations. New schema changes go here only (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`). Safe to re-run. |
| `supabase/tutor-schema.sql` | Additive schema for Tutor Inteligente (separate feature). |
| `supabase/migration-tutor-plano2.sql` | Tutor Plano 2: `questions.origem` + `'artigo'`, `tutor_attempts.modo`/`resolved`, partial index for error queue. |
| `supabase/migration-semantic-engine.sql` | Adds `sources.embedding` + semantic columns, `source_chunks`, `source_categories`, RPC `match_sources_by_embedding`, RLS for new tables. Required by `lib/semantic/**`, `lib/evidenceIndex.ts`, `lib/reuseDecision.ts`. |
| `supabase/migration-libras-progress.sql` | Mini-curso Libras: ensures `libras_progress` table + unique `(user_id,word_id)`, drops conflicting RLS policies, installs permissive `FOR ALL USING (true)` (fixes POST 42501 with publishable key). |

Rules:
1. Never rewrite an already-applied baseline file with new DDL — create the next `migration-*.sql` instead.
2. Migrations must be re-runnable (idempotent).
3. Document each new migration in this table.
4. After deploy, run the verification queries at the bottom of the migration file.

## Tutor research timeout

`POST /api/tutor/research` runs a long cascade (reuse → optional light scrapers → ≤2 LLM extracts). It **must** stay under the Vercel function budget:

- `vercel.json` → `functions["app/api/tutor/research/route.ts"].maxDuration = 300` (mirrors route `export const maxDuration = 300`). Without this entry, the platform default (~60s) kills the request with `FUNCTION_INVOCATION_FAILED`.
- `lib/tutor/researchQuestions.ts` enforces a soft budget (`HEAVY_BUDGET_MS` for scrapers, `HARD_STOP_MS` for LLM, `MAX_LLM_EXTRACTS = 2`) and returns partial results + `errors` instead of hanging.
- Tutor path calls `searchSources({ light: true, priorDecision, maxTopicsForSearch: 2, searchOptions.maxPerSource })` so it does not run full `understandSources`/`indexSources` or topic×scraper fan-out.

When changing this route or `searchSources`, keep those three constraints (vercel.json entry, time budget, light mode) in sync.

## Architecture

- **App Router**: `app/page.tsx` is the single-page calculator (client component) — orchestrates layout and passes data, no business logic or UI state in results
- **API Route**: `app/api/gemini/live-token/route.ts` — creates ephemeral tokens for Gemini Live WebSocket
- **Components**: `components/` — shared UI building blocks (3D visualizers, toggles, HUD, modals) with 11 top-level components
- **Components Metrics**: `components/metrics/` — modularized result cards and sections (see Modularization below)
- **Hooks**: `hooks/useGeminiLiveAgent.ts` + `hooks/useTutorLiveAgent.ts` — thin wrappers over shared `lib/liveSession.ts` (Gemini Live WebSocket + voice); Tutor modes live in `hooks/useTutorSession.ts`
- **Lib**: `lib/audioStreamer.ts` (audio capture/playback), `lib/liveSession.ts` (shared Live WS/audio core), `lib/liveConfig.ts` (`LIVE_MODEL_ID`, `LIVE_VOICE_NAME`), `lib/pageAutomator.ts` (UI automation for voice agent), `lib/storage.ts` (localStorage-based scenario DB), `lib/types.ts` (shared TypeScript interfaces), `lib/calculations.ts` (pure calculation functions), `lib/tutor/**` (Tutor session, cascade research, evaluate, prompts), `lib/authConfig.ts` + `lib/supabaseBrowser.ts` (auth config / browser Supabase)
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
