# CLAUDE.md

Guidance for working in this repository with Claude Code. See [`docs/`](./docs/)
for the full, living documentation and [`README.md`](./README.md) for the short
public overview.

## What this project is

**Project Intake** — a small full-stack TypeScript app for capturing and managing
project intake records. npm **workspaces** monorepo:

- **`backend/`** — [Fastify 5](https://fastify.dev/) API (ESM) + [Prisma 6](https://www.prisma.io/) ORM over **SQLite**.
- **`frontend/`** — [React 18](https://react.dev/) + [Vite 6](https://vite.dev/), Tailwind 4, shadcn-style UI.
- **AI:** [OpenAI](https://platform.openai.com/) SDK — key is loaded but not yet wired into a route.
- **Auth:** `@fastify/jwt` + `bcryptjs` present as deps; routes not yet implemented.

## Running it

```bash
npm install                # installs all workspaces + git hooks (prepare script)
cp .env.example .env       # then set OPENAI_API_KEY and a strong JWT_SECRET
npm run db:migrate         # generate Prisma client + create SQLite db

npm run dev                # backend (:3000) + frontend (:5173) together
```

Run one side with `npm run dev:backend` / `npm run dev:frontend`. Full details,
scripts, and env-var reference: [`docs/development.md`](./docs/development.md).

## Layout & key files

```
backend/src/index.ts       Server entry + all route definitions
backend/src/db.ts          Prisma client singleton
backend/src/env.ts         Loads the SINGLE root .env, validates required vars
backend/prisma/schema.prisma   Data model (User, Project)
frontend/src/App.tsx       Project list + create form
docs/                      Living documentation (keep in sync — see below)
.githooks/post-commit      Docs-sync reminder hook
```

## Conventions

- **One `.env` at the repo root.** Both workspaces read it; the backend loads it
  via `backend/src/env.ts` regardless of cwd. Don't add per-package `.env` files.
- **ESM + NodeNext.** Backend uses `"type": "module"`; relative imports include the
  `.js` extension (e.g. `import { env } from "./env.js"`) even though sources are `.ts`.
- **Database changes** go through Prisma: edit `schema.prisma`, then
  `npm run db:migrate`. `backend/prisma/dev.db` is local and gitignored.
- **Build before assuming types pass:** `npm run build` builds both workspaces.

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
| Routes / payloads (`backend/src/index.ts`) | [`docs/api.md`](./docs/api.md) |
| Data model (`schema.prisma`) | [`docs/architecture.md`](./docs/architecture.md) |
| Scripts, env vars, setup | [`docs/development.md`](./docs/development.md) |

## House rule

Do not run `gh pr merge` or any merge command without an explicit, in-conversation
instruction for that specific PR. Green CI is not authorization to merge.
