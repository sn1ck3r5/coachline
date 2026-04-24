import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { getPlaybackUrl } from "../services/s3";
import { logAudit } from "../middleware/audit";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /reports — list completed reports (paginated)
  fastify.get<{ Querystring: { cursor?: string; limit?: string } }>("/", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "20"), 50);
    const cursor = request.query.cursor;
    const reports = await getPrisma().lessonReport.findMany({
      where: { userId: request.userId, status: "completed" },
      orderBy: { createdAt: "desc" },
      include: { recording: { select: { title: true, durationSeconds: true, recordedAt: true, intent: true } } },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = reports.length > limit;
    const data = hasMore ? reports.slice(0, limit) : reports;
    return { data, cursor: hasMore ? data[data.length - 1].id : null, hasMore };
  });

  // GET /reports/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const report = await getPrisma().lessonReport.findFirst({
      where: { id: request.params.id, userId: request.userId },
      include: { recording: { select: { title: true, durationSeconds: true, recordedAt: true, intent: true } } },
    });
    if (!report) return reply.status(404).send({ error: "not_found", message: "Report not found" });
    await logAudit({ userId: request.userId, action: "report.view", resourceType: "LessonReport", resourceId: report.id });
    return report;
  });

  // GET /reports/:id/transcript
  fastify.get<{ Params: { id: string } }>("/:id/transcript", async (request, reply) => {
    const report = await getPrisma().lessonReport.findFirst({ where: { id: request.params.id, userId: request.userId }, select: { id: true } });
    if (!report) return reply.status(404).send({ error: "not_found", message: "Report not found" });
    const transcript = await getPrisma().transcript.findUnique({ where: { reportId: report.id } });
    if (!transcript) return reply.status(404).send({ error: "not_found", message: "Transcript not found" });
    return transcript;
  });

  // GET /reports/:id/insights
  fastify.get<{ Params: { id: string }; Querystring: { type?: string } }>("/:id/insights", async (request, reply) => {
    const report = await getPrisma().lessonReport.findFirst({ where: { id: request.params.id, userId: request.userId }, select: { id: true } });
    if (!report) return reply.status(404).send({ error: "not_found", message: "Report not found" });
    const insights = await getPrisma().insight.findMany({
      where: { reportId: report.id, ...(request.query.type ? { type: request.query.type } : {}) },
      orderBy: { startMs: "asc" },
    });
    return insights;
  });

  // GET /reports/:id/audio-url — presigned playback URL
  fastify.get<{ Params: { id: string } }>("/:id/audio-url", async (request, reply) => {
    const report = await getPrisma().lessonReport.findFirst({
      where: { id: request.params.id, userId: request.userId },
      include: { recording: { select: { audioUrl: true } } },
    });
    if (!report) return reply.status(404).send({ error: "not_found", message: "Report not found" });
    const { url, expiresAt } = await getPlaybackUrl(report.recording.audioUrl);
    return { url, expiresAt: expiresAt.toISOString() };
  });
}
