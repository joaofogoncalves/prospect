```
██████╗ ██████╗  ██████╗      ██╗███████╗ ██████╗████████╗
██╔══██╗██╔══██╗██╔═══██╗     ██║██╔════╝██╔════╝╚══██╔══╝
██████╔╝██████╔╝██║   ██║     ██║█████╗  ██║        ██║
██╔═══╝ ██╔══██╗██║   ██║██   ██║██╔══╝  ██║        ██║
██║     ██║  ██║╚██████╔╝╚█████╔╝███████╗╚██████╗   ██║
╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚══════╝ ╚═════╝   ╚═╝

██╗███╗   ██╗████████╗ █████╗ ██╗  ██╗███████╗
██║████╗  ██║╚══██╔══╝██╔══██╗██║ ██╔╝██╔════╝
██║██╔██╗ ██║   ██║   ███████║█████╔╝ █████╗
██║██║╚██╗██║   ██║   ██╔══██║██╔═██╗ ██╔══╝
██║██║ ╚████║   ██║   ██║  ██║██║  ██╗███████╗
╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
```

> Capture project intake requests and let AI triage them — summary, tags, and a risk checklist.

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-structured%20outputs-412991?logo=openai&logoColor=white)

---

## What is this?

**Project Intake** is a small, full-stack TypeScript app for capturing incoming
project requests and triaging them with AI. You sign in, fill out a short intake
form (title, description, budget, timeline, industry), and the app immediately
calls OpenAI to generate a **plain-language summary**, a set of **tags**, and a
**risk checklist** to help you assess the request.

It's built as a realistic but compact reference app: JWT auth, a relational data
model, graceful AI error handling, an analysis audit log, a tested React UI with
light/dark themes, and a one-command Docker deployment.

### What it does

- 🔐 **Accounts & auth** — register / log in (JWT). Intake routes are protected.
- 📝 **Capture intakes** — a 5-field form persists each request before anything else.
- 🤖 **AI triage on creation** — every new intake is sent to OpenAI for a summary,
  tags, and a risk checklist via **strict structured outputs**. The intake is saved
  *first*, so a failed analysis never loses your input — you can **retry** or
  **continue without analysis**.
- 👥 **Collaborative** — any signed-in user can browse every intake (the UI splits
  "mine" from "the rest"); only the **creator** can run or regenerate analysis.
- 📊 **Observability** — every analysis attempt (prompts, model, timing, outcome) is
  logged to an `IntakeAnalysisRequest` table for auditing.
- 🌓 **Polished UI** — React + Tailwind, shadcn-style components, light/dark theme,
  loading / empty / error states, and `prefers-reduced-motion` support.
