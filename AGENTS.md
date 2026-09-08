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

Two env vars (see `.env.example`):
- `GEMINI_API_KEY` — injected by AI Studio at runtime from user secrets
- `APP_URL` — injected by AI Studio with Cloud Run service URL

Do not hardcode or commit these. The `.env` file is gitignored.

## Architecture

- **App Router**: `app/page.tsx` is the single-page calculator (client component) — orchestrates layout and passes data, no business logic or UI state in results
- **API Route**: `app/api/gemini/live-token/route.ts` — creates ephemeral tokens for Gemini Live WebSocket
- **Components**: `components/` — shared UI building blocks (3D visualizers, toggles, HUD, modals) with 11 top-level components
- **Components Metrics**: `components/metrics/` — modularized result cards and sections (see Modularization below)
- **Hooks**: `hooks/useGeminiLiveAgent.ts` — manages Gemini Live WebSocket connection and voice agent state (700+ lines)
- **Lib**: `lib/audioStreamer.ts` (audio capture/playback), `lib/pageAutomator.ts` (UI automation for voice agent), `lib/storage.ts` (localStorage-based scenario DB), `lib/types.ts` (shared TypeScript interfaces), `lib/calculations.ts` (pure calculation functions)
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
