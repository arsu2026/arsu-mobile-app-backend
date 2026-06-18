jest.mock('../../config/supabase.config');
jest.mock('./support.service', () => ({ createReport: jest.fn(), getInbox: jest.fn() }));
jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/env.config', () => ({ env: { NODE_ENV: 'test' } }));

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { supabaseAdmin } from '../../config/supabase.config';
import * as supportService from './support.service';
import { supportRouter } from './support.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockCreate = supportService.createReport as jest.Mock;
const mockInbox = supportService.getInbox as jest.Mock;
const USER_A = '11111111-1111-4111-8111-111111111111';

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: 'a@x.com' } }, error: null });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/support', supportRouter);
  app.use(errorHandler);
  return app;
}

describe('support routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/support/reports').send({ description: 'hi there' });
    expect(res.status).toBe(401);
  });

  it('422s a missing description', async () => {
    authAs(USER_A);
    const res = await request(app)
      .post('/api/v1/support/reports')
      .set('Authorization', 'Bearer valid-token')
      .send({ subject: 'Bug' });
    expect(res.status).toBe(422);
  });

  it('creates a report (201)', async () => {
    authAs(USER_A);
    mockCreate.mockResolvedValue({ id: 'r1', status: 'OPEN' });
    const res = await request(app)
      .post('/api/v1/support/reports')
      .set('Authorization', 'Bearer valid-token')
      .send({ description: 'It broke' });
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(USER_A, { description: 'It broke' });
  });

  it('lists the inbox', async () => {
    authAs(USER_A);
    mockInbox.mockResolvedValue({
      items: [{ id: 'r1', status: 'OPEN' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    });
    const res = await request(app)
      .get('/api/v1/support/inbox')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe('r1');
  });
});
