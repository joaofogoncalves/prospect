import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { analyzeIntake, AnalysisError } from "../ai.js";

type IntakeBody = {
  title?: string;
  description?: string;
  budgetRange?: string;
  timeline?: string;
  industry?: string;
};

const FIELDS = [
  "title",
  "description",
  "budgetRange",
  "timeline",
  "industry",
] as const;

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

  // Create an intake (core fields only; AI analysis is a separate step).
  app.post<{ Body: IntakeBody }>("/api/intakes", async (request, reply) => {
    const body = request.body ?? {};
    const missing = FIELDS.filter((f) => !body[f]?.trim());
    if (missing.length > 0) {
      return reply
        .status(400)
        .send({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    const intake = await prisma.intake.create({
      data: {
        title: body.title!.trim(),
        description: body.description!.trim(),
        budgetRange: body.budgetRange!.trim(),
        timeline: body.timeline!.trim(),
        industry: body.industry!.trim(),
        userId: request.user.sub,
      },
    });
    return reply.status(201).send(intake);
  });

  // Run (or re-run) AI analysis for an intake and persist the result.
  app.post<{ Params: { id: string } }>(
    "/api/intakes/:id/analyze",
    async (request, reply) => {
      const intake = await prisma.intake.findFirst({
        where: { id: request.params.id, userId: request.user.sub },
      });
      if (!intake) return reply.status(404).send({ error: "Intake not found" });

      try {
        const analysis = await analyzeIntake(intake);
        const updated = await prisma.intake.update({
          where: { id: intake.id },
          data: {
            summary: analysis.summary,
            tags: analysis.tags,
            riskChecklist: analysis.riskChecklist,
            analyzedAt: new Date(),
          },
        });
        return updated;
      } catch (err) {
        if (err instanceof AnalysisError) {
          return reply.status(err.status).send({ error: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ error: "Analysis failed" });
      }
    },
  );
}
