import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const actorSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.ProfileSelect;

export async function listByRecipient(recipientId: string, skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: actorSelect } },
    }),
    prisma.notification.count({ where: { recipientId } }),
  ]);
  return { rows, total };
}

export async function countUnread(recipientId: string) {
  return prisma.notification.count({ where: { recipientId, isRead: false } });
}

export async function findOwned(recipientId: string, id: string) {
  return prisma.notification.findFirst({
    where: { id, recipientId },
    include: { actor: { select: actorSelect } },
  });
}

export async function markRead(recipientId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, recipientId, isRead: false },
    data: { isRead: true },
  });
}

export async function markAllRead(recipientId: string) {
  return prisma.notification.updateMany({
    where: { recipientId, isRead: false },
    data: { isRead: true },
  });
}

export async function deleteOne(recipientId: string, id: string) {
  return prisma.notification.deleteMany({ where: { id, recipientId } });
}

export async function deleteAll(recipientId: string) {
  return prisma.notification.deleteMany({ where: { recipientId } });
}

export async function createNotification(data: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  entityId?: string | null;
  message?: string | null;
}) {
  return prisma.notification.create({
    data: {
      recipientId: data.recipientId,
      actorId: data.actorId,
      type: data.type,
      entityId: data.entityId ?? null,
      message: data.message ?? null,
    },
  });
}

export async function ensurePreferences(profileId: string) {
  return prisma.notificationPreference.upsert({
    where: { profileId },
    create: { profileId },
    update: {},
  });
}

export async function updatePreferences(
  profileId: string,
  data: Prisma.NotificationPreferenceUpdateInput,
) {
  await ensurePreferences(profileId);
  return prisma.notificationPreference.update({ where: { profileId }, data });
}
