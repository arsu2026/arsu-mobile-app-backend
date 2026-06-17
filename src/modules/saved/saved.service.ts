import { Prisma, type SavedItemType } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as repo from './saved.repository';
import type { CreateSavedItemInput, SavedCollectionView, SavedItemView } from './saved.types';

const QUERY_TYPE_MAP: Record<string, SavedItemType> = {
  post: 'POST',
  video: 'VIDEO',
  link: 'LINK',
};

type SavedItemRow = Awaited<ReturnType<typeof repo.createItem>>;

function snippet(text: string | null, max = 80): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function mapItem(row: SavedItemRow): SavedItemView {
  if (row.type === 'LINK') {
    return {
      id: row.id,
      type: row.type,
      title: row.linkTitle,
      subtitle: row.linkUrl,
      thumbnailUrl: row.linkThumbnailUrl,
      avatarUrl: null,
      source: 'link',
      collectionId: row.collectionId,
      createdAt: row.createdAt.toISOString(),
    };
  }
  const post = row.post;
  const thumbnailUrl = post?.thumbnailUrl ?? post?.media[0]?.url ?? post?.mediaUrl ?? null;
  return {
    id: row.id,
    type: row.type,
    title: post?.author.fullName ?? post?.author.username ?? null,
    subtitle: snippet(post?.content ?? null),
    thumbnailUrl,
    avatarUrl: post?.author.avatarUrl ?? null,
    source: row.type === 'VIDEO' ? 'video' : 'post',
    collectionId: row.collectionId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function ensurePostSaveable(postId: string, userId: string): Promise<void> {
  const post = await repo.findPostForSave(postId);
  if (!post) throw new NotFoundError('Post');
  if (post.authorId === userId) return;

  const block = await repo.findBlockBetween(userId, post.authorId);
  if (block) throw new NotFoundError('Post');

  if (post.privacy === 'PUBLIC') return;
  if (post.privacy === 'ONLY_ME') throw new NotFoundError('Post');
  // FOLLOWERS
  const isFollower = await repo.isAcceptedFollower(userId, post.authorId);
  if (!isFollower) throw new NotFoundError('Post');
}

export async function createSavedItem(userId: string, input: CreateSavedItemInput): Promise<SavedItemView> {
  if (input.collectionId) {
    const collection = await repo.findCollection(userId, input.collectionId);
    if (!collection) throw new NotFoundError('Collection');
  }

  if (input.type === 'POST' || input.type === 'VIDEO') {
    if (!input.postId) throw new BadRequestError('postId is required for post/video saves');
    await ensurePostSaveable(input.postId, userId);
    const existing = await repo.findExistingPostSave(userId, input.postId);
    if (existing) throw new ConflictError('Post already saved');
    const row = await repo.createItem({
      userId,
      type: input.type,
      postId: input.postId,
      collectionId: input.collectionId ?? null,
    });
    return mapItem(row);
  }

  // LINK
  if (!input.linkUrl) throw new BadRequestError('linkUrl is required for link saves');
  const row = await repo.createItem({
    userId,
    type: 'LINK',
    linkUrl: input.linkUrl,
    linkTitle: input.linkTitle ?? null,
    linkThumbnailUrl: input.linkThumbnailUrl ?? null,
    collectionId: input.collectionId ?? null,
  });
  return mapItem(row);
}

export async function listSavedItems(
  userId: string,
  typeFilter: string | undefined,
  collectionId: string | undefined,
  page: number,
  limit: number,
): Promise<{ items: SavedItemView[]; meta: PaginationMeta }> {
  const type = typeFilter ? QUERY_TYPE_MAP[typeFilter] : undefined;
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listItems(userId, type, collectionId, skip, limit);
  return { items: rows.map(mapItem), meta: buildPaginationMeta(total, page, limit) };
}

export async function deleteSavedItem(userId: string, id: string): Promise<void> {
  const { count } = await repo.deleteItem(userId, id);
  if (count === 0) throw new NotFoundError('Saved item');
}

export async function createCollection(
  userId: string,
  name: string,
  description?: string,
): Promise<SavedCollectionView> {
  try {
    const collection = await repo.createCollection(userId, name, description ?? null);
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      itemCount: 0,
      createdAt: collection.createdAt.toISOString(),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A collection with this name already exists');
    }
    throw err;
  }
}

export async function listCollections(userId: string): Promise<SavedCollectionView[]> {
  const rows = await repo.listCollections(userId);
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    itemCount: c._count.items,
    createdAt: c.createdAt.toISOString(),
  }));
}
