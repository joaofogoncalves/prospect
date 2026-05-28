# Project Intake

A full-stack TypeScript app for capturing and managing project intake.

- **Backend:** [Fastify](https://fastify.dev/) + [Prisma](https://www.prisma.io/) ORM with a SQLite database
- **Frontend:** [React](https://react.dev/) + [Vite](https://vite.dev/)
- **AI:** [OpenAI](https://platform.openai.com/) SDK (key configured via `.env`)
- Managed as an **npm workspaces** monorepo

## Project structure

```
project_intake/
├── backend/            # Fastify API + Prisma
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts    # Server entry + routes
│       ├── db.ts       # Prisma client
│       └── env.ts      # Loads root .env
├── frontend/           # React + Vite app
│   └── src/
├── .env.example        # Copy to .env
└── package.json        # Workspace root
```

## Prerequisites

- Node.js >= 20
- npm >= 9

## Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create your environment file and add your OpenAI key
cp .env.example .env
#   then edit .env and set OPENAI_API_KEY

# 3. Generate the Prisma client and create the SQLite database
npm run db:migrate
```

## Running

```bash
# Run backend and frontend together
npm run dev

# …or individually
npm run dev:backend   # http://localhost:3000
npm run dev:frontend  # http://localhost:5173
```

## Running with Docker

The whole stack runs from a single command — no local Node, Prisma, or build step
needed, just Docker.

```bash
cp .env.example .env          # set JWT_SECRET (and OPENAI_API_KEY for AI analysis)
docker compose up --build     # builds both images and starts everything
```

Then open **<http://localhost:8080>**. That's the only port exposed: nginx serves
the built frontend and reverse-proxies `/api/*` to the backend over the internal
Docker network, so there's no CORS hop and nothing hard-coded to `localhost`.

| Concern | How it's handled |
| --- | --- |
| **Backend** | Multi-stage build → `node dist/index.js`. Migrations (`prisma migrate deploy`) run automatically on startup. |
| **Frontend** | Built with Vite, served by nginx; calls the API same-origin (`/api`). |
| **Database** | SQLite on the `intake-db` named volume (`/data/app.db`) — **survives `down`/`up` and container removal**. |
| **Secrets** | `JWT_SECRET` / `OPENAI_API_KEY` are read from the root `.env` by Compose. |

```bash
docker compose up --build     # start (rebuild images)
docker compose down           # stop & remove containers — DB volume is kept
docker compose down -v        # also delete the database volume (fresh start)
```

> Compose overrides `DATABASE_URL` and `VITE_API_URL` for the containers, so those
> two `.env` values only matter for the non-Docker (`npm run dev`) workflow.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend |
| `npm run build` | Build both workspaces |
| `npm run db:migrate` | Create/apply a Prisma migration (dev) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/api/auth/register` · `/api/auth/login` | Auth (returns a JWT) |
| `GET` | `/api/intakes` | List the user's intakes |
| `POST` | `/api/intakes` | Create an intake |
| `GET` | `/api/intakes/:id` | Get one intake |
| `POST` | `/api/intakes/:id/analyze` | Run AI analysis (summary, tags, risk checklist) |

See [`docs/api.md`](./docs/api.md) and [`docs/ai.md`](./docs/ai.md) for details.

## Environment variables

See [`.env.example`](./.env.example). The whole app reads from a single `.env`
at the repo root.

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key |
| `DATABASE_URL` | Prisma SQLite connection string |
| `PORT` / `HOST` | Backend server bind address |
| `VITE_API_URL` | Backend URL the frontend calls |
