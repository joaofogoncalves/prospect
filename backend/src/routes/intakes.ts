import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { performAnalysis, type IntakeAnalysis, type IntakeInput } from "../ai.js";

type IntakeBody = Partial<IntakeInput>;

const FIELDS: (keyof IntakeInput)[] = [
  "title",
  "description",
  "budgetRange",
  "timeline",
  "industry",
];

type IntakeRecord = IntakeInput & { id: string };

// Public creator info attached to every intake we return. The list and detail
// views are collaborative (any signed-in user can read any intake), so each
// intake carries who submitted it; never the password hash.
const creatorInclude = {
  user: { select: { id: true, name: true, email: true } },
} as const;

// How many times a user may (re-)analyze a single intake. The automatic
// analysis on creation does NOT count against this — only the manual
// retry/regenerate calls do. Kept in sync with MAX_REANALYSIS in
// frontend/src/lib/api.ts (which drives the "N analyses left" countdown).
const MAX_REANALYSIS = 3;

// How many times the background job re-attempts a single analysis run on a
// *retryable* failure (transient transport, or a malformed model response).
// This is internal to one run and independent of MAX_REANALYSIS above.
const MAX_ANALYSIS_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Intakes currently being analyzed *in this process*. Guards against two
// concurrent runs writing to the same intake (e.g. the user hitting "Retry"
// while the on-create job is still in flight). It is deliberately in-memory:
// after a restart it's empty, so an intake left stuck in "processing" by a
// crash can be retried again (the DB status alone must not block that).
const inFlight = new Set<string>();

// Claim an intake for analysis. Returns false if a run is already active here.
function claimAnalysis(id: string): boolean {
  if (inFlight.has(id)) return false;
  inFlight.add(id);
  return true;
}

// Run a *previously claimed* analysis in the background and release the claim
// when it settles. Fire-and-forget: callers return to the client immediately.
function startClaimedJob(intake: IntakeRecord): void {
  void runAnalysisJob(intake).finally(() => inFlight.delete(intake.id));
}

// Run the analysis with bounded retries, recording every attempt in
// IntakeAnalysisRequest (success or failure) so retries are observable.
async function runAnalysisWithRetries(
  intake: IntakeRecord,
): Promise<
  { ok: true; analysis: IntakeAnalysis } | { ok: false; status: number; error: string }
> {
  let last: { status: number; error: string } = {
    status: 502,
    error: "Analysis did not run.",
  };

  for (let attempt = 1; attempt <= MAX_ANALYSIS_ATTEMPTS; attempt++) {
    const outcome = await performAnalysis(intake);

    if (outcome.log) {
      await prisma.intakeAnalysisRequest.create({
        data: {
          intakeId: intake.id,
          model: outcome.log.model,
          schema: outcome.log.schema as Prisma.InputJsonValue,
          systemPrompt: outcome.log.systemPrompt,
          userPrompt: outcome.log.userPrompt,
          rawResponse: outcome.log.rawResponse,
          status: outcome.log.status,
          error: outcome.log.error,
          startedAt: outcome.log.startedAt,
          completedAt: outcome.log.completedAt,
          durationMs: outcome.log.durationMs,
        },
      });
    }

    if (outcome.ok) return { ok: true, analysis: outcome.analysis };

    last = { status: outcome.status, error: outcome.error };
    if (!outcome.retryable || attempt === MAX_ANALYSIS_ATTEMPTS) break;
    // Short backoff between our own attempts (the SDK already backs off within
    // a single attempt for transport errors).
    await sleep(500 * attempt);
  }

  return { ok: false, ...last };
}

