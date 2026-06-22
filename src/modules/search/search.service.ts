import type { SearchType } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import type { BasicUserInfo } from '../profile/profile.types';
import { splitFullName } from '../../common/utils/display-mapper.util';
import * as repo from './search.repository';
import type {
  ExploreItemView,
  HashtagView,
  SearchHistoryView,
  SearchPostView,
  UnifiedSearchResult,
} from './search.types';

const SEARCH_HISTORY_LIMIT = 15;

function validateQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new BadRequestError('Search query must be at least 2 characters');
  }
  return trimmed;
}

async function getExcludedAuthorIds(viewerId: string | undefined): Promise<string[]> {
  const privateIds = (await repo.findPrivateProfileIdsNotFollowedBy(viewerId)) ?? [];
  const blockedIds = viewerId ? ((await repo.findBlockedUserIds(viewerId)) ?? []) : [];
  return [...new Set([...privateIds, ...blockedIds])];
}

function mapPost(post: repo.PostWithAuthor): SearchPostView {
  return {
    id: post.id,
    authorId: post.authorId,
    author: {
      id: post.author.id,
      username: post.author.username,
      fullName: post.author.fullName,
      avatarUrl: post.author.avatarUrl,
    },
    content: post.content,
    title: post.title,
    description: post.description,
    postType: post.postType,
    privacy: post.privacy,
    mediaUrl: post.mediaUrl,
    thumbnailUrl: post.thumbnailUrl,
    isLongFormVideo: post.isLongFormVideo,
    viewCount: post.viewCount,
    createdAt: post.createdAt.toISOString(),
  };
}

function mapExploreItem(post: repo.PostWithAuthor): ExploreItemView {
  return {
    ...mapPost(post),
    category: post.category,
    trendingScore: post.viewCount,
  };
}

async function mapUsers(
  viewerId: string | undefined,
  users: Array<{
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  }>,
): Promise<BasicUserInfo[]> {
  const ids = users.map((u) => u.id);
  const followingIds = viewerId ? await repo.findFollowingIds(viewerId, ids) : [];

  return users.map((user) => {
    const { firstName, lastName } = splitFullName(user.fullName);
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      firstName,
      lastName,
      avatarUrl: user.avatarUrl,
      isFollowing: followingIds.includes(user.id),
    };
  });
}

async function recordSearchIfAuthenticated(
  userId: string | undefined,
  query: string,
  searchType: SearchType,
): Promise<void> {
  if (!userId) return;
  await repo.createSearchHistory(userId, query, searchType);
}

