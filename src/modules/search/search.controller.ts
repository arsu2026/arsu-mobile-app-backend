import type { Request, Response } from 'express';
import type { SearchType } from '@prisma/client';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { SaveSearchHistoryDto } from './dto/save-search-history.dto';
import * as searchService from './search.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

function getViewerId(req: Request): string | undefined {
  return req.user?.sub;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function searchPosts(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '');
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await searchService.searchPosts(q, getViewerId(req), page, limit);
  sendSuccess(res, { query: q.trim(), posts: result.posts }, { meta: result.meta });
}

export async function searchVideos(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '');
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await searchService.searchVideos(q, getViewerId(req), page, limit);
  sendSuccess(res, { query: q.trim(), videos: result.videos }, { meta: result.meta });
}

export async function searchHashtags(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '');
  const hashtags = await searchService.searchHashtags(q);
  sendSuccess(res, { query: q.trim(), hashtags });
}

export async function unifiedSearch(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '');
  const type = (req.query.type as SearchType | undefined) ?? 'ALL';
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await searchService.unifiedSearch(q, type, getViewerId(req), page, limit);
  sendSuccess(res, result);
}

export async function getHashtagFeed(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await searchService.getHashtagFeed(
    param(req, 'tag'),
    getViewerId(req),
    page,
    limit,
  );
  sendSuccess(res, {
    hashtag: result.hashtag,
    feed: result.items,
  }, { meta: result.meta });
}

export async function getExploreFeed(req: Request, res: Response): Promise<void> {
  const category = req.query.category ? String(req.query.category) : undefined;
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10), 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10), 1), 100);
  const result = await searchService.getExploreFeed(getViewerId(req), category, page, limit);
  sendSuccess(res, { feed: result.items }, { meta: result.meta });
}

export async function getSearchHistory(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const history = await searchService.getSearchHistory(userId);
  sendSuccess(res, history);
}

export async function saveSearchHistory(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const body = req.body as SaveSearchHistoryDto;
  const entry = await searchService.saveSearchHistory(
    userId,
    body.query,
    body.searchType ?? 'ALL',
  );
  sendSuccess(res, entry, { statusCode: 201, message: 'Search saved to history' });
}

export async function deleteSearchHistoryItem(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const result = await searchService.deleteSearchHistoryItem(userId, param(req, 'searchId'));
  sendSuccess(res, result, { message: result.message });
}

export async function clearSearchHistory(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const result = await searchService.clearSearchHistory(userId);
  sendSuccess(res, result, { message: result.message });
}
