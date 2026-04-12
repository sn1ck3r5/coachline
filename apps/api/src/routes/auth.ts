import type { FastifyInstance } from "fastify";
import { WorkOS } from "@workos-inc/node";
import { PrismaClient } from "@prisma/client";

// Lazy singletons — deferred to first use so the module can be imported
// in test environments where WORKOS_API_KEY / DATABASE_URL may not be set.
let _prisma: PrismaClient | undefined;
let _workos: WorkOS | undefined;

function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

function getWorkos(): WorkOS {
  if (!_workos) _workos = new WorkOS(process.env.WORKOS_API_KEY);
  return _workos;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/signup
  fastify.post<{
    Body: { email: string; password: string; name: string };
  }>("/signup", async (request, reply) => {
    const { email, password, name } = request.body;

    const authResponse = await getWorkos().userManagement.createUser({
      email,
      password,
      firstName: name.split(" ")[0],
      lastName: name.split(" ").slice(1).join(" ") || undefined,
    });

    const user = await getPrisma().user.create({
      data: {
        id: authResponse.id,
        email: authResponse.email,
        name,
        role: "teacher",
      },
    });

    const session = await getWorkos().userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  });

  // POST /auth/login
  fastify.post<{
    Body: { email: string; password: string };
  }>("/login", async (request, reply) => {
    const { email, password } = request.body;

    const session = await getWorkos().userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    const user = await getPrisma().user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return reply.status(404).send({ error: "not_found", message: "User not found" });
    }

    return { user, accessToken: session.accessToken, refreshToken: session.refreshToken };
  });

  // POST /auth/magic-link
  fastify.post<{
    Body: { email: string };
  }>("/magic-link", async (request, reply) => {
    const { email } = request.body;
    await getWorkos().userManagement.createMagicAuth({ email });
    return { message: "Magic link sent" };
  });

  // GET /auth/callback
  fastify.get<{
    Querystring: { code: string };
  }>("/callback", async (request, reply) => {
    const { code } = request.query;

    const session = await getWorkos().userManagement.authenticateWithCode({
      code,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    const user = await getPrisma().user.upsert({
      where: { id: session.user.id },
      update: { email: session.user.email },
      create: {
        id: session.user.id,
        email: session.user.email,
        name:
          [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
          session.user.email,
        role: "teacher",
      },
    });

    return { user, accessToken: session.accessToken, refreshToken: session.refreshToken };
  });

  // POST /auth/refresh
  fastify.post<{
    Body: { refreshToken: string };
  }>("/refresh", async (request, reply) => {
    const { refreshToken } = request.body;

    const session = await getWorkos().userManagement.authenticateWithRefreshToken({
      refreshToken,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    return { accessToken: session.accessToken, refreshToken: session.refreshToken };
  });

  // DELETE /auth/logout
  fastify.delete("/logout", async (request, reply) => {
    return reply.status(204).send();
  });
}
