import type { PostPrivacy, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const postInclude = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
  media: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.PostInclude;

export async function findAcceptedFollowingIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

export async function findBlockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }
  return [...ids];
}

export async function listFeedPosts(
  userId: string,
  followingIds: string[],
  skip: number,
  take: number,
) {
  const where: Prisma.PostWhereInput = {
    OR: [
      { authorId: userId },
      {
        authorId: { in: followingIds },
        privacy: { in: ['PUBLIC', 'FOLLOWERS'] satisfies PostPrivacy[] },
      },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: postInclude,
    }),
    prisma.post.count({ where }),
  ]);

  return { rows, total };
}

export async function findLikedPostIds(userId: string, postIds: string[]) {
  if (postIds.length === 0) return [];
  const rows = await prisma.postLike.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return rows.map((r) => r.postId);
}
