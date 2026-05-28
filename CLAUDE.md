# CLAUDE.md

Guidance for working in this repository with Claude Code. See [`docs/`](./docs/)
for the full, living documentation and [`README.md`](./README.md) for the short
public overview.

## What this project is

**Prospect** — a full-stack TypeScript app that captures project intake
requests and uses AI to triage them (summary, tags, risk checklist). npm
**workspaces** monorepo:

- **`backend/`** — [Fastify 5](https://fastify.dev/) API (ESM) + [Prisma 6](https://www.prisma.io/) ORM over **SQLite**.
- **`frontend/`** — [React 18](https://react.dev/) + [Vite 6](https://vite.dev/), Tailwind 4, shadcn-style UI, [React Router 7](https://reactrouter.com/).
- **AI:** [OpenAI](https://platform.openai.com/) SDK — intake analysis via strict structured outputs (`backend/src/ai.ts`), run **on creation**; every call is logged to `IntakeAnalysisRequest` for observability. See [`docs/ai.md`](./docs/ai.md).
- **Auth:** JWT (`@fastify/jwt`) + `bcryptjs` — register/login issue a token; intake routes are protected and **user-scoped**.

## Running it

```bash
npm install                # installs all workspaces + git hooks (prepare script)
cp .env.example .env       # then set OPENAI_API_KEY and a strong JWT_SECRET
npm run db:migrate         # generate Prisma client + create SQLite db

npm run dev                # backend (:3000) + frontend (:5173) together
```

Run one side with `npm run dev:backend` / `npm run dev:frontend`. Full details,
scripts, and env-var reference: [`docs/development.md`](./docs/development.md).

## Live preview & verifying the UI

**Before changing any UI, read [`docs/styleguide.md`](./docs/styleguide.md) and follow
it** — accent/color rules, typography, component & table patterns, the `LogoMark`,
motion + `prefers-reduced-motion`, and accessibility. New UI must stay consistent with
it; when you make a deliberate design change, update the styleguide in the same commit.

Frontend runs at <http://localhost:5173> (Vite HMR), backend at <http://localhost:3000>
(`tsx watch`) — both hot-reload, so you can watch the app build live. Run them in the
background so you can keep working:

```bash
npm run dev:backend  > /tmp/pi_backend.log  2>&1 &
npm run dev:frontend > /tmp/pi_frontend.log 2>&1 &
lsof -iTCP:3000 -iTCP:5173 -sTCP:LISTEN -P   # confirm both are listening
```

**Use the browser sparingly.** Reach for Playwright only to verify *substantial or
complex* UI changes (a new view, a non-trivial interaction/flow) — and then with a
*few* purposeful steps, not a screenshot after every action. For routine work, rely
on the type-check, the Vitest/Playwright test suites, and reading the code; the
maintainer can see the running app themselves. Don't narrate the UI step by step.

To **verify the running UI in a real browser**, use the `playwright` plugin's MCP
tools (`mcp__plugin_playwright_playwright__browser_*`; run `/reload-plugins` if absent):
`browser_navigate` → `browser_snapshot` (decide actions) → drive with
`browser_click`/`browser_type`/`browser_fill_form` → `browser_take_screenshot` (Read the
PNG) → `browser_console_messages` (catch errors). Check behavior against
[`docs/api.md`](./docs/api.md). Artifacts land in `.playwright-mcp/` (gitignored).

Full workflow, smoke tests, and a known-good baseline:
[`docs/preview-and-verification.md`](./docs/preview-and-verification.md).

## Layout & key files

```
backend/src/index.ts             Server entry — registers CORS, auth plugin, route modules
backend/src/auth.ts              JWT plugin + `authenticate` preHandler (sets request.user)
backend/src/ai.ts                OpenAI analysis service (strict json_schema)
backend/src/routes/auth.ts       register / login / me / change-password
backend/src/routes/intakes.ts    protected, user-scoped intake CRUD + analyze
backend/src/db.ts                Prisma client singleton
backend/src/env.ts               Loads the SINGLE root .env, validates required vars
backend/prisma/schema.prisma     Data model (User, Intake, IntakeAnalysisRequest)
frontend/src/App.tsx             Routes: login / register / protected intake + dashboard views
frontend/src/pages/              Login, Register, IntakeList, IntakeDetail, IntakeCreate, Dashboard, Profile
frontend/src/pages/Dashboard.tsx Analytics dashboard (/dashboard, lazy) — Recharts stats + PNG/CSV/JSON/print export
frontend/src/lib/auth.tsx        AuthProvider / useAuth (token in localStorage)
frontend/src/lib/theme.tsx       ThemeProvider / useTheme (light/dark, localStorage)
frontend/src/lib/api.ts          fetch wrapper + intakes API (incl. stats) + authApi
frontend/src/lib/useChartColors.ts   token→concrete colors for Recharts; exportChart.ts / exportData.ts  export helpers
frontend/src/lib/useQuery.ts     async data hook (loading / error / reload)
frontend/src/components/states.tsx   shared Loading / Empty / Error UI
docs/                            Living documentation (keep in sync — see below)
.githooks/post-commit            Docs-sync reminder hook
```

## Conventions

- **One `.env` at the repo root.** Both workspaces read it; the backend loads it
  via `backend/src/env.ts` regardless of cwd. Don't add per-package `.env` files.
- **ESM + NodeNext.** Backend uses `"type": "module"`; relative imports include the
  `.js` extension (e.g. `import { env } from "./env.js"`) even though sources are `.ts`.
- **Database changes** go through Prisma: edit `schema.prisma`, then
  `npm run db:migrate`. `backend/prisma/dev.db` is local and gitignored — and holds
  real test data: **never reset/wipe it without asking** (see House rules).
- **Data is user-scoped.** Intake routes filter by `request.user.sub`, and
  `POST /api/intakes` sets `userId` from the token — never trust a client-supplied
  owner. New protected routes go through the `authenticate` preHandler.
- **AI analysis runs on creation.** `POST /api/intakes` persists the intake first,
  *then* calls OpenAI — so a failed analysis never loses the user's input. The
  response carries `analysisError` (and `analyzedAt: null`) for a recoverable error
  state; `POST /api/intakes/:id/analyze` is the retry/regenerate path. Analysis
  degrades gracefully — `503` when `OPENAI_API_KEY` is unset, so the app still boots.
- **Frontend async views** use `useQuery` + `components/states.tsx` for
  loading/empty/error — reuse them instead of hand-rolling each state.
- **Build before assuming types pass:** `npm run build` builds both workspaces.

## Testing

Two frontend test layers, both **deterministic** (they mock the API — no backend or
seeded DB needed):

- **Component** — Vitest + React Testing Library (jsdom): `frontend/src/**/*.test.tsx`
- **E2E** — Playwright (real Chromium, mocked API): `frontend/e2e/*.spec.ts`

```bash
npm run test        # Vitest (fast, headless)
npm run test:e2e    # Playwright (auto-starts vite); first run: cd frontend && npx playwright install chromium
```

Focus tests on **state transitions**, especially `idle → submitting → error →
recovery → success` — assert the error UI (`role="alert"`) *and* that the form
becomes interactive again. Query by role/label, not CSS.

- Component tests: mock `@/lib/api`, render via `renderWithRouter` (`src/test/utils.tsx`),
  use `deferred()` to hold a request open and catch the "submitting" state.
- E2E tests: import `test`/`expect` from `./fixtures`; the `apiMock` fixture queues
  per-endpoint responses (`apiMock.login(401, …)` then `apiMock.login(200, …)` to
  script error→recovery). Add new endpoints in `e2e/fixtures.ts`.
- Test files are excluded from `tsc` (`tsconfig.json`), so they never break the build.

Full guide with copy-paste templates: [`docs/testing.md`](./docs/testing.md).

## Keeping docs in sync

Documentation lives in [`docs/`](./docs/). A versioned **`post-commit`** git hook
([`.githooks/post-commit`](./.githooks/post-commit)) warns when a commit changes
watched source paths (`backend/src`, `backend/prisma/schema.prisma`, `frontend/src`,
the `package.json` files, `.env.example`) without touching `docs/`, `README.md`, or
`CLAUDE.md`. It only reminds — it never blocks or amends.

The hook is installed automatically on `npm install` (root `prepare` script) or
manually via `npm run setup:hooks`. Bypass a single commit with `SKIP_DOCS_CHECK=1`.

**When you change behavior, update the matching doc in the same commit:**

| You changed… | Update… |
| --- | --- |
| Routes / payloads (`backend/src/routes/`) | [`docs/api.md`](./docs/api.md) |
| Data model (`schema.prisma`) | [`docs/architecture.md`](./docs/architecture.md) |
| AI prompt / analysis schema (`backend/src/ai.ts`) | [`docs/ai.md`](./docs/ai.md) |
| Scripts, env vars, setup | [`docs/development.md`](./docs/development.md) |
| Frontend tests / helpers | [`docs/testing.md`](./docs/testing.md) |
| Frontend UI / styles / components (`frontend/src`) | [`docs/styleguide.md`](./docs/styleguide.md) |

## Recording decisions

Major decisions are logged in [`docs/decisions.md`](./docs/decisions.md) (lightweight
ADR style). **Whenever a significant choice is made — a library, an architectural
pattern, a workflow convention — append an entry** (`## NNN — Title`, date, Decision,
Why). Don't rewrite past entries; supersede them. Read this log before reversing an
established choice.

## House rules

- **Never reset, wipe, or delete the dev database without explicit, in-conversation
  permission.** `backend/prisma/dev.db` holds real, hand-made test data. Do **not**
  run `prisma migrate reset`, delete/recreate `dev.db`, or otherwise clear rows —
  even after tests, even to "start clean". If a task seems to need a fresh DB, **ask
  first**. (Forward migrations via `npm run db:migrate` are fine; destroying data is
  not.)
- **Do not run `gh pr merge`** or any merge command without an explicit,
  in-conversation instruction for that specific PR. Green CI is not authorization to
  merge.
