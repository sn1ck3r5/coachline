import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: [process.env.WEB_URL || "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
}

export default fp(corsPlugin);
