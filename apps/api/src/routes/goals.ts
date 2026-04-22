import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { CreateGoalSchema, UpdateGoalSchema } from "@coachline/shared";
import { logAudit } from "../middleware/audit";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export default async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.post<{ Body: { practiceArea: string; targetMetric: string; customLabel?: string } }>("/", async (request, reply) => {
    const parsed = CreateGoalSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation", message: parsed.error.message });
    const goal = await getPrisma().goal.create({
      data: { userId: request.userId, practiceArea: parsed.data.practiceArea, targetMetric: parsed.data.targetMetric, customLabel: parsed.data.customLabel ?? null },
    });
    await logAudit({ userId: request.userId, action: "goal.create", resourceType: "Goal", resourceId: goal.id });
    return reply.status(201).send(goal);
  });

  fastify.get("/", async (request) => {
    return getPrisma().goal.findMany({ where: { userId: request.userId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  });

  fastify.patch<{ Params: { id: string }; Body: { status?: string; targetMetric?: string } }>("/:id", async (request, reply) => {
    const parsed = UpdateGoalSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation", message: parsed.error.message });
    const goal = await getPrisma().goal.findFirst({ where: { id: request.params.id, userId: request.userId } });
    if (!goal) return reply.status(404).send({ error: "not_found", message: "Goal not found" });
    return getPrisma().goal.update({ where: { id: goal.id }, data: parsed.data });
  });

  fastify.get<{ Params: { id: string } }>("/:id/progress", async (request, reply) => {
    const goal = await getPrisma().goal.findFirst({ where: { id: request.params.id, userId: request.userId } });
    if (!goal) return reply.status(404).send({ error: "not_found", message: "Goal not found" });
    return getPrisma().goalProgress.findMany({
      where: { goalId: goal.id }, orderBy: { createdAt: "asc" },
      include: { report: { select: { createdAt: true, recording: { select: { title: true, recordedAt: true } } } } },
    });
  });
}
