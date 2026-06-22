import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import * as notificationService from './notification.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await notificationService.getNotifications(userId, page, limit);
  sendSuccess(res, result.notifications, { meta: result.meta });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const result = await notificationService.getUnreadCount(userId);
  sendSuccess(res, result);
}

export async function markAsRead(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const notification = await notificationService.markAsRead(userId, param(req, 'id'));
  sendSuccess(res, notification, { message: 'Notification marked as read' });
}

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await notificationService.markAllAsRead(userId);
  sendSuccess(res, null, { message: 'All notifications marked as read' });
}

export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await notificationService.deleteNotification(userId, param(req, 'id'));
  sendSuccess(res, null, { message: 'Notification deleted' });
}

export async function clearAll(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await notificationService.clearAll(userId);
  sendSuccess(res, null, { message: 'All notifications cleared' });
}
