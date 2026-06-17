import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { CreateCollectionDto } from './dto/create-collection.dto';
import type { CreateSavedItemDto } from './dto/create-saved-item.dto';
import * as savedService from './saved.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function createSavedItem(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const item = await savedService.createSavedItem(userId, req.body as CreateSavedItemDto);
  sendSuccess(res, item, { statusCode: 201, message: 'Item saved' });
}

export async function listSavedItems(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const type = req.query.type ? String(req.query.type) : undefined;
  const collection = req.query.collection ? String(req.query.collection) : undefined;
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await savedService.listSavedItems(userId, type, collection, page, limit);
  sendSuccess(res, result.items, { meta: result.meta });
}

export async function deleteSavedItem(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await savedService.deleteSavedItem(userId, param(req, 'id'));
  sendSuccess(res, null, { message: 'Saved item removed' });
}

export async function createCollection(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const body = req.body as CreateCollectionDto;
  const collection = await savedService.createCollection(userId, body.name, body.description);
  sendSuccess(res, collection, { statusCode: 201, message: 'Collection created' });
}

export async function listCollections(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const collections = await savedService.listCollections(userId);
  sendSuccess(res, collections);
}
