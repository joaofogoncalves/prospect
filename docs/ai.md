# AI analysis

Each intake can be analyzed by an LLM to produce a short summary, topical tags,
and a risk checklist. The implementation lives in
[`backend/src/ai.ts`](../backend/src/ai.ts) and is invoked by
`POST /api/intakes/:id/analyze` (see [api.md](./api.md)).

## Output shape

```ts
type IntakeAnalysis = {
  summary: string;        // 2–3 sentences
  tags: string[];         // at least 3, lowercase
  riskChecklist: string[]; // bullet-style diligence items
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
"at least 3 tags", etc.).

Strict mode requires every property to be `required` and
`additionalProperties: false`; count constraints like "at least 3 tags" can't be
expressed in the strict schema, so they live in the prompt instructions.

- **Model:** `OPENAI_MODEL` env var, default `gpt-4o-mini` (must support
  structured outputs).
- **Key:** `OPENAI_API_KEY`. If unset, `analyze` returns `503` with a clear
  message — which the UI surfaces as its error state.

## Error handling

`ai.ts` throws a typed `AnalysisError` carrying an HTTP status:

| Situation | Status |
| --- | --- |
| No API key configured | `503` |
| OpenAI request failed / empty / invalid JSON / wrong shape | `502` |
| Unexpected | `500` |

The intake itself is always created first (a failed analysis never blocks
persistence), and analysis can be retried/regenerated from the detail view.

## Future / structured output direction

The free-form prompt path is wrapped behind the strict schema today. As the
schema evolves (e.g. richer risk scoring), update `ANALYSIS_SCHEMA`, the example,
and the `IntakeAnalysis` type together, and add a migration if new fields are
persisted.