export async function searchPosts(
  query: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ posts: SearchPostView[]; meta: PaginationMeta }> {
  const trimmed = validateQuery(query);
  const excludeAuthorIds = await getExcludedAuthorIds(viewerId);
  const skip = (page - 1) * limit;

  const { rows, total } = await repo.searchPosts(trimmed, excludeAuthorIds, skip, limit);
  await recordSearchIfAuthenticated(viewerId, trimmed, 'POSTS');

  return {
    posts: rows.map(mapPost),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function searchVideos(
  query: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ videos: SearchPostView[]; meta: PaginationMeta }> {
  const trimmed = validateQuery(query);
  const excludeAuthorIds = await getExcludedAuthorIds(viewerId);
  const skip = (page - 1) * limit;

  const { rows, total } = await repo.searchVideos(trimmed, excludeAuthorIds, skip, limit);
  await recordSearchIfAuthenticated(viewerId, trimmed, 'VIDEOS');

  return {
    videos: rows.map(mapPost),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function searchHashtags(query: string): Promise<HashtagView[]> {
  const trimmed = validateQuery(query);
  const rows = await repo.searchHashtags(trimmed, 20);

  return rows.map((h) => ({
    id: h.id,
    name: h.name,
    postCount: h.postCount,
  }));
}

export async function unifiedSearch(
  query: string,
  type: SearchType,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<UnifiedSearchResult> {
  const trimmed = validateQuery(query);
  const excludeAuthorIds = await getExcludedAuthorIds(viewerId);
  const skip = (page - 1) * limit;

  const result: UnifiedSearchResult = {
    query: trimmed,
    type,
    users: [],
    posts: [],
    videos: [],
    shorts: [],
    hashtags: [],
  };

  const excludeIds = viewerId
    ? [...new Set([...(await repo.findBlockedUserIds(viewerId)), viewerId])]
    : [];

  if (type === 'ALL' || type === 'USERS') {
    const perTypeLimit = type === 'ALL' ? 5 : limit;
    const { rows } = await repo.searchProfiles(trimmed, excludeIds, 0, perTypeLimit);
    result.users = await mapUsers(viewerId, rows);
  }

  if (type === 'ALL' || type === 'POSTS') {
    const perTypeLimit = type === 'ALL' ? 5 : limit;
    const { rows } = await repo.searchPosts(trimmed, excludeAuthorIds, skip, perTypeLimit);
    result.posts = rows.map(mapPost);
  }

  if (type === 'ALL' || type === 'VIDEOS') {
    const perTypeLimit = type === 'ALL' ? 5 : limit;
    const { rows } = await repo.searchVideos(trimmed, excludeAuthorIds, skip, perTypeLimit);
    result.videos = rows.map(mapPost);
  }

  if (type === 'ALL' || type === 'SHORTS') {
    const perTypeLimit = type === 'ALL' ? 5 : limit;
    const { rows } = await repo.searchShorts(trimmed, excludeAuthorIds, skip, perTypeLimit);
    result.shorts = rows.map(mapPost);
  }

  if (type === 'ALL' || type === 'HASHTAGS') {
    const rows = await repo.searchHashtags(trimmed, type === 'ALL' ? 5 : limit);
    result.hashtags = rows.map((h) => ({
      id: h.id,
      name: h.name,
      postCount: h.postCount,
    }));
  }

  await recordSearchIfAuthenticated(viewerId, trimmed, type);
  return result;
}

export async function getHashtagFeed(
  tag: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ items: SearchPostView[]; meta: PaginationMeta; hashtag: HashtagView }> {
  const normalized = tag.replace(/^#/, '').trim().toLowerCase();
  if (!normalized) throw new BadRequestError('Hashtag is required');

  const hashtag = await repo.findHashtagByName(normalized);
  if (!hashtag) throw new NotFoundError('Hashtag');

  const excludeAuthorIds = await getExcludedAuthorIds(viewerId);
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.getHashtagFeed(hashtag.id, excludeAuthorIds, skip, limit);

  return {
    hashtag: { id: hashtag.id, name: hashtag.name, postCount: hashtag.postCount },
    items: rows.map(mapPost),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getExploreFeed(
  viewerId: string | undefined,
  category: string | undefined,
  page: number,
  limit: number,
): Promise<{ items: ExploreItemView[]; meta: PaginationMeta }> {
  const excludeAuthorIds = await getExcludedAuthorIds(viewerId);
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.getExploreFeed(
    excludeAuthorIds,
    category,
    skip,
    limit,
  );

  return {
    items: rows.map(mapExploreItem),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getSearchHistory(userId: string): Promise<SearchHistoryView[]> {
  const rows = await repo.listSearchHistory(userId, SEARCH_HISTORY_LIMIT);
  return rows.map((row) => ({
    id: row.id,
    query: row.query,
    searchType: row.searchType,
    searchedAt: row.createdAt.toISOString(),
  }));
}

export async function saveSearchHistory(
  userId: string,
  query: string,
  searchType: SearchType = 'ALL',
): Promise<SearchHistoryView> {
  const trimmed = validateQuery(query);
  const entry = await repo.createSearchHistory(userId, trimmed, searchType);
  return {
    id: entry.id,
    query: entry.query,
    searchType: entry.searchType,
    searchedAt: entry.createdAt.toISOString(),
  };
}

export async function deleteSearchHistoryItem(
  userId: string,
  searchId: string,
): Promise<{ message: string }> {
  const result = await repo.deleteSearchHistoryItem(userId, searchId);
  if (result.count === 0) throw new NotFoundError('Search history item');
  return { message: 'Search removed from history' };
}

export async function clearSearchHistory(userId: string): Promise<{ message: string }> {
  await repo.clearSearchHistory(userId);
  return { message: 'Search history cleared' };
}
