import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('../../config/supabase.config');
jest.mock('./notification.repository');

jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test' },
}));

import { supabaseAdmin } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import * as repo from './notification.repository';
import { notificationRouter } from './notification.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockListByRecipient = repo.listByRecipient as jest.Mock;
const mockCountUnread = repo.countUnread as jest.Mock;
const mockFindOwned = repo.findOwned as jest.Mock;
const mockMarkRead = repo.markRead as jest.Mock;
const mockMarkAllRead = repo.markAllRead as jest.Mock;
const mockDeleteOne = repo.deleteOne as jest.Mock;
const mockDeleteAll = repo.deleteAll as jest.Mock;

const USER = '11111111-1111-4111-8111-111111111111';
const NOTIF_ID = '33333333-3333-4333-8333-333333333333';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/notifications', notificationRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

function authenticate(): void {
  mockGetUser.mockResolvedValue({
    data: { user: { id: USER, email: 'user@example.com', role: 'authenticated' } },
    error: null,
  });
}

const row = {
  id: NOTIF_ID,
  type: 'FOLLOW',
  actor: {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'jane',
    fullName: 'Jane Doe',
    avatarUrl: null,
  },
  entityId: null,
  message: 'started following you',
  isRead: false,
  createdAt: new Date('2026-06-16T10:00:00.000Z'),
};

beforeEach(() => jest.clearAllMocks());

describe('Notification routes', () => {
  describe('GET /notifications', () => {
    it("returns the recipient's notifications with pagination meta", async () => {
      authenticate();
      mockListByRecipient.mockResolvedValue({ rows: [row], total: 1 });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ id: NOTIF_ID, type: 'FOLLOW', isRead: false });
      expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns the unread count', async () => {
      authenticate();
      mockCountUnread.mockResolvedValue(4);

      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ count: 4 });
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks a notification read', async () => {
      authenticate();
      mockFindOwned.mockResolvedValue(row);
      mockMarkRead.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch(`/api/v1/notifications/${NOTIF_ID}/read`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('returns 404 for a foreign or missing notification', async () => {
      authenticate();
      mockFindOwned.mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/v1/notifications/${NOTIF_ID}/read`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('returns 400 for a malformed id', async () => {
      authenticate();

      const res = await request(app)
        .patch('/api/v1/notifications/not-a-uuid/read')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('marks all notifications read', async () => {
      authenticate();
      mockMarkAllRead.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockMarkAllRead).toHaveBeenCalledWith(USER);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('deletes a notification', async () => {
      authenticate();
      mockDeleteOne.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete(`/api/v1/notifications/${NOTIF_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockDeleteOne).toHaveBeenCalledWith(USER, NOTIF_ID);
    });

    it('returns 404 when nothing was deleted', async () => {
      authenticate();
      mockDeleteOne.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .delete(`/api/v1/notifications/${NOTIF_ID}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /notifications', () => {
    it('clears all notifications', async () => {
      authenticate();
      mockDeleteAll.mockResolvedValue({ count: 5 });

      const res = await request(app)
        .delete('/api/v1/notifications')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockDeleteAll).toHaveBeenCalledWith(USER);
    });
  });
});
