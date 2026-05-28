# Architecture

Project Intake is a small full-stack TypeScript app for capturing and managing
project intake records. It is an **npm workspaces** monorepo with two packages.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | [Fastify 5](https://fastify.dev/) (ESM, `tsx` in dev) |
| ORM / DB | [Prisma 6](https://www.prisma.io/) + SQLite |
| Frontend | [React 18](https://react.dev/) + [Vite 6](https://vite.dev/) |
| Styling | Tailwind CSS 4 + shadcn-style UI components |
| AI | [OpenAI](https://platform.openai.com/) SDK (key configured, not yet wired into a route) |
| Auth | `@fastify/jwt` + `bcryptjs` (register/login, JWT-protected routes) |
| Routing | [React Router 7](https://reactrouter.com/) on the frontend |

## Repository layout

```
project_intake/
├── backend/                 # Fastify API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma     # Data model (User, Project)
│   │   ├── migrations/       # Generated SQL migrations
│   │   └── dev.db            # Local SQLite database (gitignored)
│   └── src/
│       ├── index.ts          # Server entry, registers plugins + routes
│       ├── auth.ts           # JWT plugin + `authenticate` preHandler
│       ├── routes/
│       │   ├── auth.ts        # register / login / me
│       │   └── projects.ts    # protected, user-scoped project routes
│       ├── db.ts             # Prisma client singleton
│       └── env.ts            # Loads the single root .env, validates required vars
├── frontend/                # React + Vite app
│   └── src/
│       ├── App.tsx           # Routes (login / register / protected dashboard)
│       ├── main.tsx          # React entry (Router + AuthProvider)
│       ├── pages/            # Login, Register, Dashboard
│       ├── components/
│       │   ├── AuthForm.tsx   # Shared login/register form
│       │   └── ui/            # Button, Card, Input, Label
│       └── lib/
│           ├── api.ts         # fetch wrapper, token storage
│           ├── auth.tsx       # AuthProvider / useAuth
│           └── utils.ts
├── docs/                    # This documentation
├── .githooks/               # Versioned git hooks (post-commit docs reminder)
├── .env.example             # Copy to .env
└── package.json             # Workspace root + scripts
```

## Request flow

1. The frontend reads `VITE_API_URL` (default `http://localhost:3000`) and calls
   the backend over `fetch`.
2. Fastify (`backend/src/index.ts`) registers `@fastify/cors` (`origin: true`) and
   the JWT auth plugin (`backend/src/auth.ts`), then mounts the route modules
   documented in [api.md](./api.md).
3. Protected routes run the `authenticate` preHandler, which verifies the bearer
   JWT and exposes `request.user` (`{ sub, email }`) to the handler.
4. Route handlers use the shared Prisma client (`backend/src/db.ts`) to read and
   write the SQLite database; project routes filter by `request.user.sub`.
5. `backend/src/env.ts` loads the **single `.env` at the repo root** regardless of
   the current working directory, so backend and frontend share one config file.
6. On the frontend, `lib/auth.tsx` stores the token (localStorage), hydrates the
   session via `GET /api/auth/me`, and `App.tsx` gates routes on auth state.

## Data model

Defined in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

### `User`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` | `cuid()` primary key |
| `email` | `String` | unique |
| `name` | `String?` | optional |
| `passwordHash` | `String` | bcrypt hash |
| `createdAt` | `DateTime` | defaults to now |
| `projects` | `Project[]` | relation |

### `Project`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` | `cuid()` primary key |
| `name` | `String` | required |
| `description` | `String?` | optional |
| `status` | `String` | defaults to `"intake"` |
| `createdAt` / `updatedAt` | `DateTime` | timestamps |
| `userId` | `String` | FK → `User`, `onDelete: Cascade` |

Ownership is enforced server-side: `POST /api/projects` sets `userId` from the
authenticated token, and `GET /api/projects` returns only that user's projects.
