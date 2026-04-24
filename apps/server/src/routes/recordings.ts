import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { CreateRecordingSchema, UploadUrlSchema } from "@coachline/shared";
import { getUploadUrl, deleteObject } from "../services/s3";
import { enqueueProcessingJob } from "../services/queue";
import { logAudit } from "../middleware/audit";
import { randomUUID } from "crypto";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /recordings/upload-url — get presigned S3 URL
  fastify.post<{ Body: { contentType: string; fileName: string } }>("/upload-url", async (request, reply) => {
    // Strip codec parameters (e.g., "video/mp4; codecs=avc1.42000a,mp4a.40.2" → "video/mp4")
    const baseContentType = (request.body.contentType || "").split(";")[0].trim();
    const parsed = UploadUrlSchema.safeParse({ ...request.body, contentType: baseContentType });
    if (!parsed.success) return reply.status(400).send({ error: "validation", message: parsed.error.message });
    const key = `recordings/${request.userId}/${randomUUID()}/${parsed.data.fileName}`;
    // Use the original content type (with codecs) for S3 so playback works correctly
    const { url, expiresAt } = await getUploadUrl(key, request.body.contentType);
    return { url, key, expiresAt: expiresAt.toISOString() };
  });

  // POST /recordings — create recording + enqueue processing
  fastify.post<{ Body: { audioUrl: string; durationSeconds: number; fileSizeBytes: number; title?: string; intent?: string | null } }>("/", async (request, reply) => {
    const parsed = CreateRecordingSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation", message: parsed.error.message });
    const recording = await getPrisma().lessonRecording.create({
      data: {
        userId: request.userId,
        audioUrl: parsed.data.audioUrl,
        durationSeconds: parsed.data.durationSeconds,
        fileSizeBytes: parsed.data.fileSizeBytes,
        title: parsed.data.title ?? null,
        intent: parsed.data.intent ?? null,
        status: "processing",
      },
    });
    await enqueueProcessingJob({ recordingId: recording.id, userId: request.userId, audioUrl: recording.audioUrl });
    await logAudit({ userId: request.userId, action: "recording.create", resourceType: "LessonRecording", resourceId: recording.id });
    return reply.status(201).send(recording);
  });

  // GET /recordings — list (paginated, cursor-based)
  fastify.get<{ Querystring: { cursor?: string; limit?: string } }>("/", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "20"), 50);
    const cursor = request.query.cursor;
    const recordings = await getPrisma().lessonRecording.findMany({
      where: { userId: request.userId }, orderBy: { createdAt: "desc" }, take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = recordings.length > limit;
    const data = hasMore ? recordings.slice(0, limit) : recordings;
    return { data, cursor: hasMore ? data[data.length - 1].id : null, hasMore };
  });

  // GET /recordings/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const recording = await getPrisma().lessonRecording.findFirst({ where: { id: request.params.id, userId: request.userId } });
    if (!recording) return reply.status(404).send({ error: "not_found", message: "Recording not found" });
    return recording;
  });

  // DELETE /recordings/:id — hard delete + S3 cleanup
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const recording = await getPrisma().lessonRecording.findFirst({ where: { id: request.params.id, userId: request.userId } });
    if (!recording) return reply.status(404).send({ error: "not_found", message: "Recording not found" });
    await deleteObject(recording.audioUrl);
    await getPrisma().lessonRecording.delete({ where: { id: recording.id } });
    await logAudit({ userId: request.userId, action: "recording.delete", resourceType: "LessonRecording", resourceId: recording.id });
    return reply.status(204).send();
  });
}
