import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { env } from "./env.js";

// The shape we store inside the JWT.
export type AuthPayload = { sub: string; email: string };

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthPayload;
    user: AuthPayload;
  }
}

// Registers JWT support and an `authenticate` preHandler that rejects
// requests without a valid bearer token.
export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyJwt, { secret: env.jwtSecret });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ error: "Unauthorized" });
      }
    },
  );
});
