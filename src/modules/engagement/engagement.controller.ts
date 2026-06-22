import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { ListLikesDto } from './dto/list-likes.dto';
import * as engagementService from './engagement.service';

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

export async function likePost(req: Request, res: Response): Promise<void> {
  const post = await engagementService.likePost(param(req, 'postId'), requireUserId(req));
  sendSuccess(res, post, { message: 'Post liked' });
}

export async function unlikePost(req: Request, res: Response): Promise<void> {
  const post = await engagementService.unlikePost(param(req, 'postId'), requireUserId(req));
  sendSuccess(res, post, { message: 'Post unliked' });
}

export async function getPostLikes(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const { includeLikers } = req.query as ListLikesDto;
  const result = await engagementService.getPostLikes(
    param(req, 'postId'),
    getViewerId(req),
    includeLikers === true,
    page,
    limit,
  );
  const { meta, ...data } = result;
  sendSuccess(res, data, meta ? { meta } : undefined);
}

export async function listComments(req: Request, res: Response): Promise<void> {
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await engagementService.listComments(
    param(req, 'postId'),
    getViewerId(req),
    page,
    limit,
  );
  sendSuccess(res, result.comments, { meta: result.meta });
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const { content } = req.body as CreateCommentDto;
  const comment = await engagementService.addComment(
    param(req, 'postId'),
    requireUserId(req),
    content,
  );
  sendSuccess(res, comment, { statusCode: 201, message: 'Comment added' });
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await engagementService.deleteComment(
    param(req, 'postId'),
    param(req, 'id'),
    requireUserId(req),
  );
  sendSuccess(res, { id: param(req, 'id') }, { message: 'Comment deleted' });
}

export async function likeComment(req: Request, res: Response): Promise<void> {
  const comment = await engagementService.likeComment(
    param(req, 'postId'),
    param(req, 'id'),
    requireUserId(req),
  );
  sendSuccess(res, comment, { message: 'Comment liked' });
}

export async function sharePost(req: Request, res: Response): Promise<void> {
  const result = await engagementService.sharePost(param(req, 'postId'), requireUserId(req));
  sendSuccess(res, result, { message: 'Share recorded' });
}
