import type { FastifyInstance } from "fastify";
export default async function voiceEnrollmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // Routes implemented in Task 7
  fastify.all("/", async () => {});
  fastify.all("/*", async () => {});
}
