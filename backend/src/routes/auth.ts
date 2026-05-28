import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

type Credentials = { email: string; password: string; name?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // Register a new user.
  app.post<{ Body: Credentials }>("/api/auth/register", async (request, reply) => {
    const { email, password, name } = request.body ?? {};

    if (!email || !EMAIL_RE.test(email)) {
      return reply.status(400).send({ error: "A valid email is required" });
    }
    if (!password || password.length < 8) {
      return reply
        .status(400)
        .send({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name ?? null, passwordHash },
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.status(201).send({ token, user: publicUser(user) });
  });

  // Log in an existing user.
  app.post<{ Body: Credentials }>("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body ?? {};
    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.send({ token, user: publicUser(user) });
  });

  // Return the currently authenticated user.
  app.get(
    "/api/auth/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return publicUser(user);
    },
  );

  // Change the current user's password (requires the current password). The
  // client signs out afterwards, so any other sessions keep their old token
  // until it expires — acceptable for this app.
  app.post<{ Body: { currentPassword?: string; newPassword?: string } }>(
    "/api/auth/change-password",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body ?? {};
      if (!currentPassword || !newPassword) {
        return reply
          .status(400)
          .send({ error: "Current and new password are required" });
      }
      if (newPassword.length < 8) {
        return reply
          .status(400)
          .send({ error: "Password must be at least 8 characters" });
      }

      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });

      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return reply.status(401).send({ error: "Current password is incorrect" });
      }
      if (currentPassword === newPassword) {
        return reply
          .status(400)
          .send({ error: "New password must differ from the current one" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      return reply.status(204).send();
    },
  );
}