- 🧪 **Tested** — Vitest component tests + Playwright end-to-end (both mock the API,
  so they're deterministic and need no backend or seeded DB).
- ✅ **Degrades gracefully** — with no `OPENAI_API_KEY`, the server still boots and
  the app works; analysis just returns `503` until a key is set.

## Tech stack

| Layer | Technology |
| --- | --- |
| **Backend** | [Fastify 5](https://fastify.dev/) (ESM), [Prisma 6](https://www.prisma.io/) ORM over **SQLite** |
| **Frontend** | [React 18](https://react.dev/) + [Vite 6](https://vite.dev/), Tailwind 4, shadcn-style UI, [React Router 7](https://reactrouter.com/) |
| **AI** | [OpenAI](https://platform.openai.com/) SDK — intake analysis via strict `json_schema` structured outputs |
| **Auth** | `@fastify/jwt` + `bcryptjs` |
| **Tests** | [Vitest](https://vitest.dev/) + React Testing Library, [Playwright](https://playwright.dev/) |
| **Tooling** | npm **workspaces** monorepo, TypeScript 5, Docker + nginx |

---

## Quick start (run it locally)

**Prerequisites:** Node.js **≥ 20** and npm **≥ 9**.

```bash
# 1. Install all workspace dependencies (also installs the git hooks)
npm install

# 2. Create your env file, then set OPENAI_API_KEY and a strong JWT_SECRET
cp .env.example .env

# 3. Generate the Prisma client and create the SQLite database
#    (this also seeds sample users + intakes you can log in with)
npm run db:migrate

# 4. Run backend (:3000) + frontend (:5173) together
npm run dev
```

Open **<http://localhost:5173>** and register an account — or, if you seeded the
database, log in as any sample user with the password **`password123`**.

Run one side on its own with `npm run dev:backend` or `npm run dev:frontend`.

> **No OpenAI key yet?** The app still runs — you can create intakes and use every
> screen; AI analysis simply returns a recoverable error until you set
> `OPENAI_API_KEY` in `.env`.

---

## Run it with Docker

The whole stack runs from a single command — no local Node, Prisma, or build step,
just Docker.

```bash
cp .env.example .env          # set JWT_SECRET (and OPENAI_API_KEY for AI analysis)
docker compose up --build     # builds both images and starts everything
```

Then open **<http://localhost:8080>**. That's the only port exposed: nginx serves
the built frontend and reverse-proxies `/api/*` to the backend over the internal
Docker network — so there's no CORS hop and no hard-coded `localhost`.

| Concern | How it's handled |
| --- | --- |
| **Backend** | Multi-stage build → `node dist/index.js`. Migrations (`prisma migrate deploy`) run automatically on startup. |
| **Frontend** | Built with Vite, served by nginx; calls the API same-origin (`/api`). |
| **Database** | SQLite on the `intake-db` named volume (`/data/app.db`) — **survives `down`/`up` and container removal**. |
| **Secrets** | The backend loads the root `.env` directly (`env_file`) — `JWT_SECRET` / `OPENAI_API_KEY` are never duplicated in `docker-compose.yml`. |

```bash
docker compose up --build     # start (rebuild images)
docker compose down           # stop & remove containers — DB volume is kept
docker compose down -v        # also delete the database volume (fresh start)
```

> Compose overrides `DATABASE_URL` (to the volume path) and builds the frontend with
> `VITE_API_URL=""` (same-origin), so those two `.env` values only matter for the
> non-Docker `npm run dev` workflow.

---

## Configuration

The whole app reads a **single `.env` at the repo root** (see
[`.env.example`](./.env.example)). Both workspaces use it; the backend loads it
regardless of the current working directory.

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | for AI | OpenAI API key. Loaded lazily — the server boots without it, but analysis returns `503` until it's set. |
| `OPENAI_MODEL` | no | Model for analysis; default `gpt-4o-mini` (must support structured outputs). |
| `JWT_SECRET` | **yes** | Secret used to sign JWTs. Use a long random string. |
| `DATABASE_URL` | yes | Prisma SQLite connection string; relative paths resolve from `backend/prisma/`. |
| `PORT` / `HOST` | no | Backend server bind address (default `3000` / `0.0.0.0`). |
| `VITE_API_URL` | no | Backend URL the frontend calls (default `http://localhost:3000`). |

## Useful scripts

Run from the repo root:

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend together |
| `npm run dev:backend` / `npm run dev:frontend` | Run a single workspace |
| `npm run build` | Type-check and build both workspaces |
| `npm run test` | Vitest component tests (fast, headless) |
| `npm run test:e2e` | Playwright end-to-end tests (auto-starts Vite) |
| `npm run db:migrate` | Create/apply a Prisma migration, then re-seed |
| `npm run db:seed` | Populate the dev DB with sample users + intakes |
| `npm run db:studio` | Open Prisma Studio to browse the database |
| `npm run db:reset` | Drop, re-migrate, and re-seed the DB (prompts first) |

> First Playwright run only: `cd frontend && npx playwright install chromium`.

## Project structure

```
project_intake/
├── backend/                 # Fastify API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma     # Data model: User, Intake, IntakeAnalysisRequest
│   │   ├── migrations/       # Generated SQL migrations
│   │   └── seed.ts           # Sample users + intakes for local dev
│   └── src/
│       ├── index.ts          # Server entry — CORS, auth plugin, route modules
│       ├── auth.ts           # JWT plugin + `authenticate` preHandler
│       ├── ai.ts             # OpenAI analysis service (strict json_schema)
│       ├── routes/           # auth.ts (register/login/me) + intakes.ts
│       ├── db.ts             # Prisma client singleton
│       └── env.ts            # Loads + validates the single root .env
├── frontend/                # React + Vite app
│   ├── src/
│   │   ├── pages/            # Login, Register, IntakeList, IntakeDetail, IntakeCreate
│   │   ├── components/       # Layout, AuthForm, shared states, shadcn-style ui/
│   │   └── lib/              # api, auth, theme, useQuery
│   └── e2e/                  # Playwright specs + fixtures
├── docs/                    # Living documentation (see below)
├── docker-compose.yml       # One-command full stack
├── .env.example             # Copy to .env
└── package.json             # Workspace root + scripts
```

## API at a glance

Base URL `http://localhost:3000`. 🔒 = requires `Authorization: Bearer <token>`.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check (public) |
| `POST` | `/api/auth/register` · `/api/auth/login` | Create account / sign in — returns a JWT |
| `GET` | `/api/auth/me` 🔒 | The authenticated user |
| `POST` | `/api/auth/change-password` 🔒 | Change password (requires current one) |
| `GET` | `/api/intakes` 🔒 | List all intakes, newest first |
| `POST` | `/api/intakes` 🔒 | Create an intake **and run AI analysis** |
| `GET` | `/api/intakes/:id` 🔒 | Get one intake |
| `POST` | `/api/intakes/:id/analyze` 🔒 | Re-run analysis (creator only) |

Full request/response details: [`docs/api.md`](./docs/api.md) · AI prompt & schema:
[`docs/ai.md`](./docs/ai.md).

## Documentation

Living docs are in [`docs/`](./docs/):

| Doc | Contents |
| --- | --- |
| [architecture.md](./docs/architecture.md) | Stack, repo layout, request flow, data model, views |
| [api.md](./docs/api.md) | HTTP endpoints and payloads |
| [ai.md](./docs/ai.md) | Intake AI analysis: prompt, schema, error handling |
| [development.md](./docs/development.md) | Setup, running, scripts, environment variables |
| [testing.md](./docs/testing.md) | Vitest + Playwright; how to add tests |
| [styleguide.md](./docs/styleguide.md) | UI design principles: color, type, components, motion, a11y |
| [decisions.md](./docs/decisions.md) | Decision log — the major calls and why |

Working in this repo with Claude Code? See [`CLAUDE.md`](./CLAUDE.md).
