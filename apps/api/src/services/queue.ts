import { Queue } from "bullmq";

if (!process.env.REDIS_URL) {
  console.error("FATAL: REDIS_URL environment variable is required");
  process.exit(1);
}
const redisUrl = new URL(process.env.REDIS_URL);
const connection = { host: redisUrl.hostname, port: parseInt(redisUrl.port || "6379") };

export const processingQueue = new Queue("lesson-processing", { connection });

export async function enqueueProcessingJob(data: {
  recordingId: string;
  userId: string;
  audioUrl: string;
}) {
  await processingQueue.add("process-lesson", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}
