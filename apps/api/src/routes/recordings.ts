import type { FastifyInstance } from "fastify";
export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // Routes implemented in Task 6
  fastify.all("/", async () => {});
  fastify.all("/*", async () => {});
}
