import type { FastifyInstance } from "fastify";
export default async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // Routes implemented in Task 9
  fastify.all("/", async () => {});
  fastify.all("/*", async () => {});
}
