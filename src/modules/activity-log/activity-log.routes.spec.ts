jest.mock('../../config/supabase.config');
jest.mock('./activity-log.service', () => ({
  getActivityLog: jest.fn(),
}));
jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/env.config', () => ({ env: { NODE_ENV: 'test' } }));

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { supabaseAdmin } from '../../config/supabase.config';
import * as activityLogService from './activity-log.service';
import { activityLogRouter } from './activity-log.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockGetActivityLog = activityLogService.getActivityLog as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: 'a@x.com' } }, error: null });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/activity-log', activityLogRouter);
  app.use(errorHandler);
  return app;
}

describe('activity-log routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/activity-log');
    expect(res.status).toBe(401);
  });

  it('returns the activity list for an authenticated user', async () => {
    authAs(USER_A);
    mockGetActivityLog.mockResolvedValue({
      items: [{ id: 'a1', type: 'POST_LIKED', entityId: 'p1', entityType: 'POST', preview: null, createdAt: '2026-06-01T00:00:00.000Z' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    });
    const res = await request(app)
      .get('/api/v1/activity-log?type=liked')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.data[0].type).toBe('POST_LIKED');
    expect(mockGetActivityLog).toHaveBeenCalledWith(USER_A, 'liked', 1, 20);
  });
});
