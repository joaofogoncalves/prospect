# Next steps

A backlog of ideas for future improvements — captured so they're not lost, and
organized into themes with enough detail to pick up later. Nothing here is
committed work; it's a parking lot. When one of these is built, move the detail
into the relevant living doc ([`api.md`](./api.md), [`ai.md`](./ai.md),
[`architecture.md`](./architecture.md), …) and log the call in
[`decisions.md`](./decisions.md).

Each item notes roughly **what it touches** in the current codebase so the scope
is visible up front.

---

## 1. Richer, measurable intake data

### 1.1 Structured budget & timeline (the priority)

**Problem.** On creation we collect `budgetRange` and `timeline` as free-text
strings (`Intake.budgetRange`, `Intake.timeline` in
[`schema.prisma`](../backend/prisma/schema.prisma)). Strings are friendly for the
user to type, but useless for statistics — we can't sort, compare, or chart a
string like `"a few months"` or `"$20–50k"`.

**Idea.** Have the AI analysis step also **parse** these two fields into
structured, internal values and store them alongside the originals:

- **Timeline → number of days** (e.g. a single comparable integer) so timelines
  can be ordered and compared across intakes.
- **Budget range → structured numeric value(s)** (e.g. a normalized min/max, or a
  single comparable figure) in a consistent currency/unit.

These would be **non-user-visible, internal fields** — used for ordering, stats,
and dashboards, not shown back on the intake detail. The user keeps typing
natural language; we keep a machine-readable shadow of it.

**Scope: just these two fields.** Leave `industry` exactly as it is for now —
don't structure it.

**Structured error feedback.** The extraction needs to be able to *fail loudly
and specifically*. If someone types `potatoes` in the budget field, we should
tell them something like: *"That budget range doesn't look like a budget — please
enter an amount or range."* So the AI's structured output needs a per-field
success/error channel, not just a value. When parsing fails, surface a clear,
field-specific message rather than silently storing nothing.

**What it touches:**

- [`schema.prisma`](../backend/prisma/schema.prisma) — new internal columns on
  `Intake` (e.g. `timelineDays`, normalized budget fields) + a migration.
- [`ai.ts`](../backend/src/ai.ts) — extend the `IntakeAnalysis` type and the
  strict `json_schema` to emit the parsed values **and** per-field parse
  errors; update the prompt. → update [`ai.md`](./ai.md).
- [`routes/intakes.ts`](../backend/src/routes/intakes.ts) — persist the new
  fields; decide how parse errors surface to the client (likely alongside the
  existing `analysisError` / status flow). → update [`api.md`](./api.md).
- Frontend create/detail views — show the field-specific error so the user can
  fix their input.
- Eventually: feed the numeric fields into the dashboard for real stats.

**Open questions:**

- Currency / unit normalization for budgets (assume one currency? store the
  detected one?).
- Where the parse error lives in the create flow: analysis runs *after* the
  intake is persisted, so the error is a post-creation state (like today's
  `analysisError`), not an inline form-validation block. Confirm the UX.

---

### 1.2 Social gamification — thumbs up / down *(nice-to-have)*

A lightweight signal: any project in the list can get a **thumbs up / thumbs
down** from anyone in the company. Keep it to just that — no comments, no
threads. A simple way to surface which intakes resonate.

**Scope sketch:** a vote model (one row per user per intake, value ±1), an
endpoint to set/clear a vote, an aggregate count on the list/detail views. Note
this is the first feature that's intentionally **cross-user** (everyone sees and
votes on everyone's intakes), which cuts against today's strictly user-scoped
model — worth a deliberate decision.

---

### 1.3 AI duplicate detection & merge (admin) *(nice-to-have, major refactor)*

**Idea.** An admin tool that uses AI to **find likely-duplicate intakes** and
flag them, then lets the admin **merge** them with a diff-style, side-by-side
view: see both intakes next to each other, pick which parts of each to keep, and
produce a single merged intake.

**The hard part — ownership.** Today `Intake.userId` is a single owner. A merged
intake can legitimately have **more than one author**. That means:

- Change ownership from a single `userId` to a **many-to-many** relationship
  between `User` and `Intake` (co-authors), even though it'll be one author the
  vast majority of the time.
- Update the **intake create view** to allow adding **co-authors**.
- Update the **list filters** (which currently scope by the single owner) to work
  with the many-to-many relationship.

This is flagged as a **major refactor** precisely because the single-owner
assumption is baked into the routes (`request.user.sub` filtering), the schema,
and the UI. Worth its own decision-log entry before starting.

---

## 2. Admin

Introduce a **default admin user** that acts as a system controller, with its own
capabilities the regular user role doesn't have. (First decision: how the admin
role is represented — a flag on `User`, a role enum, a seeded account — and how
admin-only routes are guarded, analogous to today's `authenticate` preHandler.)

### 2.1 User management + password reset

- Admin can **see a list of users**.
- Admin can **reset a user's password**. Since there's no email feature, this is
  just a field where the admin types a new password, which is set as the user's
  password hash. The admin then tells the user to log in again.

**What it touches:** new admin-guarded routes (list users, set password) in the
backend; a new admin users view in the frontend; reuse the existing bcrypt
hashing from [`routes/auth.ts`](../backend/src/routes/auth.ts).

### 2.2 Admin analytics dashboard (anonymized)

A dashboard over the **analysis of all requests** — but **aggregate and
anonymized**, never individualized, to avoid leaking private intake content.
Metrics in the spirit of: *"Yesterday we ran N requests, averaging X ms, burning
Y tokens,"* etc. — built on the
[`IntakeAnalysisRequest`](../backend/prisma/schema.prisma) observability rows
(model used, `durationMs`, status, timestamps).

**Performance note.** The current `IntakeAnalysisRequest` model stores a lot per
row (raw response, full schema, both prompts). For a cross-all-users analytics
view we may need to **revisit the model for performance** — e.g. aggregate
tables/rollups, or trimming what's stored — rather than scanning the fat
observability table on every dashboard load.

**What it touches:** admin-guarded stats endpoint(s) returning **only aggregated**
figures; a new admin dashboard view (can build on the existing
[`Dashboard.tsx`](../frontend/src/pages/Dashboard.tsx) / Recharts patterns);
possibly a schema/performance pass on `IntakeAnalysisRequest`.

### 2.3 Admin-selectable AI model

Let the admin **choose the model being used** for analysis from the UI, so we can
control cost or upgrade for better results **without changing code and
redeploying**. Today the model is fixed in [`ai.ts`](../backend/src/ai.ts) /
env. This would make it a runtime setting (stored in the DB / a settings table)
that the analysis service reads per request.

**What it touches:** a settings store for the active model; [`ai.ts`](../backend/src/ai.ts)
reads it instead of a constant; an admin control to change it. → update
[`ai.md`](./ai.md) and [`development.md`](./development.md). The chosen model is
already recorded per attempt on `IntakeAnalysisRequest.model`, so historical
metrics stay correct as the setting changes over time.

---

## Priority at a glance

| # | Item | Size | Priority |
| --- | --- | --- | --- |
| 1.1 | Structured budget & timeline + structured parse errors | Medium | **Do first** |
| 2.1 | Admin: user list + password reset | Small–Medium | High |
| 2.2 | Admin: anonymized analytics dashboard | Medium | High |
| 2.3 | Admin: selectable AI model | Small | Medium |
| 1.2 | Thumbs up / down | Small | Nice-to-have |
| 1.3 | AI duplicate detection + merge (co-authors refactor) | Large | Nice-to-have |
