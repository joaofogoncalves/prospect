# AI analysis

Each intake is analyzed by an LLM to produce a short summary, topical tags, and a
risk checklist, in the context of **triaging software-development project requests
for an enterprise software company** (including AI-acceleration work). The
implementation lives in [`backend/src/ai.ts`](../backend/src/ai.ts).

## When it runs

Analysis runs **on creation**: `POST /api/intakes` persists the intake first, then
calls OpenAI (see [api.md](./api.md)). The intake is never lost if the call fails —
the create response carries `analysisError` and the client can retry via
`POST /api/intakes/:id/analyze`, which is also the "regenerate" path.

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

| Situation | HTTP status |
| --- | --- |
| No API key configured (no request issued, not logged) | `503` |
| OpenAI request failed / empty / invalid JSON / wrong shape | `502` |

The intake is always created first (a failed analysis never blocks persistence),
and analysis can be retried/regenerated.

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