// The background analysis job. Assumes the intake has already been marked
// "processing" by the caller; writes the terminal "completed"/"failed" state.
async function runAnalysisJob(intake: IntakeRecord): Promise<void> {
  try {
    const result = await runAnalysisWithRetries(intake);
    if (result.ok) {
      await prisma.intake.update({
        where: { id: intake.id },
        data: {
          summary: result.analysis.summary,
          tags: result.analysis.tags,
          riskChecklist: result.analysis.riskChecklist,
          analyzedAt: new Date(),
          analysisStatus: "completed",
          analysisError: null,
        },
      });
    } else {
      await prisma.intake.update({
        where: { id: intake.id },
        data: { analysisStatus: "failed", analysisError: result.error },
      });
    }
  } catch (err) {
    // Defensive: a DB error or unexpected throw must never leave the intake
    // stuck in "processing" forever. Mark it failed so the poller can retry.
    const message = err instanceof Error ? err.message : "Analysis job failed.";
    await prisma.intake
      .update({
        where: { id: intake.id },
        data: { analysisStatus: "failed", analysisError: message },
      })
      .catch(() => {});
  }
}

// --- Dashboard stats ---------------------------------------------------------

// The aggregate shape returned by GET /api/intakes/stats. Mirrored as
// `IntakeStats` in frontend/src/lib/api.ts — keep the two in sync.
type StatsResponse = {
  totals: {
    intakes: number;
    analyzed: number;
    notAnalyzed: number;
    contributors: number;
  };
  byStatus: { status: string; count: number }[];
  byTag: { tag: string; count: number }[];
  byIndustry: { industry: string; count: number }[];
  leaderboard: {
    userId: string;
    name: string | null;
    email: string;
    count: number;
    analyzedCount: number;
  }[];
  overTime: { date: string; count: number }[];
};

// Minimal row shape the aggregation needs (a projection of Intake + creator).
type StatsRow = {
  createdAt: Date;
  analyzedAt: Date | null;
  analysisStatus: string;
  industry: string;
  tags: unknown; // JSON column — a string[] once analyzed, else null
  userId: string;
  user: { id: string; name: string | null; email: string };
};

