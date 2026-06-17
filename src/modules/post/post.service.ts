import type { ExploreCategory, PostPrivacy, Prisma } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import type { PostView } from '../../common/types/post-view.types';
import { mapPostToView, mapPostsToViews } from '../../common/utils/post-mapper.util';
import * as storage from '../../common/storage/storage.service';
import { bestEffort } from '../../common/utils/side-effect.util';
import * as activityService from '../activity-log/activity-log.service';
import { extractHashtags } from './hashtag.util';
import * as repo from './post.repository';
import type { CreatePostInput, UpdatePostInput } from './post.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidUuid(id: string): void {
  if (!UUID_REGEX.test(id)) throw new BadRequestError('Invalid ID format');
}

type PostWithMedia = NonNullable<Awaited<ReturnType<typeof repo.findPostById>>>;

async function mapPost(post: PostWithMedia, viewerId?: string): Promise<PostView> {
  const isLiked = viewerId ? await repo.isPostLikedByUser(viewerId, post.id) : false;
  return mapPostToView(post, isLiked);
}

async function mapPosts(posts: PostWithMedia[], viewerId?: string): Promise<PostView[]> {
  const likedIds = viewerId
    ? new Set(await repo.findLikedPostIds(viewerId, posts.map((p) => p.id)))
    : new Set<string>();
  return mapPostsToViews(posts, likedIds);
}

async function ensureCanView(post: PostWithMedia, viewerId: string | undefined): Promise<void> {
  if (post.authorId === viewerId) return; // owner always sees their own posts

  if (viewerId) {
    const block = await repo.findBlockBetween(viewerId, post.authorId);
    if (block) throw new NotFoundError('Post');
  }

  if (post.privacy === 'PUBLIC') return;
  if (post.privacy === 'ONLY_ME') throw new NotFoundError('Post');

  // FOLLOWERS
  if (!viewerId) throw new NotFoundError('Post');
  const isFollower = await repo.isAcceptedFollower(viewerId, post.authorId);
  if (!isFollower) throw new NotFoundError('Post');
}

function buildPrivacyFilter(isOwner: boolean, isFollower: boolean): Prisma.PostWhereInput {
  if (isOwner) return {};
  const allowed: PostPrivacy[] = ['PUBLIC'];
  if (isFollower) allowed.push('FOLLOWERS');
  return { privacy: { in: allowed } };
}

export async function createPost(authorId: string, input: CreatePostInput): Promise<PostView> {
  const content = input.content?.trim() || null;
  const hasImages = input.images.length > 0;
  if (!content && !hasImages) {
    throw new BadRequestError('A post must have text or at least one image');
  }

  const mediaUrls: string[] = [];
  for (const image of input.images) {
    const url = await storage.uploadImage(image.buffer, image.mimetype, authorId);
    mediaUrls.push(url);
  }

  const post = await repo.createPost({
    authorId,
    content,
    postType: hasImages ? 'IMAGE' : 'TEXT',
    privacy: input.privacy ?? 'PUBLIC',
    category: input.category ?? null,
    mediaUrl: mediaUrls[0] ?? null,
    thumbnailUrl: mediaUrls[0] ?? null,
    mediaUrls,
  });

  await repo.syncPostHashtags(post.id, extractHashtags(content));

  await bestEffort('post-created-activity', () =>
    activityService.recordActivity(authorId, 'POST_CREATED', { entityId: post.id, entityType: 'POST' }),
  );

  return await mapPost(post, authorId);
}

export async function getPostById(postId: string, viewerId: string | undefined): Promise<PostView> {
  assertValidUuid(postId);
  const post = await repo.findPostById(postId);
  if (!post) throw new NotFoundError('Post');
  await ensureCanView(post, viewerId);
  return await mapPost(post, viewerId);
}

export async function listPostsByAuthor(
  authorId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ posts: PostView[]; meta: PaginationMeta }> {
  assertValidUuid(authorId);
  const isOwner = viewerId === authorId;

  if (!isOwner && viewerId) {
    const block = await repo.findBlockBetween(viewerId, authorId);
    if (block) return { posts: [], meta: buildPaginationMeta(0, page, limit) };
  }

  const isFollower =
    !isOwner && viewerId ? await repo.isAcceptedFollower(viewerId, authorId) : isOwner;

  const where = buildPrivacyFilter(isOwner, isFollower);
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listPostsByAuthor(authorId, where, skip, limit);

  return { posts: await mapPosts(rows, viewerId), meta: buildPaginationMeta(total, page, limit) };
}

export async function updatePost(
  postId: string,
  userId: string,
  input: UpdatePostInput,
): Promise<PostView> {
  assertValidUuid(postId);
  const post = await repo.findPostById(postId);
  if (!post) throw new NotFoundError('Post');
  if (post.authorId !== userId) throw new ForbiddenError('You can only edit your own posts');

  const data: {
    content?: string | null;
    privacy?: PostPrivacy;
    category?: ExploreCategory | null;
  } = {};
  if (input.content !== undefined) data.content = input.content.trim() || null;
  if (input.privacy !== undefined) data.privacy = input.privacy;
  if (input.category !== undefined) data.category = input.category;

  if (Object.keys(data).length === 0) {
    throw new BadRequestError('No fields to update');
  }

  const updated = await repo.updatePost(postId, data);

  if (input.content !== undefined) {
    await repo.syncPostHashtags(postId, extractHashtags(data.content ?? null));
  }

  return await mapPost(updated, userId);
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  assertValidUuid(postId);
  const post = await repo.findPostById(postId);
  if (!post) throw new NotFoundError('Post');
  if (post.authorId !== userId) throw new ForbiddenError('You can only delete your own posts');

  await repo.syncPostHashtags(postId, []); // decrement hashtag counts before cascade
  await repo.deletePost(postId);
  await storage.deleteImages(post.media.map((m) => m.url));
}
