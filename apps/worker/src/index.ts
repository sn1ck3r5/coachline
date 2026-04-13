import { Worker } from "bullmq";
import { createServer } from "http";
import { processLesson } from "./pipeline/orchestrator";
import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

// Health check HTTP server (required for Render free tier — runs as web service)
const PORT = parseInt(process.env.PORT || "3002");
const healthServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "worker" }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(PORT, "0.0.0.0", () => {
  console.log("Worker health server listening on port %d", PORT);
});

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || "6379"),
};

const worker = new Worker(
  "lesson-processing",
  async (job) => {
    console.log("Processing job %s: recording %s", job.id, job.data.recordingId);
    await processLesson(job.data);
    console.log("Completed job %s", job.id);
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", async (job, err) => {
  console.error("Job %s failed: %s", job?.id, err.message);

  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    // Mark recording as failed after all retries exhausted
    const prisma = getPrisma();
    await prisma.lessonRecording.update({
      where: { id: job.data.recordingId },
      data: { status: "failed" },
    });
  }
});

worker.on("ready", () => {
  console.log("Worker ready and listening for jobs");
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
