import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import type { PostView } from '../../common/types/post-view.types';
import { mapPostsToViews } from '../../common/utils/post-mapper.util';
import * as repo from './feed.repository';

export async function getHomeFeed(
  userId: string,
  page: number,
  limit: number,
): Promise<{ posts: PostView[]; meta: PaginationMeta }> {
  const [followingIds, blockedIds] = await Promise.all([
    repo.findAcceptedFollowingIds(userId),
    repo.findBlockedUserIds(userId),
  ]);

  const blockedSet = new Set(blockedIds);
  const visibleFollowing = followingIds.filter((id) => !blockedSet.has(id));

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listFeedPosts(userId, visibleFollowing, skip, limit);
  const likedIds = new Set(await repo.findLikedPostIds(userId, rows.map((r) => r.id)));

  return {
    posts: mapPostsToViews(rows, likedIds),
    meta: buildPaginationMeta(total, page, limit),
  };
}
