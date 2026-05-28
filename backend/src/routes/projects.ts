import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

type ProjectBody = { name: string; description?: string };

export async function projectRoutes(app: FastifyInstance) {
  // All project routes require authentication.
  app.addHook("preHandler", app.authenticate);

  // List the authenticated user's projects.
  app.get("/api/projects", async (request) => {
    return prisma.project.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
    });
  });

  // Create a project owned by the authenticated user.
  app.post<{ Body: ProjectBody }>("/api/projects", async (request, reply) => {
    const { name, description } = request.body ?? {};
    if (!name) {
      return reply.status(400).send({ error: "name is required" });
    }
    const project = await prisma.project.create({
      data: { name, description, userId: request.user.sub },
    });
    return reply.status(201).send(project);
  });
}
