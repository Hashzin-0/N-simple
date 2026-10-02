# Agronômica N-Pro — Calculadora de Nitrogênio para Milho

Aplicação Next.js 15 (App Router) com calculadora agronômica de adubação
nitrogenada e estimativa de produtividade de milho, assistente de voz
Gemini Live, Tutor Inteligente, mini-curso de Libras e motor semântico de
pesquisa de fontes. Roda como applet do Google AI Studio no Cloud Run /
Vercel. Interface em português (pt-BR).

## Recursos

- **Calculadora N milho** — dose, extração total, necessidade líquida,
  parcelamento e balanço, com memória de cálculo por fórmula
  (`components/metrics/`, `lib/calculations.ts`).
- **Produtividade por estande** — grãos/espiga, PMG e quebra
  (`CornYieldResultCard`).
- **Voz (Gemini Live)** — hub global ↔ Tutor ↔ Libras com session
  resumption (`lib/voiceHub.ts`, `lib/liveSession.ts`, orb em
  `VoiceAssistantHUD`), supressor de ruído por proximidade
  (`lib/noiseGate.ts`) e ~48 tools globais.
- **Tutor Inteligente** — sessões, pesquisa cascata com reuso, documentos
  (PDF/TXT), flashcards SM-2, simulados/quiz/mapas mentais
  (`lib/tutor/**`, `components/TutorInteligente`).
- **Pesquisador de fontes/artigo** — scrapers (OpenAlex, Semantic
  Scholar, CNPEM, YouTube), índice semântico em 2 fases (light → full via
  Inngest) e geração de artigo ABNT (`lib/semantic/**`, `lib/scrapers/**`).
- **Redação** — pesquisa de repertório, geração e validação
  (`components/PesquisadorRedacao`).
- **Libras no Agro** — busca de sinais (YouTube/VLibras), mini-curso com
  progresso, prática com câmera (MediaPipe Hands + DTW) e feedback
  vision via Gemini (`lib/libras-*.ts`, `components/LibrasNoAgro`).
- **Auth** — Supabase (server-side) com Google One Tap opcional e gate de
  aluno ativo do CEFSA (`lib/authConfig.ts`, `lib/cefsa.ts`).

## Stack

| Área | Tecnologia |
|------|-----------|
| Framework | Next.js 15 (App Router, standalone), React 19, TypeScript 5.9 |
| Estilo | Tailwind CSS 4, dark mode por classe `.dark`, `motion/react` |
| IA | `@google/genai` (Gemini Live + text/vision), fallbacks OpenRouter |
| Banco | Supabase (Postgres + pgvector) |
| Jobs | Inngest (fase 2 do semântico), SSE para progresso |
| 3D/WebGL | three.js, `WebGLFallback` |
| Scraping | cheerio, puppeteer-core/stealth (desligado por padrão na Vercel), `@sparticuz/chromium` |
| Voz/WebRTC | Web Audio + worklets (`lib/audioStreamer.ts`), MediaPipe Hands |

## Começando

```bash
npm install
npm run dev   # http://localhost:3000
```

### Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção (standalone + cópia do Chromium) |
| `npm run start` | servidor de produção |
| `npm run lint` | ESLint |
| `npm run clean` | `next clean` |

Sem framework de testes no repo. Testes manuais via `npx tsx`:

- `scripts/test-scrapers.ts` — scrapers (Semantic Scholar deve retornar > 0)
- `scripts/test-embeddings.ts` — orçamento de embeddings
- `scripts/test-cefsa-verify.ts` — verificação CEFSA

### Desenvolvimento local completo

```bash
# Fase 2 do semântico — servidor local do Inngest
npx inngest-cli@latest dev
```

## Estrutura

```
app/            página única (page.tsx) + rotas API (app/api/**)
components/     UI compartilhada (metrics/, TutorInteligente/, LibrasNoAgro/, ...)
hooks/          useGeminiLiveAgent / useTutorLiveAgent / useLibrasLiveAgent
lib/            lógica pura e serviços (calculations, semantic/, tutor/, scrapers/, ...)
supabase/       schemas SQL
scripts/        build e verificações manuais
```

## Deploy

- **Vercel**: `vercel.json` fixa `regions: ["gru1"]` e `maxDuration` por
  rota longa (300s para pesquisa/artigo/tutor/Inngest). Chromium stealth
  fica OFF por padrão na Vercel. Se a função sofrer SIGKILL, aumente a
  memória no dashboard (Fluid Compute não lê memória do `vercel.json`).
- **Produção semântica**: Inngest com as chaves de produção e webhook
  opcional do Supabase → `POST /api/semantic/light-registered`.
- **AI Studio / Cloud Run**: credenciais injetadas em runtime; HMR
  desativado no applet.

## Licença

Privado. Todos os direitos reservados.
