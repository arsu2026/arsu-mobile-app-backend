import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import { mapPostToView } from '../../common/utils/post-mapper.util';
import { splitFullName } from '../../common/utils/display-mapper.util';
import * as repo from './engagement.repository';
import type { CommentView, PostLikesView, SharePostResult } from './engagement.types';
import { bestEffort } from '../../common/utils/side-effect.util';
import * as notificationService from '../notification/notification.service';
import * as activityService from '../activity-log/activity-log.service';
import { parseMentions } from './mention.util';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidUuid(id: string): void {
  if (!UUID_REGEX.test(id)) throw new BadRequestError('Invalid ID format');
}

function snippet(text: string, max = 50): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

async function ensureCanViewPost(
  post: NonNullable<Awaited<ReturnType<typeof repo.findPostForEngagement>>>,
  viewerId: string | undefined,
): Promise<void> {
  if (post.authorId === viewerId) return;

  if (viewerId) {
    const block = await repo.findBlockBetween(viewerId, post.authorId);
    if (block) throw new NotFoundError('Post');
  }

  if (post.privacy === 'PUBLIC') return;
  if (post.privacy === 'ONLY_ME') throw new NotFoundError('Post');

  if (!viewerId) throw new NotFoundError('Post');
  const isFollower = await repo.isAcceptedFollower(viewerId, post.authorId);
  if (!isFollower) throw new NotFoundError('Post');
}

async function getVisiblePost(postId: string, viewerId: string | undefined) {
  assertValidUuid(postId);
  const post = await repo.findPostForEngagement(postId);
  if (!post) throw new NotFoundError('Post');
  await ensureCanViewPost(post, viewerId);
  return post;
}

function mapCommentAuthor(author: {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}): CommentView['author'] {
  const { firstName, lastName } = splitFullName(author.fullName);
  return {
    id: author.id,
    fullName: author.fullName,
    firstName,
    lastName,
    avatarUrl: author.avatarUrl,
  };
}

function mapComment(
  comment: Awaited<ReturnType<typeof repo.listComments>>['rows'][number],
  isLiked: boolean,
): CommentView {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    author: mapCommentAuthor(comment.author),
    content: comment.content,
    likeCount: comment.likeCount,
    isLiked,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export async function likePost(postId: string, userId: string) {
  const post = await getVisiblePost(postId, userId);
  await repo.createPostLike(userId, post.id);

  await bestEffort('like-notification', () =>
    notificationService.emitNotification({
      recipientId: post.authorId,
      actorId: userId,
      type: 'LIKE',
      entityId: post.id,
      message: 'liked your post',
    }),
  );

  await bestEffort('like-activity', () =>
    activityService.recordActivity(userId, 'POST_LIKED', { entityId: postId, entityType: 'POST' }),
  );

  return mapPostToView(post, true);
}

export async function unlikePost(postId: string, userId: string) {
  const post = await getVisiblePost(postId, userId);
  await repo.deletePostLike(userId, post.id);
  return mapPostToView(post, false);
}

export async function getPostLikes(
  postId: string,
  viewerId: string | undefined,
  includeLikers: boolean,
  page: number,
  limit: number,
): Promise<PostLikesView & { meta?: PaginationMeta }> {
  const post = await getVisiblePost(postId, viewerId);
  const isLiked = viewerId ? !!(await repo.findPostLike(viewerId, post.id)) : false;

  const result: PostLikesView & { meta?: PaginationMeta } = {
    likeCount: post.likeCount,
    isLiked,
  };

  if (!includeLikers) return result;

  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listPostLikers(post.id, skip, limit);
  result.likers = rows.map((row) => {
    const { firstName, lastName } = splitFullName(row.user.fullName);
    return {
      id: row.user.id,
      fullName: row.user.fullName,
      firstName,
      lastName,
      avatarUrl: row.user.avatarUrl,
    };
  });
  result.meta = buildPaginationMeta(total, page, limit);
  return result;
}

export async function listComments(
  postId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ comments: CommentView[]; meta: PaginationMeta }> {
  const post = await getVisiblePost(postId, viewerId);
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listComments(post.id, skip, limit);
  const likedIds = viewerId
    ? new Set(await repo.findLikedCommentIds(viewerId, rows.map((r) => r.id)))
    : new Set<string>();

  return {
    comments: rows.map((row) => mapComment(row, likedIds.has(row.id))),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function addComment(postId: string, userId: string, content: string): Promise<CommentView> {
  const post = await getVisiblePost(postId, userId);
  const trimmed = content.trim();
  if (!trimmed) throw new BadRequestError('Comment cannot be empty');

  const comment = await repo.createComment(post.id, userId, trimmed);

  await bestEffort('comment-notification', async () => {
    await notificationService.emitNotification({
      recipientId: post.authorId,
      actorId: userId,
      type: 'COMMENT',
      entityId: post.id,
      message: `commented on your post: "${snippet(trimmed)}"`,
    });

    const handles = parseMentions(trimmed);
    if (handles.length > 0) {
      const profiles = await repo.findProfilesByUsernames(handles);
      for (const profile of profiles) {
        if (profile.id === userId || profile.id === post.authorId) continue; // skip self + already-notified author
        await notificationService.emitNotification({
          recipientId: profile.id,
          actorId: userId,
          type: 'MENTION',
          entityId: post.id,
          message: 'mentioned you in a comment',
        });
      }
    }
  });

  await bestEffort('comment-activity', () =>
    activityService.recordActivity(userId, 'COMMENT_ADDED', { entityId: postId, entityType: 'POST' }),
  );

  return mapComment(comment, false);
}

export async function deleteComment(
  postId: string,
  commentId: string,
  userId: string,
): Promise<void> {
  assertValidUuid(commentId);
  await getVisiblePost(postId, userId);

  const comment = await repo.findCommentById(commentId);
  if (!comment || comment.postId !== postId) throw new NotFoundError('Comment');
  if (comment.authorId !== userId) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  const deleted = await repo.deleteComment(commentId, postId);
  if (!deleted) throw new NotFoundError('Comment');
}

export async function likeComment(
  postId: string,
  commentId: string,
  userId: string,
): Promise<CommentView> {
  assertValidUuid(commentId);
  await getVisiblePost(postId, userId);

  const comment = await repo.findCommentById(commentId);
  if (!comment || comment.postId !== postId) throw new NotFoundError('Comment');

  await repo.createCommentLike(userId, commentId);
  const updated = await repo.findCommentById(commentId);
  if (!updated) throw new NotFoundError('Comment');
  return mapComment(updated, true);
}

export async function sharePost(postId: string, userId: string): Promise<SharePostResult> {
  const post = await getVisiblePost(postId, userId);
  const updated = await repo.createPostShare(userId, post.id);
  const isLiked = !!(await repo.findPostLike(userId, post.id));

  await bestEffort('share-notification', () =>
    notificationService.emitNotification({
      recipientId: post.authorId,
      actorId: userId,
      type: 'SHARE',
      entityId: post.id,
      message: 'shared your post',
    }),
  );

  await bestEffort('share-activity', () =>
    activityService.recordActivity(userId, 'POST_SHARED', { entityId: postId, entityType: 'POST' }),
  );

  return {
    shareCount: updated.shareCount,
    post: mapPostToView(updated, isLiked),
  };
}
