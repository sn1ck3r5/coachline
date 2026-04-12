import type { FastifyInstance } from "fastify";
export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // Routes implemented in Task 8
  fastify.all("/", async () => {});
  fastify.all("/*", async () => {});
}
