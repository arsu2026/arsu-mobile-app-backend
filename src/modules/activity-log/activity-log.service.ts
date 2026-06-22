import type { ActivityType, Prisma } from '@prisma/client';
import { BadRequestError } from '../../common/errors';
import { fetchPostPreviews } from '../../common/utils/post-preview.util';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as repo from './activity-log.repository';
import type { ActivityItemView, ActivityPreview } from './activity-log.types';

// FE filter key → stored ActivityType.
const TYPE_FILTER_MAP: Record<string, ActivityType> = {
  posts: 'POST_CREATED',
  liked: 'POST_LIKED',
  comments: 'COMMENT_ADDED',
  shares: 'POST_SHARED',
  follows: 'USER_FOLLOWED',
  'watched-videos': 'VIDEO_WATCHED',
};

type ActivityRow = Awaited<ReturnType<typeof repo.listByUser>>['rows'][number];

function mapActivity(row: ActivityRow, preview: ActivityPreview | null): ActivityItemView {
  return {
    id: row.id,
    type: row.type,
    entityId: row.entityId,
    entityType: row.entityType,
    preview,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordActivity(
  userId: string,
  type: ActivityType,
  opts: { entityId?: string | null; entityType?: string | null; metadata?: Prisma.InputJsonValue } = {},
): Promise<void> {
  await repo.createActivity({ userId, type, ...opts });
}

export async function getActivityLog(
  userId: string,
  filter: string | undefined,
  page: number,
  limit: number,
): Promise<{ items: ActivityItemView[]; meta: PaginationMeta }> {
  let type: ActivityType | undefined;
  if (filter) {
    type = TYPE_FILTER_MAP[filter];
    if (!type) throw new BadRequestError(`Invalid activity type filter: ${filter}`);
  }

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listByUser(userId, type, skip, limit);

  const postIds = rows
    .filter((r) => r.entityType === 'POST' && r.entityId)
    .map((r) => r.entityId as string);
  const previews = await fetchPostPreviews(postIds);

  const items = rows.map((row) =>
    mapActivity(
      row,
      row.entityType === 'POST' && row.entityId ? previews.get(row.entityId) ?? null : null,
    ),
  );

  return { items, meta: buildPaginationMeta(total, page, limit) };
}
