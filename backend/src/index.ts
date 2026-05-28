import "./env.js";
import { env } from "./env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { authPlugin } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(authPlugin);

// Health check.
app.get("/health", async () => ({ status: "ok" }));

await app.register(authRoutes);
await app.register(projectRoutes);

const start = async () => {
  try {
    await app.listen({ port: env.port, host: env.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
