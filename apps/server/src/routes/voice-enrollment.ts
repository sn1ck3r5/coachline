import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { getUploadUrl } from "../services/s3";
import { randomUUID } from "crypto";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export default async function voiceEnrollmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.post("/upload-url", async (request) => {
    const key = `voice-enrollment/${request.userId}/${randomUUID()}.m4a`;
    const { url, expiresAt } = await getUploadUrl(key, "audio/x-m4a");
    return { url, key, expiresAt: expiresAt.toISOString() };
  });

  fastify.post<{ Body: { voiceEnrollmentUrl: string } }>("/", async (request) => {
    const user = await getPrisma().user.update({
      where: { id: request.userId },
      data: { voiceEnrollmentUrl: request.body.voiceEnrollmentUrl },
    });
    return { voiceEnrollmentUrl: user.voiceEnrollmentUrl };
  });

  fastify.get("/", async (request) => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { voiceEnrollmentUrl: true },
    });
    return { enrolled: user.voiceEnrollmentUrl !== null, voiceEnrollmentUrl: user.voiceEnrollmentUrl };
  });
}
