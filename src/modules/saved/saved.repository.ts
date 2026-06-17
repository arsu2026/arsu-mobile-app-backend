import type { Prisma, SavedItemType } from '@prisma/client';
import { prisma } from '../../prisma';

const itemPostInclude = {
  post: {
    select: {
      id: true,
      content: true,
      thumbnailUrl: true,
      mediaUrl: true,
      media: { select: { url: true }, orderBy: { position: 'asc' as const }, take: 1 },
      author: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.SavedItemInclude;

export async function findPostForSave(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, privacy: true },
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
    select: { id: true },
  });
}

export async function isAcceptedFollower(viewerId: string, authorId: string): Promise<boolean> {
  const follow = await prisma.follow.findFirst({
    where: { followerId: viewerId, followingId: authorId, status: 'ACCEPTED' },
    select: { id: true },
  });
  return Boolean(follow);
}

export async function findCollection(userId: string, collectionId: string) {
  return prisma.savedCollection.findFirst({ where: { id: collectionId, userId }, select: { id: true } });
}

export async function findExistingPostSave(userId: string, postId: string) {
  return prisma.savedItem.findFirst({ where: { userId, postId }, select: { id: true } });
}

export async function createItem(data: {
  userId: string;
  type: SavedItemType;
  postId?: string | null;
  linkUrl?: string | null;
  linkTitle?: string | null;
  linkThumbnailUrl?: string | null;
  collectionId?: string | null;
}) {
  return prisma.savedItem.create({
    data: {
      userId: data.userId,
      type: data.type,
      postId: data.postId ?? null,
      linkUrl: data.linkUrl ?? null,
      linkTitle: data.linkTitle ?? null,
      linkThumbnailUrl: data.linkThumbnailUrl ?? null,
      collectionId: data.collectionId ?? null,
    },
    include: itemPostInclude,
  });
}

export async function listItems(
  userId: string,
  type: SavedItemType | undefined,
  collectionId: string | undefined,
  skip: number,
  take: number,
) {
  const where: Prisma.SavedItemWhereInput = {
    userId,
    ...(type ? { type } : {}),
    ...(collectionId ? { collectionId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.savedItem.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: itemPostInclude,
    }),
    prisma.savedItem.count({ where }),
  ]);
  return { rows, total };
}

export async function deleteItem(userId: string, id: string) {
  return prisma.savedItem.deleteMany({ where: { id, userId } });
}

export async function createCollection(userId: string, name: string, description: string | null) {
  return prisma.savedCollection.create({ data: { userId, name, description } });
}

export async function listCollections(userId: string) {
  return prisma.savedCollection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { items: true } } },
  });
}
