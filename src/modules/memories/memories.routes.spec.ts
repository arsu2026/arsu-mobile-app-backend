jest.mock('../../config/supabase.config');
jest.mock('./memories.service', () => ({ getMemories: jest.fn() }));
jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/env.config', () => ({ env: { NODE_ENV: 'test' } }));

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { supabaseAdmin } from '../../config/supabase.config';
import * as memoriesService from './memories.service';
import { memoriesRouter } from './memories.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockGetMemories = memoriesService.getMemories as jest.Mock;
const USER_A = '11111111-1111-4111-8111-111111111111';

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: 'a@x.com' } }, error: null });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/memories', memoriesRouter);
  app.use(errorHandler);
  return app;
}

describe('memories routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/memories');
    expect(res.status).toBe(401);
  });

  it('422s a malformed date', async () => {
    authAs(USER_A);
    const res = await request(app)
      .get('/api/v1/memories?date=2026-06-17')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(422);
  });

  it('returns memories for an authenticated user', async () => {
    authAs(USER_A);
    mockGetMemories.mockResolvedValue([{ yearsAgo: 6, post: { id: 'p1' } }]);
    const res = await request(app)
      .get('/api/v1/memories?date=06-17')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.data[0].yearsAgo).toBe(6);
    expect(mockGetMemories).toHaveBeenCalledWith(USER_A, '06-17');
  });
});
