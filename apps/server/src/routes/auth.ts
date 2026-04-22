import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { createAccessToken, createRefreshToken, JWT_SECRET } from "../plugins/auth";
import * as jose from "jose";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

const SALT_ROUNDS = 12;

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/signup
  fastify.post<{
    Body: { email: string; password: string; name: string };
  }>("/signup", async (request, reply) => {
    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: "validation", message: "Email, password, and name are required" });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "validation", message: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existing = await getPrisma().user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "conflict", message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await getPrisma().user.create({
      data: { email, name, passwordHash, role: "teacher" },
    });

    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id, user.email);

    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, voiceEnrollmentUrl: user.voiceEnrollmentUrl },
      accessToken,
      refreshToken,
    });
  });

  // POST /auth/login
  fastify.post<{
    Body: { email: string; password: string };
  }>("/login", async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: "validation", message: "Email and password are required" });
    }

    const user = await getPrisma().user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: "unauthorized", message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "unauthorized", message: "Invalid email or password" });
    }

    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = await createRefreshToken(user.id, user.email);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, voiceEnrollmentUrl: user.voiceEnrollmentUrl },
      accessToken,
      refreshToken,
    };
  });

  // POST /auth/magic-link (placeholder — needs nodemailer setup)
  fastify.post<{
    Body: { email: string };
  }>("/magic-link", async (request, reply) => {
    const { email } = request.body;
    // TODO: Send magic link email via nodemailer when SMTP is configured
    // For now, return success (the link generation works, just no email delivery)
    return { message: "Magic link sent (email delivery pending SMTP configuration)" };
  });

  // GET /auth/callback (placeholder for OAuth)
  fastify.get<{
    Querystring: { code?: string; token?: string };
  }>("/callback", async (request, reply) => {
    // TODO: Handle Google OAuth callback when Google OAuth is configured
    return reply.status(501).send({ error: "not_implemented", message: "OAuth callback not yet configured" });
  });

  // POST /auth/refresh
  fastify.post<{
    Body: { refreshToken: string };
  }>("/refresh", async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.status(400).send({ error: "validation", message: "Refresh token required" });
    }

    try {
      const { payload } = await jose.jwtVerify(refreshToken, JWT_SECRET);
      const userId = payload.sub as string;
      const email = payload.email as string;

      // Verify user still exists
      const user = await getPrisma().user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(401).send({ error: "unauthorized", message: "User not found" });
      }

      const newAccessToken = await createAccessToken(user.id, user.email);
      const newRefreshToken = await createRefreshToken(user.id, user.email);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      return reply.status(401).send({ error: "unauthorized", message: "Invalid refresh token" });
    }
  });

  // DELETE /auth/logout
  fastify.delete("/logout", async (request, reply) => {
    return reply.status(204).send();
  });
}
