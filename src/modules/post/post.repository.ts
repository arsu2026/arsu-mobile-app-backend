import type { ExploreCategory, PostPrivacy, PostType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const mediaInclude = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
  media: { orderBy: { position: 'asc' } },
} satisfies Prisma.PostInclude;

export async function createPost(input: {
  authorId: string;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  category: ExploreCategory | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaUrls: string[];
}) {
  return prisma.post.create({
    data: {
      authorId: input.authorId,
      content: input.content,
      postType: input.postType,
      privacy: input.privacy,
      category: input.category,
      mediaUrl: input.mediaUrl,
      thumbnailUrl: input.thumbnailUrl,
      media: {
        create: input.mediaUrls.map((url, position) => ({ url, position })),
      },
    },
    include: mediaInclude,
  });
}

export async function findPostById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: mediaInclude,
  });
}

export async function updatePost(
  postId: string,
  data: {
    content?: string | null;
    privacy?: PostPrivacy;
    category?: ExploreCategory | null;
  },
) {
  return prisma.post.update({
    where: { id: postId },
    data,
    include: mediaInclude,
  });
}

export async function deletePost(postId: string): Promise<void> {
  await prisma.post.delete({ where: { id: postId } });
}

export async function listPostsByAuthor(
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
      include: mediaInclude,
    }),
    prisma.post.count({ where: { authorId, ...where } }),
  ]);
  return { rows, total };
}

/**
 * Reconcile a post's hashtag links to exactly `tagNames`, keeping
 * Hashtag.postCount accurate. Passing [] removes all links (used on delete).
 */
export async function syncPostHashtags(postId: string, tagNames: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.postHashtag.findMany({
      where: { postId },
      include: { hashtag: { select: { id: true, name: true } } },
    });
    const existingNames = new Set(existing.map((e) => e.hashtag.name));
    const newNames = new Set(tagNames);

    for (const link of existing) {
      if (newNames.has(link.hashtag.name)) continue;
      await tx.postHashtag.delete({
        where: { postId_hashtagId: { postId, hashtagId: link.hashtagId } },
      });
      await tx.hashtag.update({
        where: { id: link.hashtagId },
        data: { postCount: { decrement: 1 } },
      });
    }

    for (const name of tagNames) {
      if (existingNames.has(name)) continue;
      const hashtag = await tx.hashtag.upsert({
        where: { name },
        create: { name, postCount: 1 },
        update: { postCount: { increment: 1 } },
      });
      await tx.postHashtag.create({ data: { postId, hashtagId: hashtag.id } });
    }
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

export async function isAcceptedFollower(viewerId: string, authorId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: authorId } },
  });
  return row?.status === 'ACCEPTED';
}

export async function findLikedPostIds(userId: string, postIds: string[]) {
  if (postIds.length === 0) return [];
  const rows = await prisma.postLike.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return rows.map((r) => r.postId);
}

export async function isPostLikedByUser(userId: string, postId: string): Promise<boolean> {
  const row = await prisma.postLike.findUnique({
    where: { userId_postId: { userId, postId } },
  });
  return !!row;
}
