import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(import("../src/plugins/cors"));
  await app.register(import("../src/plugins/auth"));

  await app.register(import("../src/routes/auth"), { prefix: "/auth" });
  await app.register(import("../src/routes/recordings"), { prefix: "/recordings" });
  await app.register(import("../src/routes/voice-enrollment"), { prefix: "/voice-enrollment" });
  await app.register(import("../src/routes/reports"), { prefix: "/reports" });
  await app.register(import("../src/routes/goals"), { prefix: "/goals" });
  await app.register(import("../src/routes/users"), { prefix: "/users" });

  await app.ready();
  return app;
}
