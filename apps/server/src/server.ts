import Fastify from "fastify";
import next from "next";
import path from "path";
import { fileURLToPath } from "url";
import { subscribeToProcessingJobs, shutdownBoss } from "./services/queue";
import { processLesson } from "./pipeline/orchestrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "..", "web");

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || "info" },
});

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev, dir: WEB_DIR });
const nextHandler = nextApp.getRequestHandler();

// Health check
app.get("/health", async () => ({ status: "ok" }));

// API plugins
app.register(import("./plugins/cors"));
app.register(import("./plugins/auth"));
app.register(import("./plugins/rate-limit"));

// API routes (prefixed so the Next catch-all can take everything else)
app.register(import("./routes/auth"), { prefix: "/auth" });
app.register(import("./routes/recordings"), { prefix: "/recordings" });
app.register(import("./routes/voice-enrollment"), { prefix: "/voice-enrollment" });
app.register(import("./routes/reports"), { prefix: "/reports" });
app.register(import("./routes/goals"), { prefix: "/goals" });
app.register(import("./routes/users"), { prefix: "/users" });

// Next.js fallback — any request that doesn't match an API route is
// handed to Next.js. Using setNotFoundHandler instead of app.all("/*")
// avoids colliding with @fastify/cors's OPTIONS preflight registration.
app.setNotFoundHandler(async (req, reply) => {
  await nextHandler(req.raw, reply.raw);
  reply.hijack();
});

const PORT = parseInt(process.env.PORT || "3001");

async function start() {
  try {
    await nextApp.prepare();
    app.log.info("Next.js ready");

    await subscribeToProcessingJobs(async (data) => {
      await processLesson(data);
    });
    app.log.info("pg-boss worker subscribed to lesson-processing queue");

    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  try {
    await shutdownBoss();
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
