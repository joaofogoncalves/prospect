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
- `201 Created` — `{ "token": "...", "user": { "id", "email", "name", "createdAt" } }`
- `400 Bad Request` — invalid email / short password
- `409 Conflict` — `{ "error": "Email already registered" }`

### `POST /api/auth/login`
Verify credentials and return a token.

**Request body**
```json
{ "email": "you@example.com", "password": "..." }
```

**Responses**
- `200 OK` — `{ "token": "...", "user": { "id", "email", "name", "createdAt" } }`
- `400 Bad Request` — missing fields
- `401 Unauthorized` — `{ "error": "Invalid email or password" }`

### `GET /api/auth/me`  🔒
Return the authenticated user.

**Responses**
- `200 OK` — `{ "id", "email", "name", "createdAt" }` (the public user shape;
  `createdAt` is an ISO timestamp, surfaced on the profile view)
- `401 Unauthorized` — missing/invalid token

### `POST /api/auth/change-password`  🔒
Change the current user's password. Requires the current password. The client
signs out afterwards (existing tokens keep working until they expire).

**Request body**
```json
{ "currentPassword": "…", "newPassword": "at-least-8-chars" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `currentPassword` | yes | must match the stored password |
| `newPassword` | yes | min 8 characters, and must differ from the current one |

**Responses**
- `204 No Content` — password changed
- `400 Bad Request` — missing fields / `< 8` chars / unchanged password
- `401 Unauthorized` — missing/invalid token, or current password incorrect

## Intakes

All intake routes are **protected** (🔒). The tool is **collaborative**: any
signed-in user can read any intake, but only the **creator** may run analysis on
it (write actions are owner-only). Defined in
[`backend/src/routes/intakes.ts`](../backend/src/routes/intakes.ts).

An intake object (each carries its creator, so clients can tell "mine" from the
rest by comparing `userId` to the current user's id):

```json
{
  "id": "clx...",
  "title": "Enterprise demand-forecasting platform",
  "description": "Build a custom AI forecasting platform integrated with SAP...",
  "budgetRange": "$2M – $4M",
  "timeline": "9 months",
  "industry": "Retail",
  "createdAt": "2026-05-28T19:35:22.000Z",
  "updatedAt": "2026-05-28T19:35:22.000Z",
  "summary": "A retail enterprise wants ...",
  "tags": ["ai-ml", "enterprise", "systems-integration"],
  "riskChecklist": ["Confirm data access and quality.", "..."],
  "analyzedAt": "2026-05-28T19:35:26.000Z",
  "analysisStatus": "completed",
  "analysisError": null,
  "analysisRunCount": 0,
  "userId": "...",
  "user": { "id": "...", "name": "Dana Ruiz", "email": "dana@example.com" }
}
```

`summary`, `tags`, `riskChecklist`, and `analyzedAt` are `null` until analysis
succeeds. **Analysis runs as a background job** (see below), so its progress lives
in two fields the client polls on:

| Field | Meaning |
| --- | --- |
| `analysisStatus` | `"pending"` (idle, never analyzed), `"processing"` (a job is running — poll until it changes), `"completed"`, or `"failed"` |
| `analysisError` | the failure message when `analysisStatus` is `"failed"` (else `null`); cleared when a new run starts |
| `analysisRunCount` | user-initiated re-analyses spent on this intake. Capped at **3** (`MAX_REANALYSIS`); the on-create analysis does **not** count |

### `GET /api/intakes`  🔒
List **every** intake, newest first (`orderBy: createdAt desc`), each with its
`user` (creator). The client splits "my intakes" from the rest.

### `GET /api/intakes/:id`  🔒
Get one intake by id — readable by any signed-in user (read-only for non-owners).
- `200 OK` — the intake object (with `user`)
- `404 Not Found` — `{ "error": "Intake not found" }`

### `GET /api/intakes/stats`  🔒
Aggregate, **team-wide** counts for the dashboard (the tool is collaborative, so
everyone sees the same global numbers, including the leaderboard). Read-only and
not rate-limited. Computed in JS from a single projection of all intakes (`tags`
is a JSON column, so there's no native SQL aggregation to lean on).

- `200 OK` — the stats object:
```json
{
  "totals": { "intakes": 13, "analyzed": 10, "notAnalyzed": 3, "contributors": 5 },
  "byStatus": [{ "status": "completed", "count": 10 }, { "status": "pending", "count": 3 }],
  "byTag": [{ "tag": "ai-ml", "count": 5 }],
  "byIndustry": [{ "industry": "Fintech", "count": 3 }],
  "leaderboard": [
    { "userId": "…", "name": "You Tester", "email": "you@example.com", "count": 4, "analyzedCount": 3 }
  ],
  "overTime": [{ "date": "2026-05-28", "count": 1 }]
}
```
- `analyzed` counts intakes with a non-null `analyzedAt`; `byStatus` is the analysis
  lifecycle breakdown. `byTag`/`byIndustry`/`leaderboard` are sorted by `count`
  descending; `overTime` buckets by calendar day, oldest first.
- `401 Unauthorized` — missing/invalid token

### `POST /api/intakes`  🔒
Create an intake and **kick off AI analysis as a background job**. The intake is
persisted and returned immediately (`analysisStatus: "processing"`); analysis runs
out of band, so the request never blocks on (or loses input to) OpenAI. The client
navigates to the detail view and **polls `GET /api/intakes/:id`** until
`analysisStatus` settles. Rate-limited (each create spends an OpenAI call).

**Request body** — all fields required (non-empty strings):
```json
{
  "title": "Enterprise demand-forecasting platform",
  "description": "Build a custom AI forecasting platform integrated with SAP.",
  "budgetRange": "$2M – $4M",
  "timeline": "9 months",
  "industry": "Retail"
}
```

**Responses**
- `201 Created` — the saved intake with `analysisStatus: "processing"` (analysis
  fields still `null`). Poll the detail endpoint for the result.
- `400 Bad Request` — `{ "error": "Missing required fields: ..." }`
- `401 Unauthorized` — missing/invalid token
- `429 Too Many Requests` — rate limit exceeded (see [Rate limiting](#rate-limiting))

Every analysis attempt (here and below) is recorded in `IntakeAnalysisRequest`
for observability — and the background job retries transient failures
automatically. See [ai.md](./ai.md).

### `POST /api/intakes/:id/analyze`  🔒
Re-run analysis for an existing intake (retry after a failed run, or regenerate).
Like creation, this is async: it sets the intake back to `"processing"` and returns
**202**; the client polls the detail endpoint for the result. **Owner-only**, and
**capped at `MAX_REANALYSIS` (3) runs per intake** (the on-create analysis is free).
Rate-limited. See [ai.md](./ai.md) for how the model is prompted.

**Responses**
- `202 Accepted` — the intake, now `analysisStatus: "processing"` and with
  `analysisRunCount` incremented. Poll `GET /api/intakes/:id` for the outcome.
- `403 Forbidden` — `{ "error": "Only the creator can run analysis on this intake." }`
  (the caller is not the intake's owner)
- `404 Not Found` — `{ "error": "Intake not found" }`
- `409 Conflict` — `{ "error": "Analysis is already running for this intake." }`
  (a run is in flight; no re-analysis is consumed)
- `429 Too Many Requests` — either the per-intake cap is reached
  (`{ "error": "Re-analysis limit reached (3 per intake)." }`) or the endpoint
  rate limit was exceeded

The terminal analysis outcome (`completed` with fields populated, or `failed` with
`analysisError`) is observed by polling the detail endpoint, not in this response.

## `GET /health`
Health check (public).

```json
{ "status": "ok" }
```

## Rate limiting

The two endpoints that spend OpenAI calls are rate-limited (via
`@fastify/rate-limit`, registered `global: false` and applied per route) to cap
cost:

| Endpoint | Limit (per client IP) |
| --- | --- |
| `POST /api/intakes` | 30 / minute |
| `POST /api/intakes/:id/analyze` | 10 / minute |

Exceeding a limit returns `429 Too Many Requests`. This is the coarse
infrastructure guard; the **per-intake `MAX_REANALYSIS` cap** is the per-user/
per-resource limit on how often a single intake can be re-analyzed.

## CORS

`@fastify/cors` is registered with `origin: true`, reflecting the request origin.
Tighten this before deploying to production.

