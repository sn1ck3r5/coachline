import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { UpdateUserSchema } from "@coachline/shared";
import { deleteObject } from "../services/s3";
import { logAudit } from "../middleware/audit";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  const USER_SELECT = { id: true, email: true, name: true, role: true, avatarUrl: true, voiceEnrollmentUrl: true, createdAt: true, updatedAt: true } as const;

  fastify.get("/me", async (request, reply) => {
    const user = await getPrisma().user.findUnique({ where: { id: request.userId }, select: USER_SELECT });
    if (!user) return reply.status(404).send({ error: "not_found", message: "User not found" });
    return user;
  });

  fastify.patch<{ Body: { name?: string; avatarUrl?: string | null } }>("/me", async (request, reply) => {
    const parsed = UpdateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation", message: parsed.error.message });
    return getPrisma().user.update({ where: { id: request.userId }, data: parsed.data, select: USER_SELECT });
  });

  // DELETE /users/me — full account deletion (FERPA compliance)
  fastify.delete("/me", async (request, reply) => {
    const recordings = await getPrisma().lessonRecording.findMany({ where: { userId: request.userId }, select: { audioUrl: true } });
    const user = await getPrisma().user.findUnique({ where: { id: request.userId }, select: { voiceEnrollmentUrl: true } });
    const deletePromises = recordings.map((r) => deleteObject(r.audioUrl));
    if (user?.voiceEnrollmentUrl) deletePromises.push(deleteObject(user.voiceEnrollmentUrl));
    await Promise.allSettled(deletePromises);
    await logAudit({ userId: request.userId, action: "account.delete", resourceType: "User", resourceId: request.userId });
    await getPrisma().user.delete({ where: { id: request.userId } });
    return reply.status(204).send();
  });
}
