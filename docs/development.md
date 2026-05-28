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

> **Charts:** the dashboard uses **Recharts** (`frontend` dependency). It's
> [lazy-loaded](../frontend/src/App.tsx) so its bundle only loads on `/dashboard`.
> See [decisions.md#019](./decisions.md) and the styleguide §9.

## Running with Docker

For a production-style stack with one command (no local Node/Prisma needed):

```bash
cp .env.example .env          # JWT_SECRET is required; OPENAI_API_KEY optional
docker compose up --build     # → http://localhost:8080
```

Topology and rationale are in [decisions.md #011](./decisions.md). The short version:

- **Two images, multi-stage.** `backend/Dockerfile` compiles TS and runs on Node;
  `frontend/Dockerfile` builds the SPA and serves it with **nginx**, which also
  reverse-proxies `/api/*` to the backend. Only port **8080** is published.
- **Same-origin frontend.** The image is built with `VITE_API_URL=""`, so the bundle
  calls `/api/...` relative to its own origin and nginx forwards it — no CORS, no
  baked-in hostname.
- **Migrations on startup.** `backend/docker-entrypoint.sh` runs
  `prisma migrate deploy` (idempotent) before launching the server.
- **Persistent DB.** SQLite lives at `/data/app.db` on the `prospect-db` named volume;
  Compose sets `DATABASE_URL=file:/data/app.db`. It survives `docker compose down`;
  use `docker compose down -v` to wipe it.

The backend service loads the root `.env` directly via `env_file` — no variable
names or secrets are duplicated in `docker-compose.yml`. It overrides only
`DATABASE_URL` (to the volume path; the `.env` value points at the local dev DB) and,
for the frontend, builds with `VITE_API_URL=""`. So those two values in `.env` only
affect the `npm run dev` workflow above.

> Note: duplicate keys in `.env` resolve **last-wins** when loaded as an `env_file`.

## Scripts (root)

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend |
| `npm run dev:backend` / `npm run dev:frontend` | Run one workspace |
| `npm run build` | Build both workspaces |
| `npm run db:migrate` | Create/apply a Prisma migration (dev); re-seeds afterwards |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Populate the dev DB with sample users + intakes |
| `npm run db:reset` | Drop, re-migrate, and re-seed the DB (asks to confirm) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run setup:hooks` | (Re)point git at `.githooks/` |

## Environment variables

The whole app reads a **single `.env` at the repo root**. See
[`.env.example`](../.env.example).

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key (loaded lazily; server boots without it, but `analyze` returns 503 until set) |
| `OPENAI_MODEL` | Model for intake analysis; default `gpt-4o-mini` (must support structured outputs) |
| `DATABASE_URL` | Prisma SQLite connection string; relative paths resolve from `backend/prisma/` |
| `PORT` / `HOST` | Backend server bind address |
| `JWT_SECRET` | Secret used to sign JWTs |
| `VITE_API_URL` | Backend URL the frontend calls |

## Database workflow

- Edit models in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
- Run `npm run db:migrate` to create a migration and regenerate the client.
- Inspect data with `npm run db:studio`.
- `backend/prisma/dev.db` is local and gitignored.

### Seed data

[`backend/prisma/seed.ts`](../backend/prisma/seed.ts) populates the dev DB with
five users and ~12 intakes spread across several years and industries — enough to
exercise the collaborative list (mine vs. others), the per-creator filter, date
sorting, and the "not analyzed yet" state (a few intakes are intentionally left
un-analyzed so you can run analysis from the UI). The analyzed ones carry baked-in
results (no live OpenAI call), so seeding needs no API key.

- **All seeded users share the password `password123`** — log in as
  `you@example.com` (or any of the others) to view the list from their seat.
- The seed is **destructive and idempotent**: it clears users/intakes and recreates
  a fixed dataset (stable ids), so re-running always lands on the same state.
- It runs **automatically** after `npm run db:migrate` and `npm run db:reset` (wired
  via the `prisma.seed` config in `backend/package.json`), and **on demand** via
  `npm run db:seed`. `db:reset` prompts before wiping.

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
