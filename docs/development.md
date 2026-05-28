# Development

## Prerequisites

- Node.js **>= 20** (see `engines` in the root `package.json`)
- npm **>= 9** (workspaces support)

## First-time setup

```bash
# 1. Install all workspace dependencies (also installs the git hooks — see below)
npm install

# 2. Create your env file and add your OpenAI key
cp .env.example .env
#   then edit .env: set OPENAI_API_KEY and a strong JWT_SECRET

# 3. Generate the Prisma client and create the SQLite database
npm run db:migrate
```

## Running

```bash
npm run dev            # backend + frontend together
npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:5173
```

The frontend calls the backend at `VITE_API_URL` (default `http://localhost:3000`).

## Scripts (root)

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend |
| `npm run dev:backend` / `npm run dev:frontend` | Run one workspace |
| `npm run build` | Build both workspaces |
| `npm run db:migrate` | Create/apply a Prisma migration (dev) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run setup:hooks` | (Re)point git at `.githooks/` |

## Environment variables

The whole app reads a **single `.env` at the repo root**. See
[`.env.example`](../.env.example).

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key (loaded lazily; server boots without it) |
| `DATABASE_URL` | Prisma SQLite connection string; relative paths resolve from `backend/prisma/` |
| `PORT` / `HOST` | Backend server bind address |
| `JWT_SECRET` | Secret used to sign JWTs |
| `VITE_API_URL` | Backend URL the frontend calls |

## Database workflow

- Edit models in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
- Run `npm run db:migrate` to create a migration and regenerate the client.
- Inspect data with `npm run db:studio`.
- `backend/prisma/dev.db` is local and gitignored.

## Git hooks — keeping docs in sync

A versioned **`post-commit`** hook lives in [`.githooks/`](../.githooks/). After each
commit it checks whether watched source paths changed without a matching update under
`docs/`, and prints a reminder if so. It only warns — it never blocks or rewrites the
commit.

The hook is installed automatically by the `prepare` script on `npm install`. To
(re)install manually:

```bash
npm run setup:hooks
# equivalent to: git config core.hooksPath .githooks
```

Watched paths are listed at the top of [`.githooks/post-commit`](../.githooks/post-commit)
and currently include `backend/src`, `backend/prisma/schema.prisma`, `frontend/src`,
the `package.json` files, and `.env.example`. Adjust them there as the project grows.
