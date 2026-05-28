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
| AI | [OpenAI](https://platform.openai.com/) SDK — intake analysis via strict structured outputs ([ai.md](./ai.md)) |
| Auth | `@fastify/jwt` + `bcryptjs` (register/login, JWT-protected routes) |
| Routing | [React Router 7](https://reactrouter.com/) on the frontend |

## Repository layout

```
project_intake/
├── backend/                 # Fastify API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma     # Data model (User, Intake)
│   │   ├── migrations/       # Generated SQL migrations
│   │   └── dev.db            # Local SQLite database (gitignored)
│   └── src/
│       ├── index.ts          # Server entry, registers plugins + routes
│       ├── auth.ts           # JWT plugin + `authenticate` preHandler
│       ├── ai.ts             # OpenAI analysis service (strict json_schema)
│       ├── routes/
│       │   ├── auth.ts        # register / login / me
│       │   └── intakes.ts     # protected, user-scoped intake + analyze routes
│       ├── db.ts             # Prisma client singleton
│       └── env.ts            # Loads the single root .env, validates required vars
├── frontend/                # React + Vite app
│   └── src/
│       ├── App.tsx           # Routes (login / register / protected intake views)
│       ├── main.tsx          # React entry (Router + AuthProvider)
│       ├── pages/            # Login, Register, IntakeList, IntakeDetail, IntakeCreate
│       ├── components/
│       │   ├── AuthForm.tsx   # Shared login/register form
│       │   ├── Layout.tsx     # App shell (header + nav)
│       │   ├── states.tsx     # Loading / Empty / Error state components
│       │   └── ui/            # shadcn: Button, Card, Input, Label, Textarea, Badge, Skeleton
│       └── lib/
│           ├── api.ts         # fetch wrapper, token storage, intakes API
│           ├── auth.tsx       # AuthProvider / useAuth
│           ├── useQuery.ts    # tiny async data hook (loading/error/reload)
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
   write the SQLite database; intake routes filter by `request.user.sub`.
5. AI analysis (`POST /api/intakes/:id/analyze`) is a **separate step** from
   creation: the intake is persisted first, then `backend/src/ai.ts` calls OpenAI
   and the result is saved back onto the intake. See [ai.md](./ai.md).
6. `backend/src/env.ts` loads the **single `.env` at the repo root** regardless of
   the current working directory, so backend and frontend share one config file.
7. On the frontend, `lib/auth.tsx` stores the token (localStorage), hydrates the
   session via `GET /api/auth/me`, and `App.tsx` gates routes on auth state.

## Frontend views & UX states

Three protected views (`frontend/src/pages/`), each handling **loading**,
**empty**, and **error** states via the shared components in
`components/states.tsx`:

- **IntakeList** (`/`) — list of the user's intakes; empty state prompts creation.
- **IntakeCreate** (`/intakes/new`) — the 5-field form; on submit it persists the
  intake and navigates to the detail view.
- **IntakeDetail** (`/intakes/:id`) — core fields plus the AI analysis section,
  which auto-runs analysis on first visit and has its own loading/empty/error
  states and a regenerate action.

> A fourth UX state is intentionally deferred (TBD).

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
| `intakes` | `Intake[]` | relation |

### `Intake`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` | `cuid()` primary key |
| `title` | `String` | required |
| `description` | `String` | required |
| `budgetRange` | `String` | required (free-form, e.g. `"$1M – $2M"`) |
| `timeline` | `String` | required (free-form, e.g. `"6 months"`) |
| `industry` | `String` | required |
| `createdAt` / `updatedAt` | `DateTime` | timestamps |
| `summary` | `String?` | AI output; null until analyzed |
| `tags` | `Json?` | AI output; array of strings |
| `riskChecklist` | `Json?` | AI output; array of strings |
| `analyzedAt` | `DateTime?` | set when analysis last ran |
| `userId` | `String` | FK → `User`, `onDelete: Cascade` |

> SQLite has no array type; `tags` / `riskChecklist` use Prisma's `Json` columns
> (stored as TEXT).

Ownership is enforced server-side: `POST /api/intakes` sets `userId` from the
authenticated token, and the read routes return only that user's intakes.
