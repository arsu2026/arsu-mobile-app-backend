import { BadRequestError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as repo from './notification.repository';
import type { NotificationView } from './notification.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidId(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw new BadRequestError('Invalid notification ID format');
  }
}

type NotificationRow = NonNullable<Awaited<ReturnType<typeof repo.findOwned>>>;

function mapNotification(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    actor: {
      id: row.actor.id,
      username: row.actor.username,
      fullName: row.actor.fullName,
      avatarUrl: row.actor.avatarUrl,
    },
    entityId: row.entityId,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getNotifications(
  recipientId: string,
  page: number,
  limit: number,
): Promise<{ notifications: NotificationView[]; meta: PaginationMeta }> {
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listByRecipient(recipientId, skip, limit);
  return {
    notifications: rows.map(mapNotification),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getUnreadCount(recipientId: string): Promise<{ count: number }> {
  const count = await repo.countUnread(recipientId);
  return { count };
}

export async function markAsRead(recipientId: string, id: string): Promise<NotificationView> {
  assertValidId(id);
  const existing = await repo.findOwned(recipientId, id);
  if (!existing) throw new NotFoundError('Notification');
  await repo.markRead(recipientId, id);
  return mapNotification({ ...existing, isRead: true });
}

export async function markAllAsRead(recipientId: string): Promise<void> {
  await repo.markAllRead(recipientId);
}

export async function deleteNotification(recipientId: string, id: string): Promise<void> {
  assertValidId(id);
  const { count } = await repo.deleteOne(recipientId, id);
  if (count === 0) throw new NotFoundError('Notification');
}

export async function clearAll(recipientId: string): Promise<void> {
  await repo.deleteAll(recipientId);
}
