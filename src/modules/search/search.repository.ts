import type { ExploreCategory, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const authorSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.ProfileSelect;

const postWithAuthorSelect = {
  id: true,
  authorId: true,
  content: true,
  title: true,
  description: true,
  postType: true,
  privacy: true,
  mediaUrl: true,
  thumbnailUrl: true,
  isLongFormVideo: true,
  category: true,
  viewCount: true,
  createdAt: true,
  author: { select: authorSelect },
} satisfies Prisma.PostSelect;

export async function findPrivateProfileIdsNotFollowedBy(
  viewerId: string | undefined,
): Promise<string[]> {
  const privateProfiles = await prisma.profile.findMany({
    where: { privacySettings: { isPrivate: true } },
    select: { id: true },
  });

  if (!viewerId) return privateProfiles.map((p) => p.id);

  const followed = await prisma.follow.findMany({
    where: {
      followerId: viewerId,
      followingId: { in: privateProfiles.map((p) => p.id) },
      status: 'ACCEPTED',
    },
    select: { followingId: true },
  });
  const followedSet = new Set(followed.map((f) => f.followingId));

  return privateProfiles.filter((p) => !followedSet.has(p.id)).map((p) => p.id);
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
    if (row.blockerId === userId) ids.add(row.blockedId);
    else ids.add(row.blockerId);
  }
  return [...ids];
}

function buildSearchPostWhere(
  excludeAuthorIds: string[],
  extra: Prisma.PostWhereInput = {},
): Prisma.PostWhereInput {
  return {
    ...extra,
    privacy: 'PUBLIC',
    postType: { not: 'COVER_PHOTO' },
    ...(excludeAuthorIds.length > 0 ? { authorId: { notIn: excludeAuthorIds } } : {}),
  };
}

export async function searchPosts(
  query: string,
  excludeAuthorIds: string[],
  skip: number,
  take: number,
) {
  const where = buildSearchPostWhere(excludeAuthorIds, {
    postType: { in: ['TEXT', 'IMAGE'] },
    content: { contains: query, mode: 'insensitive' },
  });

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: postWithAuthorSelect,
    }),
    prisma.post.count({ where }),
  ]);
  return { rows, total };
}

export async function searchVideos(
  query: string,
  excludeAuthorIds: string[],
  skip: number,
  take: number,
) {
  const where = buildSearchPostWhere(excludeAuthorIds, {
    postType: 'VIDEO',
    isLongFormVideo: true,
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { content: { contains: query, mode: 'insensitive' } },
    ],
  });

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { viewCount: 'desc' },
      select: postWithAuthorSelect,
    }),
    prisma.post.count({ where }),
  ]);
  return { rows, total };
}

export async function searchShorts(
  query: string,
  excludeAuthorIds: string[],
  skip: number,
  take: number,
) {
  const where = buildSearchPostWhere(excludeAuthorIds, {
    postType: 'VIDEO',
    isLongFormVideo: false,
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { content: { contains: query, mode: 'insensitive' } },
    ],
  });

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { viewCount: 'desc' },
      select: postWithAuthorSelect,
    }),
    prisma.post.count({ where }),
  ]);
  return { rows, total };
}

export async function searchHashtags(query: string, take: number) {
  const normalized = query.replace(/^#/, '').toLowerCase();
  return prisma.hashtag.findMany({
    where: { name: { contains: normalized, mode: 'insensitive' } },
    take,
    orderBy: [{ postCount: 'desc' }, { name: 'asc' }],
  });
}

export async function findHashtagByName(tag: string) {
  const normalized = tag.replace(/^#/, '').toLowerCase();
  return prisma.hashtag.findUnique({ where: { name: normalized } });
}

export async function getHashtagFeed(
  hashtagId: string,
  excludeAuthorIds: string[],
  skip: number,
  take: number,
) {
  const where: Prisma.PostWhereInput = {
    privacy: 'PUBLIC',
    postType: { not: 'COVER_PHOTO' },
    hashtags: { some: { hashtagId } },
    ...(excludeAuthorIds.length > 0 ? { authorId: { notIn: excludeAuthorIds } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: postWithAuthorSelect,
    }),
    prisma.post.count({ where }),
  ]);
  return { rows, total };
}

export async function getExploreFeed(
  excludeAuthorIds: string[],
  category: string | undefined,
  skip: number,
  take: number,
) {
  const where = buildSearchPostWhere(excludeAuthorIds, {
    ...(category ? { category: category as ExploreCategory } : {}),
  });

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
      select: postWithAuthorSelect,
    }),
    prisma.post.count({ where }),
  ]);
  return { rows, total };
}

export async function listSearchHistory(userId: string, limit: number) {
  return prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function createSearchHistory(
  userId: string,
  query: string,
  searchType: 'ALL' | 'USERS' | 'POSTS' | 'VIDEOS' | 'SHORTS' | 'HASHTAGS',
) {
  const trimmed = query.trim();

  await prisma.searchHistory.deleteMany({
    where: { userId, query: { equals: trimmed, mode: 'insensitive' } },
  });

  const entry = await prisma.searchHistory.create({
    data: { userId, query: trimmed, searchType },
  });

  const overflow = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: 15,
    select: { id: true },
  });

  if (overflow.length > 0) {
    await prisma.searchHistory.deleteMany({
      where: { id: { in: overflow.map((o) => o.id) } },
    });
  }

  return entry;
}

export async function deleteSearchHistoryItem(userId: string, searchId: string) {
  return prisma.searchHistory.deleteMany({
    where: { id: searchId, userId },
  });
}

export async function clearSearchHistory(userId: string) {
  return prisma.searchHistory.deleteMany({ where: { userId } });
}

export async function findFollowingIds(viewerId: string, targetIds: string[]) {
  if (targetIds.length === 0) return [];
  const rows = await prisma.follow.findMany({
    where: {
      followerId: viewerId,
      followingId: { in: targetIds },
      status: 'ACCEPTED',
    },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

export async function searchProfiles(
  query: string,
  excludeIds: string[],
  skip: number,
  take: number,
) {
  const where: Prisma.ProfileWhereInput = {
    AND: [
      {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      skip,
      take,
      select: authorSelect,
      orderBy: { fullName: 'asc' },
    }),
    prisma.profile.count({ where }),
  ]);
  return { rows, total };
}

export type PostWithAuthor = Awaited<ReturnType<typeof searchPosts>>['rows'][number];
