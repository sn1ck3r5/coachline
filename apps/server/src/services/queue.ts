import PgBoss from "pg-boss";

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is required");
  process.exit(1);
}

const QUEUE_NAME = "lesson-processing";

let _boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;
  _boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  _boss.on("error", (err) => console.error("pg-boss error:", err));
  await _boss.start();
  await _boss.createQueue(QUEUE_NAME);
  return _boss;
}

export interface LessonJobData {
  recordingId: string;
  userId: string;
  audioUrl: string;
}

export async function enqueueProcessingJob(data: LessonJobData): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUE_NAME, data, {
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
  });
}

export async function subscribeToProcessingJobs(
  handler: (data: LessonJobData) => Promise<void>
): Promise<void> {
  const boss = await getBoss();
  await boss.work<LessonJobData>(
    QUEUE_NAME,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      console.log("Processing job %s: recording %s", job.id, job.data.recordingId);
      await handler(job.data);
      console.log("Completed job %s", job.id);
    }
  );
}

export async function shutdownBoss(): Promise<void> {
  if (_boss) {
    await _boss.stop({ graceful: true });
    _boss = null;
  }
}

export { QUEUE_NAME };
