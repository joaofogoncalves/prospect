# AI analysis

Each intake is analyzed by an LLM to produce a short summary, topical tags, and a
risk checklist, in the context of **triaging software-development project requests
for an enterprise software company** (including AI-acceleration work). The
implementation lives in [`backend/src/ai.ts`](../backend/src/ai.ts).

## When it runs

Analysis runs **on creation, as a background job**: `POST /api/intakes` persists the
intake and returns immediately with `analysisStatus: "processing"`, then analyzes
out of band (see [api.md](./api.md)). The client polls `GET /api/intakes/:id` until
the status settles. The intake is never lost if the call fails — a failed run lands
in `analysisStatus: "failed"` with `analysisError`, and the owner can retry via
`POST /api/intakes/:id/analyze` (the "regenerate" path), capped at `MAX_REANALYSIS`
(3) per intake. Orchestration lives in
[`backend/src/routes/intakes.ts`](../backend/src/routes/intakes.ts).

## Reliability — retries, timeout, single-flight

Because analysis is now a background job, it retries automatically before giving up:

- **Per-attempt timeout:** the OpenAI client is configured with a 30s `timeout`
  (the SDK default is 10 minutes) and `maxRetries: 2`, so the SDK already backs off
  on transient transport errors (429 / 5xx / network / timeout) within one attempt.
- **Outer retry:** the job re-runs the whole attempt up to `MAX_ANALYSIS_ATTEMPTS`
  (3) on a **retryable** outcome — a transient transport failure, or a usable-looking
  `200` whose body was empty / invalid JSON / wrong shape. Each attempt is logged
  separately, so retries are visible in `IntakeAnalysisRequest`.
- **Terminal (no retry):** a missing API key (`503`) and `4xx` client/config errors
  (`400/401/403`) won't change on retry, so the job fails fast.
- **Single-flight:** an in-process guard prevents two concurrent runs on the same
  intake (the manual `/analyze` returns `409` while a run is active). It is in-memory
  by design, so a job lost to a process restart can be retried again afterwards.

## Output shape

```ts
type IntakeAnalysis = {
  summary: string;         // 2–3 sentences
  tags: string[];          // at least 3, lowercase
  riskChecklist: string[]; // bullet-style delivery/diligence items
};
```

These are persisted onto the intake (`summary`, `tags`, `riskChecklist`,
`analyzedAt`) and rendered on the detail view.

## How the model is prompted

We use OpenAI **Structured Outputs**: the request sets
`response_format: { type: "json_schema", strict: true, ... }`, so the model is
constrained to return JSON matching our schema. As a belt-and-braces measure (and
per the project spec), the **same JSON Schema and a worked example are also
embedded in the user prompt**, alongside explicit instructions ("2–3 sentences",
"at least 3 tags", etc.). The system prompt frames the model as an analyst at an
enterprise software-development company triaging incoming project requests.

Strict mode requires every property to be `required` and
`additionalProperties: false`; count constraints like "at least 3 tags" can't be
expressed in the strict schema, so they live in the prompt instructions.

- **Model:** `OPENAI_MODEL` env var, default `gpt-4o-mini` (must support
  structured outputs).
- **Key:** `OPENAI_API_KEY`. If unset, analysis returns `503` with a clear
  message — which the UI surfaces as its error state.

## Error handling

`performAnalysis()` never throws for OpenAI/parse failures — it returns a
structured `AnalysisOutcome` so the caller can both record metrics and surface a
recoverable error:

| Situation | Status hint | Retryable? |
| --- | --- | --- |
| No API key configured (no request issued, not logged) | `503` | no — terminal |
| `4xx` client/config error (bad request, auth) | the `4xx` | no — terminal |
| `429` / `5xx` / network / timeout | the status (or `502`) | yes |
| Empty / invalid JSON / wrong shape `200` | `502` | yes |

The intake is always created first (a failed analysis never blocks persistence),
the job retries the retryable cases automatically (above), and the owner can still
retry/regenerate manually afterwards. A failed run is persisted as
`analysisStatus: "failed"` with the message in `analysisError`.

## Observability — `IntakeAnalysisRequest`

Every analysis attempt that actually issues a request is logged to the
`IntakeAnalysisRequest` table (one row per attempt), trading disk for visibility:

| Field | Purpose |
| --- | --- |
| `model` | which model was used |
| `schema` | the JSON schema sent to the model |
| `systemPrompt` / `userPrompt` | exact prompts sent |
| `rawResponse` | raw content returned (null on transport failure) |
| `status` / `error` | `"success"` \| `"error"` and the message |
| `startedAt` / `completedAt` / `durationMs` | response-time metrics |

The pre-flight "no API key" case is **not** logged (no request was issued). The
final analysis fields stay denormalized on `Intake`; this table is the audit/metric
trail. (No read endpoint yet — query the DB / Prisma Studio for now.)

## Future / structured output direction

As the schema evolves (e.g. richer risk scoring), update `ANALYSIS_SCHEMA`, the
example, and the `IntakeAnalysis` type together, and add a migration if new fields
are persisted.
