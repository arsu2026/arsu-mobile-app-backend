import type { ActivityType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

export async function createActivity(data: {
  userId: string;
  type: ActivityType;
  entityId?: string | null;
  entityType?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.activityLog.create({
    data: {
      userId: data.userId,
      type: data.type,
      entityId: data.entityId ?? null,
      entityType: data.entityType ?? null,
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    },
  });
}

export async function listByUser(
  userId: string,
  type: ActivityType | undefined,
  skip: number,
  take: number,
) {
  const where: Prisma.ActivityLogWhereInput = { userId, ...(type ? { type } : {}) };
  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.activityLog.count({ where }),
  ]);
  return { rows, total };
}
