import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const postWithAuthorInclude = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
  media: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.PostInclude;

export async function findPostForEngagement(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: postWithAuthorInclude,
  });
}

export async function findPostLike(userId: string, postId: string) {
  return prisma.postLike.findUnique({
    where: { userId_postId: { userId, postId } },
  });
}

export async function createPostLike(userId: string, postId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) return existing;

    const like = await tx.postLike.create({ data: { userId, postId } });
    await tx.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    });
    return like;
  });
}

export async function deletePostLike(userId: string, postId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) return false;

    await tx.postLike.delete({ where: { userId_postId: { userId, postId } } });
    await tx.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 } },
    });
    return true;
  });
}

export async function listPostLikers(postId: string, skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.postLike.findMany({
      where: { postId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    }),
    prisma.postLike.count({ where: { postId } }),
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

export async function createComment(postId: string, authorId: string, content: string) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { postId, authorId, content },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    await tx.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    return comment;
  });
}

export async function listComments(postId: string, skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.comment.findMany({
      where: { postId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    }),
    prisma.comment.count({ where: { postId } }),
  ]);
  return { rows, total };
}

export async function findCommentById(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      author: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });
}

export async function deleteComment(commentId: string, postId: string) {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.comment.deleteMany({
      where: { id: commentId, postId },
    });
    if (deleted.count === 0) return false;
    await tx.post.update({
      where: { id: postId },
      data: { commentCount: { decrement: 1 } },
    });
    return true;
  });
}

export async function findCommentLike(userId: string, commentId: string) {
  return prisma.commentLike.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });
}

export async function createCommentLike(userId: string, commentId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });
    if (existing) return existing;

    const like = await tx.commentLike.create({ data: { userId, commentId } });
    await tx.comment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
    });
    return like;
  });
}

export async function findLikedCommentIds(userId: string, commentIds: string[]) {
  if (commentIds.length === 0) return [];
  const rows = await prisma.commentLike.findMany({
    where: { userId, commentId: { in: commentIds } },
    select: { commentId: true },
  });
  return rows.map((r) => r.commentId);
}

export async function createPostShare(userId: string, postId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.postShare.create({ data: { userId, postId } });
    return tx.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
      include: postWithAuthorInclude,
    });
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

export async function findProfilesByUsernames(usernames: string[]) {
  if (usernames.length === 0) return [];
  return prisma.profile.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  });
}

export { postWithAuthorInclude };
