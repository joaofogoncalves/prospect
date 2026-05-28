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
via `docker-entrypoint.sh`. SQLite persists at `/data/app.db` on the `intake-db`
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
