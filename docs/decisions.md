# Decision log

A running record of the **major** decisions on this project — the ones worth not
re-litigating. Lightweight ADR style. Append a new entry whenever a significant
choice is made; don't rewrite history (supersede instead).

**Format:** `## NNN — Title` · date · **Decision** · **Why** · (optional) **Status**.
Status defaults to *Accepted*; mark *Superseded by NNN* rather than deleting.

---

## 001 — npm workspaces monorepo (backend + frontend)
*2026-05-28*

**Decision:** Single repo with two npm workspaces, `backend/` and `frontend/`,
managed from a root `package.json`.

**Why:** One install, one place to run both dev servers, shared tooling and a
shared `.env`. Small team / single app — the overhead of separate repos isn't
worth it.

## 002 — Backend: Fastify + Prisma + SQLite
*2026-05-28*

**Decision:** Fastify 5 (ESM) for the API, Prisma 6 as the ORM, SQLite as the
database.

**Why:** Fast to scaffold and run locally; Prisma gives typed queries and
migrations; SQLite means zero external services for dev. Swappable to Postgres
later via Prisma's datasource (the choice is intentionally not load-bearing).

## 003 — Single `.env` at the repo root
*2026-05-28*

**Decision:** Both workspaces read one `.env` at the repo root. The backend loads
it via `backend/src/env.ts` regardless of the current working directory.

**Why:** Avoids drift between two env files and surprises about which one is
loaded. See [development.md](./development.md) for the variable reference.

## 004 — Auth: JWT + bcrypt, user-scoped routes
*2026-05-28*

**Decision:** Register/login issue a JWT (`@fastify/jwt`) carrying `{ sub, email }`;
passwords hashed with `bcryptjs`. Project/intake routes are protected and scoped to
the authenticated user.

**Why:** Stateless auth that fits a SPA + JSON API without a session store. Details
and endpoints in [api.md](./api.md).

## 005 — AI intake analysis via the OpenAI SDK
*2026-05-28*

**Decision:** Intake records are analyzed by the OpenAI SDK to produce a summary,
tags, and a risk checklist; the API key comes from the root `.env`.

**Why:** Turning free-text intake into structured triage is the app's core value.
Prompt, schema, and error handling are documented in [ai.md](./ai.md).

## 006 — Frontend: React + Vite + Tailwind + shadcn-style UI + React Router
*2026-05-28*

**Decision:** React 18 + Vite 6, Tailwind 4 for styling with shadcn-style
components (on `@base-ui/react`), React Router 7 for client routing.

**Why:** Fast HMR dev loop, accessible component primitives, and conventional
client-side routing for the auth/dashboard flows.

## 007 — Docs are versioned and kept in sync by a post-commit hook
*2026-05-28*

**Decision:** Living docs live in `docs/`. A versioned `post-commit` git hook
(`.githooks/`, installed via `prepare`) **reminds** when watched source changes
land without a docs update. It only warns — never blocks or amends.

