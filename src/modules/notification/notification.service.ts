import type { NotificationType, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as repo from './notification.repository';
import type {
  NotificationPreferencesView,
  NotificationView,
  UpdateNotificationPrefsInput,
} from './notification.types';
import { fetchPostPreviews } from '../../common/utils/post-preview.util';
import type { PostPreview } from '../../common/utils/post-preview.util';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidId(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw new BadRequestError('Invalid notification ID format');
  }
}

type NotificationRow = NonNullable<Awaited<ReturnType<typeof repo.findOwned>>>;

const POST_PREVIEW_TYPES: NotificationType[] = ['LIKE', 'COMMENT', 'SHARE', 'MENTION'];

function mapNotification(
  row: NotificationRow,
  entityPreview: NotificationView['entityPreview'] = null,
): NotificationView {
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
    entityPreview,
  };
}

export async function getNotifications(
  recipientId: string,
  page: number,
  limit: number,
): Promise<{ notifications: NotificationView[]; meta: PaginationMeta }> {
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listByRecipient(recipientId, skip, limit);

  const postIds = rows
    .filter((r) => POST_PREVIEW_TYPES.includes(r.type) && r.entityId)
    .map((r) => r.entityId as string);
  const previews = await fetchPostPreviews(postIds);

  const notifications = rows.map((row) => {
    const preview: PostPreview | null =
      POST_PREVIEW_TYPES.includes(row.type) && row.entityId
        ? previews.get(row.entityId) ?? null
        : null;
    return mapNotification(row, preview);
  });

  return { notifications, meta: buildPaginationMeta(total, page, limit) };
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

type PrefFlag = 'comments' | 'tags' | 'moreActivityAboutYou' | 'updatesFromFriends';

// Which preference flag gates each notification type. `reminders` has no
// emitter today. null = always allowed (no gating).
const PREF_GATE: Record<NotificationType, PrefFlag | null> = {
  FOLLOW: 'updatesFromFriends',
  FOLLOW_REQUEST: 'updatesFromFriends',
  FOLLOW_ACCEPTED: 'updatesFromFriends',
  LIKE: 'moreActivityAboutYou',
  SHARE: 'moreActivityAboutYou',
  COMMENT: 'comments',
  MENTION: 'tags',
};

export async function emitNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  entityId?: string | null;
  message?: string | null;
}): Promise<void> {
  if (input.recipientId === input.actorId) return; // never notify yourself

  const prefs = await repo.ensurePreferences(input.recipientId);
  const gate = PREF_GATE[input.type];
  if (gate && !prefs[gate]) return; // recipient turned this category off

  await repo.createNotification({
    recipientId: input.recipientId,
    actorId: input.actorId,
    type: input.type,
    entityId: input.entityId ?? null,
    message: input.message ?? null,
  });
}

function mapPreferences(
  p: Awaited<ReturnType<typeof repo.ensurePreferences>>,
): NotificationPreferencesView {
  return {
    preferences: {
      comments: p.comments,
      tags: p.tags,
      reminders: p.reminders,
      moreActivityAboutYou: p.moreActivityAboutYou,
      updatesFromFriends: p.updatesFromFriends,
    },
    channels: { push: p.pushEnabled, email: p.emailEnabled, sms: p.smsEnabled },
  };
}

export async function getPreferences(userId: string): Promise<NotificationPreferencesView> {
  const prefs = await repo.ensurePreferences(userId);
  return mapPreferences(prefs);
}

export async function updatePreferences(
  userId: string,
  input: UpdateNotificationPrefsInput,
): Promise<NotificationPreferencesView> {
  const data: Prisma.NotificationPreferenceUpdateInput = {};
  const p = input.preferences ?? {};
  const c = input.channels ?? {};
  if (p.comments !== undefined) data.comments = p.comments;
  if (p.tags !== undefined) data.tags = p.tags;
  if (p.reminders !== undefined) data.reminders = p.reminders;
  if (p.moreActivityAboutYou !== undefined) data.moreActivityAboutYou = p.moreActivityAboutYou;
  if (p.updatesFromFriends !== undefined) data.updatesFromFriends = p.updatesFromFriends;
  if (c.push !== undefined) data.pushEnabled = c.push;
  if (c.email !== undefined) data.emailEnabled = c.email;
  if (c.sms !== undefined) data.smsEnabled = c.sms;

  const updated = await repo.updatePreferences(userId, data);
  return mapPreferences(updated);
}
