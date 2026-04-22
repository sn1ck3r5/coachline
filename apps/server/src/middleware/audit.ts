import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export async function logAudit(params: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
