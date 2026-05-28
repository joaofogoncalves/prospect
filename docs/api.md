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

All project routes are **protected** (🔒) and scoped to the authenticated user.

### `GET /api/projects`  🔒
List the current user's projects, newest first (`orderBy: createdAt desc`).

```json
[
  {
    "id": "clx...",
    "name": "Acme rebrand",
    "description": null,
    "status": "intake",
    "createdAt": "2026-05-28T19:21:13.000Z",
    "updatedAt": "2026-05-28T19:21:13.000Z",
    "userId": "..."
  }
]
```

### `POST /api/projects`  🔒
Create a project owned by the current user (`userId` is taken from the token).

**Request body**
```json
{ "name": "Acme rebrand", "description": "Optional text" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | returns `400 { "error": "name is required" }` if missing |
| `description` | no | |

**Responses**
- `201 Created` — the created project object
- `400 Bad Request` — `{ "error": "name is required" }`
- `401 Unauthorized` — missing/invalid token

## `GET /health`
Health check (public).

```json
{ "status": "ok" }
```

## CORS

`@fastify/cors` is registered with `origin: true`, reflecting the request origin.
Tighten this before deploying to production.

## Not yet implemented

Dependencies exist but no routes are wired up for:
- **AI** — `openai` SDK (`OPENAI_API_KEY` is loaded but unused)

Update this page as these endpoints are added.
