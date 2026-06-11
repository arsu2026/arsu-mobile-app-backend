import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import type { UpdateIntroInput, UpdatePrivacyInput, UpdateProfileInput } from './profile.types';

const basicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.ProfileSelect;

export async function findProfileById(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId },
    include: { privacySettings: true },
  });
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  return prisma.profile.update({
    where: { id: userId },
    data,
    include: { privacySettings: true },
  });
}

export async function updateCoverUrl(userId: string, coverUrl: string) {
  return prisma.profile.update({
    where: { id: userId },
    data: { coverUrl },
  });
}

export async function updateIntro(userId: string, data: UpdateIntroInput) {
  return prisma.profile.update({
    where: { id: userId },
    data,
  });
}

export async function updatePrivacySettings(userId: string, data: UpdatePrivacyInput) {
  return prisma.profilePrivacySettings.upsert({
    where: { profileId: userId },
    create: { profileId: userId, ...data },
    update: data,
  });
}

export async function findUsernameConflict(username: string, excludeUserId: string) {
  return prisma.profile.findFirst({
    where: { username, NOT: { id: excludeUserId } },
    select: { id: true },
  });
}

export async function countFollowers(userId: string) {
  return prisma.follow.count({
    where: { followingId: userId, status: 'ACCEPTED' },
  });
}

export async function countFollowing(userId: string) {
  return prisma.follow.count({
    where: { followerId: userId, status: 'ACCEPTED' },
  });
}

export async function countPosts(userId: string) {
  return prisma.post.count({ where: { authorId: userId } });
}

export async function findFollow(followerId: string, followingId: string) {
  return prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
}

export async function createFollow(
  followerId: string,
  followingId: string,
  status: 'ACCEPTED' | 'PENDING',
) {
  return prisma.follow.create({
    data: { followerId, followingId, status },
  });
}

export async function deleteFollow(followerId: string, followingId: string) {
  return prisma.follow.delete({
    where: { followerId_followingId: { followerId, followingId } },
  });
}

export async function deleteFollowIfExists(followerId: string, followingId: string) {
  return prisma.follow.deleteMany({
    where: { followerId, followingId },
  });
}

export async function removeAllFollowRelationships(userA: string, userB: string) {
  return prisma.follow.deleteMany({
    where: {
      OR: [
        { followerId: userA, followingId: userB },
        { followerId: userB, followingId: userA },
      ],
    },
  });
}

export async function findBlock(blockerId: string, blockedId: string) {
  return prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
}

export async function findBlockBetween(userA: string, userB: string) {
  return prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
}

export async function createBlock(blockerId: string, blockedId: string) {
  return prisma.block.create({ data: { blockerId, blockedId } });
}

export async function deleteBlock(blockerId: string, blockedId: string) {
  return prisma.block.delete({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
}

export async function listBlockedUsers(blockerId: string, skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.block.findMany({
      where: { blockerId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: basicUserSelect } },
    }),
    prisma.block.count({ where: { blockerId } }),
  ]);
  return { rows, total };
}

export async function listFollowers(
  userId: string,
  skip: number,
  take: number,
) {
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: basicUserSelect } },
    }),
    prisma.follow.count({ where: { followingId: userId, status: 'ACCEPTED' } }),
  ]);
  return { rows, total };
}

export async function listFollowing(
  userId: string,
  skip: number,
  take: number,
) {
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { following: { select: basicUserSelect } },
    }),
    prisma.follow.count({ where: { followerId: userId, status: 'ACCEPTED' } }),
  ]);
  return { rows, total };
}

export async function listPendingFollowRequests(userId: string) {
  return prisma.follow.findMany({
    where: { followingId: userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: { follower: { select: basicUserSelect } },
  });
}

export async function acceptFollowRequest(followingId: string, followerId: string) {
  return prisma.follow.update({
    where: { followerId_followingId: { followerId, followingId } },
    data: { status: 'ACCEPTED' },
  });
}

export async function rejectFollowRequest(followingId: string, followerId: string) {
  return prisma.follow.delete({
    where: { followerId_followingId: { followerId, followingId } },
  });
}

export async function createNotification(data: {
  recipientId: string;
  actorId: string;
  type: 'FOLLOW' | 'FOLLOW_REQUEST' | 'FOLLOW_ACCEPTED';
  entityId?: string;
  message?: string;
}) {
  return prisma.notification.create({ data });
}

export async function createPost(data: Prisma.PostCreateInput) {
  return prisma.post.create({ data });
}

export async function findPostById(postId: string) {
  return prisma.post.findUnique({ where: { id: postId } });
}

export async function listPosts(
  authorId: string,
  where: Prisma.PostWhereInput,
  skip: number,
  take: number,
) {
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where: { authorId, ...where },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({ where: { authorId, ...where } }),
  ]);
  return { rows, total };
}

export async function pinPost(userId: string, postId: string) {
  return prisma.profile.update({
    where: { id: userId },
    data: { pinnedPostId: postId },
  });
}

export async function unpinPost(userId: string) {
  return prisma.profile.update({
    where: { id: userId },
    data: { pinnedPostId: null },
  });
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
      select: basicUserSelect,
      orderBy: { fullName: 'asc' },
    }),
    prisma.profile.count({ where }),
  ]);
  return { rows, total };
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

export async function findFollowerIdsOfTargets(viewerId: string, targetIds: string[]) {
  if (targetIds.length === 0) return [];
  const rows = await prisma.follow.findMany({
    where: {
      followerId: { in: targetIds },
      followingId: viewerId,
      status: 'ACCEPTED',
    },
    select: { followerId: true },
  });
  return rows.map((r) => r.followerId);
}

export async function findBlockedUserIds(userId: string) {
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

export async function findSecondDegreeConnections(userId: string) {
  const myFollowing = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  const followingIds = myFollowing.map((f) => f.followingId);
  if (followingIds.length === 0) return [];

  return prisma.follow.findMany({
    where: {
      followingId: { in: followingIds },
      status: 'ACCEPTED',
      followerId: { not: userId },
    },
    select: { followerId: true, followingId: true },
  });
}

export async function findContactSuggestions(
  userId: string,
  blockedIds: string[],
  limit: number,
) {
  const following = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);
  const exclude = [userId, ...blockedIds, ...followingIds];

  return prisma.userContact.findMany({
    where: {
      userId,
      contactUserId: { notIn: exclude },
    },
    take: limit,
    include: { contactUser: { select: basicUserSelect } },
  });
}

export async function findLocationSuggestions(
  userId: string,
  location: string | null,
  blockedIds: string[],
  limit: number,
) {
  if (!location) return [];

  const following = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);
  const exclude = [userId, ...blockedIds, ...followingIds];

  return prisma.profile.findMany({
    where: {
      location: { equals: location, mode: 'insensitive' },
      id: { notIn: exclude },
    },
    take: limit,
    select: basicUserSelect,
  });
}

export async function findProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.profile.findMany({
    where: { id: { in: ids } },
    select: basicUserSelect,
  });
}

export async function isAcceptedFollower(viewerId: string, profileOwnerId: string) {
  const row = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId: viewerId, followingId: profileOwnerId },
    },
  });
  return row?.status === 'ACCEPTED';
}