// Tally values into a Map keyed by `key`, then return descending-by-count.
function countDesc<T>(
  items: T[],
  key: (item: T) => string,
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

// Aggregate all intakes into the dashboard stats. Pure (no I/O) so it's easy to
// reason about and test; the route just feeds it the rows.
function buildStats(rows: StatsRow[]): StatsResponse {
  const analyzed = rows.filter((r) => r.analyzedAt !== null).length;

  // Flatten every intake's tags (JSON array, null until analyzed) into one list.
  const tags = rows.flatMap((r) =>
    Array.isArray(r.tags) ? (r.tags as string[]) : [],
  );

  // Leaderboard: group by creator, counting total + analyzed intakes per person.
  const byUser = new Map<string, StatsResponse["leaderboard"][number]>();
  for (const r of rows) {
    const entry = byUser.get(r.userId) ?? {
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      count: 0,
      analyzedCount: 0,
    };
    entry.count += 1;
    if (r.analyzedAt !== null) entry.analyzedCount += 1;
    byUser.set(r.userId, entry);
  }

  // Intakes created per calendar day (ISO date), oldest first for the timeline.
  const overTime = countDesc(rows, (r) => r.createdAt.toISOString().slice(0, 10))
    .map((d) => ({ date: d.value, count: d.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totals: {
      intakes: rows.length,
      analyzed,
      notAnalyzed: rows.length - analyzed,
      contributors: byUser.size,
    },
    byStatus: countDesc(rows, (r) => r.analysisStatus).map((s) => ({
      status: s.value,
      count: s.count,
    })),
    byTag: countDesc(tags, (t) => t).map((t) => ({ tag: t.value, count: t.count })),
    byIndustry: countDesc(rows, (r) => r.industry).map((i) => ({
      industry: i.value,
      count: i.count,
    })),
    leaderboard: [...byUser.values()].sort((a, b) => b.count - a.count),
    overTime,
  };
}

export async function intakeRoutes(app: FastifyInstance) {
  // All intake routes require authentication and are scoped to the user.
  app.addHook("preHandler", app.authenticate);

  // List every intake, newest first — the tool is collaborative, so users can
  // browse one another's submissions. Each intake carries its creator; the
  // client splits "mine" from the rest by comparing the creator id.
  app.get("/api/intakes", async () => {
    return prisma.intake.findMany({
      orderBy: { createdAt: "desc" },
      include: creatorInclude,
    });
  });

  // Aggregate stats for the dashboard. Read-only and global (the tool is
  // collaborative, so everyone sees the same team-wide numbers, including the
  // leaderboard). Registered before "/:id" so the static path wins. Computed in
  // JS from a single projection — `tags` is a JSON column, so there's no native
  // SQL aggregation to lean on, and the dataset is small.
  app.get("/api/intakes/stats", async () => {
    const rows = await prisma.intake.findMany({
      select: {
        createdAt: true,
        analyzedAt: true,
        analysisStatus: true,
        industry: true,
        tags: true,
        userId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return buildStats(rows);
  });

  // Get a single intake. Any signed-in user can read any intake (read-only for
  // non-owners — see the analyze route below). This is also the endpoint the
  // client polls while `analysisStatus` is "processing".
  app.get<{ Params: { id: string } }>(
    "/api/intakes/:id",
    async (request, reply) => {
      const intake = await prisma.intake.findUnique({
        where: { id: request.params.id },
        include: creatorInclude,
      });
      if (!intake) return reply.status(404).send({ error: "Intake not found" });
      return intake;
    },
  );

  // Create an intake and kick off AI analysis as a background job. We persist
  // the intake first (status "processing"), return 201 immediately, and analyze
  // out of band — so the user's input is never blocked on (or lost to) OpenAI.
  // The client navigates to the detail view and polls until analysis settles.
  // Rate-limited because each create spends an OpenAI call.
  app.post<{ Body: IntakeBody }>(
    "/api/intakes",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = request.body ?? {};
      const missing = FIELDS.filter((f) => !body[f]?.trim());
      if (missing.length > 0) {
        return reply
          .status(400)
          .send({ error: `Missing required fields: ${missing.join(", ")}` });
      }

      const created = await prisma.intake.create({
        data: {
          title: body.title!.trim(),
          description: body.description!.trim(),
          budgetRange: body.budgetRange!.trim(),
          timeline: body.timeline!.trim(),
          industry: body.industry!.trim(),
          userId: request.user.sub,
          analysisStatus: "processing",
        },
        include: creatorInclude,
      });

      claimAnalysis(created.id); // always true for a fresh id
      startClaimedJob(created);
      return reply.status(201).send(created);
    },
  );

  // Re-run AI analysis for an existing intake (retry after a failed run, or
  // regenerate). Owner-only, capped per intake (MAX_REANALYSIS), guarded against
  // concurrent runs, and rate-limited. Sets the intake back to "processing" and
  // returns 202; the client polls the detail endpoint for the result.
  app.post<{ Params: { id: string } }>(
    "/api/intakes/:id/analyze",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const intake = await prisma.intake.findUnique({
        where: { id: request.params.id },
      });
      if (!intake) return reply.status(404).send({ error: "Intake not found" });
      if (intake.userId !== request.user.sub) {
        return reply
          .status(403)
          .send({ error: "Only the creator can run analysis on this intake." });
      }
      if (intake.analysisRunCount >= MAX_REANALYSIS) {
        return reply.status(429).send({
          error: `Re-analysis limit reached (${MAX_REANALYSIS} per intake).`,
        });
      }
      // Don't start a second run while one is active (also prevents burning a
      // re-analysis from the cap on a no-op).
      if (!claimAnalysis(intake.id)) {
        return reply
          .status(409)
          .send({ error: "Analysis is already running for this intake." });
      }

      try {
        const updated = await prisma.intake.update({
          where: { id: intake.id },
          data: {
            analysisRunCount: { increment: 1 },
            analysisStatus: "processing",
            analysisError: null,
          },
          include: creatorInclude,
        });
        startClaimedJob(updated);
        return reply.status(202).send(updated);
      } catch (err) {
        inFlight.delete(intake.id); // never started — release the claim
        throw err;
      }
    },
  );
}
