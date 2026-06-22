import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import * as postService from './post.service';

/** Minimal shape of a multer-uploaded file (avoids Express.Multer.File global issues). */
type UploadedFile = { buffer: Buffer; mimetype: string };

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

export async function createPost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const body = req.body as CreatePostDto;
  const files = (req.files as UploadedFile[] | undefined) ?? [];

  const post = await postService.createPost(userId, {
    content: body.content,
    privacy: body.privacy,
    category: body.category,
    images: files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
  });

  sendSuccess(res, post, { statusCode: 201, message: 'Post created successfully' });
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await postService.getPostById(param(req, 'id'), getViewerId(req));
  sendSuccess(res, post);
}

export async function listPosts(req: Request, res: Response): Promise<void> {
  const authorId = String(req.query.authorId ?? '');
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await postService.listPostsByAuthor(authorId, getViewerId(req), page, limit);
  sendSuccess(res, result.posts, { meta: result.meta });
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const post = await postService.updatePost(param(req, 'id'), userId, req.body as UpdatePostDto);
  sendSuccess(res, post, { message: 'Post updated successfully' });
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await postService.deletePost(param(req, 'id'), userId);
  sendSuccess(res, { id: param(req, 'id') }, { message: 'Post deleted successfully' });
}
