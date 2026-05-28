# API

Base URL: `http://localhost:3000` (configurable via `PORT` / `HOST`, and on the
frontend via `VITE_API_URL`). Routes are registered in
[`backend/src/index.ts`](../backend/src/index.ts) and defined under
[`backend/src/routes/`](../backend/src/routes/).

## Authentication

Auth uses **JWTs** signed with `JWT_SECRET`. Register or log in to receive a
token, then send it as a bearer token on protected routes:

```
Authorization: Bearer <token>
```

Tokens are signed by `@fastify/jwt` and carry `{ sub: userId, email }`. Passwords
are hashed with `bcryptjs`. Auth routes live in
[`backend/src/routes/auth.ts`](../backend/src/routes/auth.ts); the `authenticate`
preHandler is defined in [`backend/src/auth.ts`](../backend/src/auth.ts).

### `POST /api/auth/register`
Create a user and return a token.

**Request body**
```json
{ "email": "you@example.com", "password": "at-least-8-chars", "name": "Optional" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `email` | yes | must be a valid email; `400` otherwise |
| `password` | yes | min 8 characters; `400` otherwise |
| `name` | no | |

**Responses**
- `201 Created` — `{ "token": "...", "user": { "id", "email", "name" } }`
- `400 Bad Request` — invalid email / short password
- `409 Conflict` — `{ "error": "Email already registered" }`

### `POST /api/auth/login`
Verify credentials and return a token.

**Request body**
```json
{ "email": "you@example.com", "password": "..." }
```

**Responses**
- `200 OK` — `{ "token": "...", "user": { "id", "email", "name" } }`
- `400 Bad Request` — missing fields
- `401 Unauthorized` — `{ "error": "Invalid email or password" }`

### `GET /api/auth/me`  🔒
Return the authenticated user.

**Responses**
- `200 OK` — `{ "id", "email", "name" }`
- `401 Unauthorized` — missing/invalid token

## Projects

## Intakes

All intake routes are **protected** (🔒) and scoped to the authenticated user.
Defined in [`backend/src/routes/intakes.ts`](../backend/src/routes/intakes.ts).

An intake object:

```json
{
  "id": "clx...",
  "title": "East span bridge repair bond",
  "description": "Repair the east span...",
  "budgetRange": "$1M – $2M",
  "timeline": "6 months",
  "industry": "Infrastructure",
  "createdAt": "2026-05-28T19:35:22.000Z",
  "updatedAt": "2026-05-28T19:35:22.000Z",
  "summary": null,
  "tags": null,
  "riskChecklist": null,
  "analyzedAt": null,
  "userId": "..."
}
```

`summary`, `tags`, `riskChecklist`, and `analyzedAt` are `null` until the intake
is analyzed (see below).

### `GET /api/intakes`  🔒
List the current user's intakes, newest first (`orderBy: createdAt desc`).

### `GET /api/intakes/:id`  🔒
Get one intake the user owns.
- `200 OK` — the intake object
- `404 Not Found` — `{ "error": "Intake not found" }`

### `POST /api/intakes`  🔒
Create an intake. AI analysis is **not** run here — it's a separate step.

**Request body** — all fields required (non-empty strings):
```json
{
  "title": "East span bridge repair bond",
  "description": "Repair the east span of the river bridge.",
  "budgetRange": "$1M – $2M",
  "timeline": "6 months",
  "industry": "Infrastructure"
}
```

**Responses**
- `201 Created` — the created intake
- `400 Bad Request` — `{ "error": "Missing required fields: ..." }`
- `401 Unauthorized` — missing/invalid token

### `POST /api/intakes/:id/analyze`  🔒
Run (or re-run) AI analysis and persist the result onto the intake. See
[ai.md](./ai.md) for how the model is prompted.

**Responses**
- `200 OK` — the updated intake with `summary`, `tags`, `riskChecklist`,
  `analyzedAt` populated
- `404 Not Found` — `{ "error": "Intake not found" }`
- `503 Service Unavailable` — `{ "error": "OpenAI API key is not configured..." }`
- `502 Bad Gateway` — upstream OpenAI failure / invalid response
- `500 Internal Server Error` — unexpected failure

## `GET /health`
Health check (public).

```json
{ "status": "ok" }
```

## CORS

`@fastify/cors` is registered with `origin: true`, reflecting the request origin.
Tighten this before deploying to production.

