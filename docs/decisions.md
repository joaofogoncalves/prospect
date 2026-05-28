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
