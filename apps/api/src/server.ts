import Fastify from "fastify";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || "info" },
});

// Health check
app.get("/health", async () => ({ status: "ok" }));

// Plugins
app.register(import("./plugins/cors"));
app.register(import("./plugins/auth"));
app.register(import("./plugins/rate-limit"));

// Routes
app.register(import("./routes/auth"), { prefix: "/auth" });
app.register(import("./routes/recordings"), { prefix: "/recordings" });
app.register(import("./routes/voice-enrollment"), { prefix: "/voice-enrollment" });
app.register(import("./routes/reports"), { prefix: "/reports" });
app.register(import("./routes/goals"), { prefix: "/goals" });
app.register(import("./routes/users"), { prefix: "/users" });

const PORT = parseInt(process.env.PORT || "3001");

async function start() {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
