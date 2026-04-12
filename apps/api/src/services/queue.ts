import { Queue } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
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
