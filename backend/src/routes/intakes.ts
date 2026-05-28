import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { performAnalysis, type IntakeInput } from "../ai.js";

type IntakeBody = Partial<IntakeInput>;

const FIELDS: (keyof IntakeInput)[] = [
  "title",
  "description",
  "budgetRange",
  "timeline",
  "industry",
];

type IntakeRecord = IntakeInput & { id: string };

type AnalyzeResult =
  | { ok: true; intake: Awaited<ReturnType<typeof prisma.intake.update>> }
  | { ok: false; status: number; error: string };

// Run analysis for an intake, record the attempt in IntakeAnalysisRequest
// (success or failure), and on success persist the result onto the intake.
async function analyzeAndLog(intake: IntakeRecord): Promise<AnalyzeResult> {
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

  if (!outcome.ok) {
    return { ok: false, status: outcome.status, error: outcome.error };
  }

  const updated = await prisma.intake.update({
    where: { id: intake.id },
    data: {
      summary: outcome.analysis.summary,
      tags: outcome.analysis.tags,
      riskChecklist: outcome.analysis.riskChecklist,
      analyzedAt: new Date(),
    },
  });
  return { ok: true, intake: updated };
}

export async function intakeRoutes(app: FastifyInstance) {
  // All intake routes require authentication and are scoped to the user.
  app.addHook("preHandler", app.authenticate);

  // List the authenticated user's intakes, newest first.
  app.get("/api/intakes", async (request) => {
    return prisma.intake.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
    });
  });

  // Get a single intake the user owns.
  app.get<{ Params: { id: string } }>(
    "/api/intakes/:id",
    async (request, reply) => {
      const intake = await prisma.intake.findFirst({
        where: { id: request.params.id, userId: request.user.sub },
      });
      if (!intake) return reply.status(404).send({ error: "Intake not found" });
      return intake;
    },
  );

  // Create an intake AND run AI analysis. The intake is persisted first, so a
  // failed analysis never loses the user's input: we return 201 with the saved
  // intake plus an `analysisError` the client can retry from.
  app.post<{ Body: IntakeBody }>("/api/intakes", async (request, reply) => {
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
      },
    });

    const result = await analyzeAndLog(created);
    if (result.ok) {
      return reply.status(201).send(result.intake);
    }
    // Intake is saved; analysis failed. Surface the error for retry.
    return reply.status(201).send({ ...created, analysisError: result.error });
  });

  // Re-run AI analysis for an existing intake (retry / regenerate).
  app.post<{ Params: { id: string } }>(
    "/api/intakes/:id/analyze",
    async (request, reply) => {
      const intake = await prisma.intake.findFirst({
        where: { id: request.params.id, userId: request.user.sub },
      });
      if (!intake) return reply.status(404).send({ error: "Intake not found" });

      const result = await analyzeAndLog(intake);
      if (result.ok) return result.intake;
      return reply.status(result.status).send({ error: result.error });
    },
  );
}
