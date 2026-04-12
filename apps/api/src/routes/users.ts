import type { FastifyInstance } from "fastify";
export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // Routes implemented in Task 10
  fastify.all("/", async () => {});
  fastify.all("/*", async () => {});
}
