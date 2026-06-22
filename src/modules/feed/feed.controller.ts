import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import * as feedService from './feed.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

export async function getFeed(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await feedService.getHomeFeed(requireUserId(req), page, limit);
  sendSuccess(res, result.posts, { meta: result.meta });
}