**Why:** Keep docs honest without gating commits. Post-commit (not pre-push) so the
reminder is immediate and local; chosen over auto-generation to keep it
deterministic and dependency-free. See [development.md](./development.md#git-hooks--keeping-docs-in-sync).

## 008 — Live preview + Playwright MCP for in-the-loop verification
*2026-05-28*

**Decision:** Run the dev servers live (Vite HMR) and use the Playwright MCP plugin
to drive a real browser, so changes can be watched and verified against the specs
while being built.

**Why:** Catch UI/behaviour regressions early against [api.md](./api.md), not just
at the unit level. Workflow in [preview-and-verification.md](./preview-and-verification.md).

## 009 — Frontend tests: Vitest (component) + Playwright (e2e), both API-mocked
*2026-05-28*

**Decision:** Two layers — Vitest + React Testing Library for component state
machines, Playwright for full-flow e2e. Both **mock the API** (no backend/DB
needed) and focus on **state transitions**, especially `idle → submitting → error
→ recovery → success`.

**Why:** Component tests are fast and isolate a component's states; e2e proves real
routing/navigation and error recovery across pages. Mocking keeps both
deterministic. Guide: [testing.md](./testing.md).

## 010 — Keep a decision log
*2026-05-28*

**Decision:** Record major decisions in this file; reference it from
[`CLAUDE.md`](../CLAUDE.md) so any session (human or Claude) records and reads them.

**Why:** Decisions made in chat are otherwise invisible to future sessions and get
silently reversed. One short append per major call keeps the rationale findable.

## 011 — Docker: two images + Compose, nginx reverse proxy, persistent SQLite volume
*2026-05-28*

**Decision:** Containerize as two multi-stage images — `backend/` (compile TS →
`node dist/index.js`) and `frontend/` (Vite build → served by **nginx**) — wired by a
root `docker-compose.yml`. nginx reverse-proxies `/api/*` to the backend over the
Compose network, so the frontend is built same-origin (`VITE_API_URL=""`) and only
port **8080** is published. The backend applies `prisma migrate deploy` on startup
via `docker-entrypoint.sh`. SQLite persists at `/data/app.db` on the `prospect-db`
named volume (`DATABASE_URL=file:/data/app.db`), surviving `down`/`up`.

**Why:** `docker compose up --build` should "just run the app" with data that
outlives container restarts. The reverse proxy gives a single entry point with no
CORS hop and nothing hard-coded to `localhost`, so it's portable across hosts (vs.
exposing the backend and baking `http://localhost:3000` into the bundle). A named
volume is the standard way to keep SQLite across container removal. `migrate deploy`
(not `migrate dev`) is the non-interactive, production-safe migration path. Compose
reads the existing root `.env` for secret substitution, preserving decision
[003](#003--single-env-at-the-repo-root). Setup: [development.md](./development.md#running-with-docker).

## 012 — AI analysis runs on creation; logged to IntakeAnalysisRequest
*2026-05-28*

**Decision:** Run AI analysis as part of intake creation rather than as a manual,
detail-page step. `POST /api/intakes` persists the intake **first**, then calls
OpenAI (`backend/src/ai.ts`) and saves the result. If the call fails, the endpoint
still returns `201` with the saved intake plus an `analysisError`; the create UI
then shows a recoverable error (Retry / Continue without analysis / Cancel) with no
data loss. `POST /api/intakes/:id/analyze` remains as the retry/regenerate path, and
the detail view no longer auto-runs analysis. Every attempt that issues a request is
recorded in a new `IntakeAnalysisRequest` table (model, schema, prompts, raw
response, status/error, `startedAt`/`completedAt`/`durationMs`). The system prompt
and example were re-framed for **software-development project requests at an
enterprise software company** (incl. AI-acceleration work), superseding the earlier
bond-project framing.

**Why:** Analysis is the core value of the triage tool, so it should happen
automatically — but persisting before calling the model guarantees user input is
never lost to an OpenAI hiccup, which is the property we care about most. Returning
the error on the (successful) creation lets the client offer retry without re-typing.
Keeping the final analysis denormalized on `Intake` while logging each attempt
separately trades disk for observability: we can measure response times and inspect
exactly what was sent/returned while we iterate on the prompt and schema. See
[ai.md](./ai.md).

## 013 — Light/dark theme: class on <html>, localStorage, pre-paint script
*2026-05-28*

**Decision:** A `ThemeProvider` (`frontend/src/lib/theme.tsx`) toggles a `dark`
class on `<html>` and persists the choice to `localStorage` (`intake_theme`),
defaulting to the OS preference (`prefers-color-scheme`). A tiny **inline script in
`index.html`** applies the saved/system theme *before first paint* to avoid a
flash of the wrong theme. The toggle lives in the account dropdown.

**Why:** Tailwind 4's dark variant keys off the `dark` class, so a single class on
the root is the least-magic approach and works with the existing shadcn tokens.
localStorage + system fallback is the conventional, dependency-free pattern. The
pre-paint script is the standard fix for the dark-mode "flash"; the storage key is
deliberately duplicated in `index.html` and `theme.tsx` with a comment to keep them
in sync. `getInitialTheme()` guards `matchMedia` so it also runs under jsdom in
tests, and `renderWithRouter` wraps `ThemeProvider` so components using `useTheme`
render in tests.

## 014 — In-app change-password (re-auth, sign out after)
*2026-05-28*

**Decision:** Authenticated users can change their password via
`POST /api/auth/change-password`, which **requires the current password**, enforces
the same ≥8-char rule as registration and that the new password differs, then
returns `204`. The client (`ChangePasswordDialog`, reached from the account
dropdown) **signs the user out and redirects to `/login`** on success. Other
existing sessions keep their old JWT until it expires — accepted for this app.

**Why:** Requiring the current password prevents a hijacked session from silently
locking out the owner. Signing out afterwards gives a clear "use your new password"
moment without building token-revocation/refresh infrastructure; since JWTs are
stateless (decision [004](#004--auth-jwt--bcrypt-user-scoped-routes)), proper
invalidation of *other* sessions would need a token store/blocklist — deferred as
out of scope. Client-side confirm + length checks mirror the server so errors are
caught early, but the server remains authoritative.

## 015 — Collaborative intakes (read-any, analyze-own) + dev seed
*2026-05-28*

**Decision:** Intakes became a **shared** workspace rather than strictly
per-user. `GET /api/intakes` now returns **every** intake (each with its `user`
creator), and `GET /api/intakes/:id` is readable by **any** signed-in user.
Mutation stays owner-only: `POST /api/intakes/:id/analyze` returns **403** unless
the caller is the creator. The list UI splits **My intakes** from **All other
intakes**, with a per-creator filter, title/industry search, and date sort;
non-owners see a read-only detail (no Generate/Regenerate). Added
[`backend/prisma/seed.ts`](../backend/prisma/seed.ts) (5 users, ~12 intakes over
~5 years, a few left un-analyzed, baked-in analysis so no API key is needed),
wired via `prisma.seed` so it runs on `db:migrate`/`db:reset` and on demand via
`db:seed`.

**Why:** The product is a team triage tool — people should be able to browse one
another's requests, but only the owner should spend an OpenAI call on theirs.
Returning the creator inline keeps the "mine vs. theirs" split a pure client-side
comparison (no extra endpoint). Ownership is still enforced **server-side** on
analyze; the hidden frontend buttons are just UX. The seed gives the filtering/
sorting/empty-state UI realistic data to exercise without manual setup, and the
fixed-id, destructive-idempotent design keeps re-runs predictable.

## 016 — AI analysis runs asynchronously; client polls for the result
*2026-05-28*

**Decision:** `POST /api/intakes` no longer blocks on the OpenAI call. It persists
the intake and returns **`201` immediately** with `analyzedAt: null` (analysis
pending); the analysis is kicked off **in-process, unawaited**, and writes its
result back onto the `Intake` when it completes. The frontend navigates straight to
the detail page (the intake already exists) and **polls `GET /api/intakes/:id`** on
a modest interval until a terminal state — `analyzedAt` set (success) or
`analysisError` present (failure) — with a cap (~30s) after which it surfaces the
existing owner-only `POST /api/intakes/:id/analyze` **Retry** path. This refines the
synchronous-on-creation behaviour of decision
[012](#012--ai-analysis-runs-on-creation-logged-to-intakeanalysisrequest): analysis
*still runs on creation*, just not on the request's critical path.

**Chosen over WebSockets and SSE.** Both push transports were rejected for now on
two stack-specific grounds, not raw protocol difficulty: (1) auth is a JWT sent as
an `Authorization: Bearer` header (`frontend/src/lib/api.ts`), and neither the native
`EventSource` nor the WebSocket handshake can set request headers — both would force
a token-in-query-string or cookie workaround that leaks/complicates the JWT; and (2)
the app is a **single Node process** with no job runner, so push would need an
in-memory `userId → connection` registry that dies on restart and doesn't scale past
one process. Polling reuses the existing endpoint and Bearer auth verbatim, holds no
server-side connection state, survives a restart for free (the next poll just
re-reads the DB), and is trivial to exercise with the existing API-mocked test
fixtures (decision [009](#009--frontend-tests-vitest-component--playwright-e2e-both-api-mocked)).
For a 3–5s operation, the only thing push buys is sub-interval latency — not worth
the auth compromise and connection bookkeeping.

**Durability caveat (accepted):** an unawaited in-process job is lost if the process
restarts mid-analysis, leaving the intake stuck at `analyzedAt: null` with no error.
The recovery path is the existing `/analyze` retry (surfaced after the poll cap); a
crash-safe queue (BullMQ/Redis) is deliberately **out of scope** at this scale.

**Revisit when** we want richer progress state than "pending → done/failed" — e.g.
streaming `started → calling OpenAI → awaiting response → done` to the UI. At that
point a persistent push channel (SSE first, given it's one-directional and simpler;
WebSockets if we end up needing bidirectional) becomes worth the cost, and this
decision should be superseded rather than stretched.

## 016 — Visual identity: indigo accent, SVG logo mark, motion system
*2026-05-28*

**Decision:** Gave the previously all-neutral UI a single **indigo brand accent**
(`--primary` / `--ring`, tuned per theme) that cascades to primary buttons, links,
focus rings, and the section count pills — applied sparingly, not as fills
everywhere. Added an inline-SVG **logo mark** ([`LogoMark.tsx`](../frontend/src/components/LogoMark.tsx))
— a "triage stack" of three tapering lines + a verdict diamond, drawn with
`currentColor` — used in the header/auth lockups and, in its `animate` variant, as
the **loading indicator** during AI analysis (stroke-dasharray draw + breathe).
Status pills now encode state by **icon + text + solid AA-contrast tint** (not color
alone). Introduced light entrance/transition motion (dialog easing, page fade,
create-flow phase transition) and a global `prefers-reduced-motion` guardrail in
`index.css`. Also fixed an a11y regression: intake table rows are now keyboard-
operable via a stretched title `<Link>` (no `onClick` on `<tr>`), and tables are
`aria-labelledby` their section heading.

**Why:** A team design review (UI/UX/a11y/motion lenses) found the app read as
"default shadcn" — no hue, generic. One restrained accent + a distinctive mark adds
identity without clutter. Reusing the *same* SVG for branding and the loading state
ties the identity to a moment users actually wait through (the OpenAI call).
Encoding status by icon+text keeps it legible for color-blind users and the solid
tints satisfy WCAG AA where the earlier opacity tints were borderline. The reduced-
motion guardrail keeps all of the above safe for vestibular users.

## 017 — Async analysis reliability: status enum, auto-retries, re-analyze cap, rate limiting
*2026-05-28*

**Decision:** Implemented the async/polling flow from "016 — AI analysis runs
asynchronously" with explicit lifecycle and cost/reliability guardrails:

- **`Intake.analysisStatus` enum** (`pending` | `processing` | `completed` |
  `failed`) plus persisted `analysisError`. Polling reads `analysisStatus` directly;
  `pending` is the idle/never-analyzed state (owner can Generate), `processing`
  drives the spinner + poll. `POST /api/intakes` returns `201` immediately
  (`processing`) and `POST /:id/analyze` returns `202`; the client polls
  `GET /:id` until terminal (cap ~60s in the UI, then a soft "taking longer" +
  manual recheck — the job is not cancelled).
- **Automatic retries (background):** OpenAI SDK `timeout: 30s` + `maxRetries: 2`
  for transient transport errors, plus an outer loop (`MAX_ANALYSIS_ATTEMPTS = 3`)
  that re-runs on *retryable* outcomes (transport, or empty/invalid/wrong-shape
  output). Terminal failures (missing key `503`, `4xx`) are not retried. `ai.ts`
  classifies each outcome with a `retryable` flag; every attempt is logged to
  `IntakeAnalysisRequest`.
- **Single-flight guard:** an in-memory `Set` of in-flight intake ids prevents two
  concurrent runs on one intake (`/analyze` → `409` while active). In-memory by
  design so a job lost to a restart can be retried afterwards (a stale `processing`
  in the DB must not block retry).
- **Per-intake re-analyze cap:** `analysisRunCount` capped at `MAX_REANALYSIS = 3`
  (the on-create run is free). `/analyze` returns `429` past the cap; the detail UI
  shows an "N analyses left" countdown and disables the button at zero. The constant
  is duplicated in `backend/src/routes/intakes.ts` and `frontend/src/lib/api.ts`
  (server authoritative; client value is display-only).
- **Endpoint rate limiting:** `@fastify/rate-limit` (`global: false`), per-route on
  the two OpenAI-spending endpoints — `POST /api/intakes` 30/min, `/analyze` 10/min,
  keyed by client IP.

**Why:** Once analysis is a fire-and-forget background job, the client needs an
unambiguous, *persisted* way to tell pending from failed (a plain `analyzedAt: null`
can't), so an explicit status enum beats inference. Retrying transient
OpenAI/transport blips automatically (without surfacing an error) is the whole point
of moving off the request's critical path — but it must be bounded and must not
retry the unfixable, hence the `retryable` classification and the attempt cap. Cost
is the real risk of an AI feature: the per-intake cap stops a user re-rolling the
same intake forever (with a visible countdown), and IP rate limiting caps burst
spend across intakes; together they bound spend without a usage-metering system.
Keeping the single-flight guard in memory (not a DB lock) is the pragmatic fit for a
single-process app and keeps crash recovery simple. See
[ai.md](./ai.md) and [api.md](./api.md#rate-limiting).

## 018 — Product name: "Prospect"
*2026-05-28*

**Decision:** Named the product **Prospect** (tagline *"Appraise every opportunity"*),
replacing the working title "Project Intake". The rename covers the brand surface
only: the README banner, UI wordmark (header + auth lockup) and page title, the
`LogoMark` concept, the root `package.json` name/description, the workspace package
names (`@prospect/backend`, `@prospect/frontend`), the Docker Compose project name
(`name: prospect`) and DB volume (`prospect-db`), and the prose product-name mentions
across `docs/` and `CLAUDE.md`.

Deliberately **not** renamed: the **`Intake` domain model** and everything keyed to
it — the `intake`/`intakes` routes, Prisma schema, types, the AI prompt, and
empty-state copy that uses "project intake" as a common noun. Prospect is the app
that captures and triages *project intakes*; the entity keeps its name. The
internal `pi-*` CSS/animation class prefix and the `intake_theme` localStorage key
were also left as-is (invisible, and churning them risks the live animation /
resets users' theme).

**Why:** "Project Intake" is descriptive but flat. "Prospect" names the value — each
incoming request is an opportunity to be appraised — and reuses the existing logo
beautifully: raw requests funnel down to a single diamond, now the hero of the mark
(the surfaced gem). Scoping the rename to branding keeps a high-risk find-and-replace
out of the data model and API, so nothing downstream breaks.

## 019 — Analytics dashboard (Recharts + a stats endpoint)
*2026-05-28*

**Decision:** Added a second top-level view — an analytics **Dashboard** at
`/dashboard` — alongside the intake list. Specifics:

- **Charts use [Recharts](https://recharts.org/) (2.x).** The page is **lazy-loaded**
  (`React.lazy` in `App.tsx`) so the d3/Recharts bundle only loads when the dashboard
  is opened, keeping the list/detail/auth views light.
- **A new server-side endpoint, `GET /api/intakes/stats`**, aggregates the numbers
  (rather than computing them in the browser from the list payload). It returns
  totals, status/tag/industry breakdowns, a leaderboard, and a per-day timeline.
- **Stats are global**, matching the already-collaborative list — every signed-in
  user sees the same team-wide numbers. The **leaderboard** (intakes per person) adds
  a light gamification angle and fits that model.
- **Three export paths:** per-chart **PNG** (serialize the chart `<svg>` to a canvas —
  see `lib/exportChart.ts`), a full-report **print → PDF** (a `@media print` block +
  `.pi-no-print`/`.pi-report-section` classes; no PDF library), and raw aggregated
  data as **CSV/JSON** (`lib/exportData.ts`).
- **Chart colors are resolved to concrete strings at runtime** from the design tokens
  via `useChartColors()` (keyed on `useTheme`), because a CSS `var(--x)` reference does
  **not** survive the SVG→canvas serialization used for PNG export. Bars/line use the
  indigo accent; the analyzed/not-analyzed donut uses the same emerald/amber as the
  list's status pills. Recharts animation is disabled (`isAnimationActive={false}`) —
  the global `prefers-reduced-motion` guard only covers CSS, and a still chart makes
  PNG capture deterministic.
- **Nav:** the wordmark keeps linking home (the list); a single **Dashboard**
  `NavLink` is the only addition, its active state shown with the sanctioned accent
  pill (`bg-primary/10 text-primary`, the same emphasis token as the section count
  badges) so the current view reads clearly.

**Why:** The data was all there but invisible — a dashboard surfaces status/tag/people
counts at a glance. A server-side stats endpoint keeps intake descriptions off the
wire and scales past the point where shipping the whole list to aggregate in the
browser is reasonable. Recharts is the least-effort path to themeable, accessible
charts; lazy-loading contains its bundle cost. Hand-rolling exports (canvas PNG +
`window.print()` + Blob downloads) avoids three more dependencies. Resolving tokens to
concrete colors is the one non-obvious requirement — without it, exported PNGs come
out uncolored. See [api.md](./api.md), [styleguide.md](./styleguide.md), and
[testing.md](./testing.md).

## 020 — List: tags are searchable, surfaced only on match (no tag column)
*2026-05-28*

**Decision:** AI tags are now part of the intake-list **search haystack**
(`matchesSearch` in `IntakeList.tsx`), alongside title/industry/creator — so
searching a tag like `fintech` finds its intakes. Tags are **not** shown as a
column by default; instead, when the active search matches a row's tag(s), just
those matching tag(s) are revealed inline under the title as static
`Badge variant="secondary"` chips (with a muted "matched" label). The search
placeholder advertises tags. No backend change — `tags` already ships inline on
each intake.

**Why:** Searching tags was simply missing (they were never in the haystack). For
display we deliberately rejected two alternatives: a **tags column** (a row of
colored badges is too loud and fights the neutral table aesthetic — styleguide §1)
and a **tag count** (near-constant at 3–5, and a number can't tell you *which* tag
matched — failing the actual goal). The contextual reveal shows tags exactly when
they explain why a row is in your filtered results, keeps the default list clean,
and uses **static** chips so it doesn't add a second interactive element to the row
(preserving the one-stretched-link rule, styleguide §4). Recorded in
[styleguide.md](./styleguide.md) §4.

## 020 — Account profile page
*2026-05-28*

**Decision:** Added a read-only **Profile** view at `/profile`, reachable from the
account dropdown (a new "Profile" item above the theme/password/sign-out actions). It
shows the signed-in user's **name**, **email**, and **member-since** date. To support
it, `publicUser()` in `backend/src/routes/auth.ts` now includes `createdAt`, so
`register`/`login`/`me` all return it; the frontend `User` type and `auth.tsx` carry
it through (no extra fetch — the page reads the existing auth session). See
[api.md](./api.md#authentication).

**Why:** With multiple seeded accounts sharing one password, there was no in-app way
to confirm *which* email you're signed in as before logging out and back in — the
session held the data but never surfaced it. A tiny profile view closes that gap.
`createdAt` already existed on the `User` model; exposing it is a one-field addition
with no schema change, and "member since" is the natural third detail to round out
the page.

## 021 — Repo hardening: CI, CodeQL, dependency review & Dependabot
*2026-05-28*

**Decision:** Added a `.github/` supply-chain + CI baseline:

- **CI** (`workflows/ci.yml`) — on push/PR to `main`: `build-and-test` (npm ci →
  `prisma generate` → `npm run build` (type-checks both workspaces) → Vitest) and a
  separate `e2e` job (Playwright/chromium). Both required for merge.
- **CodeQL** (`workflows/codeql.yml`) — `javascript-typescript`,
  `security-and-quality` queries, on push/PR + weekly cron.
- **Dependency review** (`workflows/dependency-review.yml`) — fails PRs adding
  deps with **high+** severity advisories; posts a summary comment.
- **Dependabot** (`dependabot.yml`) — npm (root workspaces), docker (both
  Dockerfiles), and github-actions. **Weekly** (Mon 06:00 Europe/Lisbon),
  **grouped** (minor+patch batched; majors separate), with a **cooldown** so
  releases settle before a PR opens: patch 7d / minor 14d / major 30d.
- All third-party actions are **pinned to commit SHA** (with a `# vN` comment so
  Dependabot's github-actions updater keeps them current); `step-security/harden-runner`
  audits egress; workflow `permissions` default to `contents: read`.
- Added `SECURITY.md` (private advisory reporting) and `CODEOWNERS`.
- GitHub-side: branch protection on `main` (require PR + the CI checks, dismiss
  stale reviews, require conversation resolution, block force-push/deletion;
  admins not enforced so the solo owner keeps an escape hatch), plus Dependabot
  alerts/security-updates, secret scanning, and push protection enabled.

**Why:** The repo had no CI or supply-chain controls at all. The cooldown ("bounce
days") avoids churning on releases that get yanked or hot-patched within days, and
weekly grouping keeps PR noise to ~a handful per week instead of one-per-dependency.
SHA-pinning closes the mutable-tag supply-chain hole while Dependabot keeps the pins
fresh, so pinning doesn't rot. Majors are deliberately *not* grouped with patches so
a breaking bump can't block a routine security patch from merging.
