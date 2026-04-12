import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as jose from "jose";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "coachline-dev-secret-change-in-production");

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("userId", "");
  fastify.decorateRequest("userEmail", "");

  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "unauthorized", message: "Missing token" });
      }

      const token = authHeader.slice(7);

      try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        request.userId = payload.sub as string;
        request.userEmail = payload.email as string;
      } catch {
        return reply.status(401).send({ error: "unauthorized", message: "Invalid token" });
      }
    }
  );
}

export default fp(authPlugin);

// Helper to create tokens — exported for use by auth routes
export async function createAccessToken(userId: string, email: string): Promise<string> {
  return new jose.SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

export async function createRefreshToken(userId: string, email: string): Promise<string> {
  return new jose.SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export { JWT_SECRET };
