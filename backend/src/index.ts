import "./env.js";
import { env } from "./env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authPlugin } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { intakeRoutes } from "./routes/intakes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
// Rate limiting is opt-in per route (global: false) — applied to the endpoints
// that spend OpenAI calls (create + analyze in routes/intakes.ts) to cap cost.
// Keyed by client IP (the default); the per-intake MAX_REANALYSIS cap provides
// the per-user/per-resource limit.
await app.register(rateLimit, { global: false });
await app.register(authPlugin);

// Health check.
app.get("/health", async () => ({ status: "ok" }));

await app.register(authRoutes);
await app.register(intakeRoutes);

const start = async () => {
  try {
    await app.listen({ port: env.port, host: env.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
