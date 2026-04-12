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

async function authPlugin(fastify: FastifyInstance) {
  const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

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
        const JWKS = jose.createRemoteJWKSet(
          new URL(`https://api.workos.com/sso/jwks/${WORKOS_CLIENT_ID}`)
        );
        const { payload } = await jose.jwtVerify(token, JWKS);
        request.userId = payload.sub as string;
        request.userEmail = payload.email as string;
      } catch {
        return reply.status(401).send({ error: "unauthorized", message: "Invalid token" });
      }
    }
  );
}

export default fp(authPlugin);
