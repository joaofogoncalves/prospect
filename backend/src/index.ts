import "./env.js";
import { env } from "./env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./db.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Health check.
app.get("/health", async () => ({ status: "ok" }));

// List projects.
app.get("/api/projects", async () => {
  return prisma.project.findMany({ orderBy: { createdAt: "desc" } });
});

// Create a project.
app.post<{ Body: { name: string; description?: string } }>(
  "/api/projects",
  async (request, reply) => {
    const { name, description } = request.body ?? {};
    if (!name) {
      return reply.status(400).send({ error: "name is required" });
    }
    const project = await prisma.project.create({
      data: { name, description },
    });
    return reply.status(201).send(project);
  },
);

const start = async () => {
  try {
    await app.listen({ port: env.port, host: env.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
