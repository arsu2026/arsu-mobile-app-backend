jest.mock('../../config/supabase.config');
jest.mock('./saved.service', () => ({
  createSavedItem: jest.fn(),
  listSavedItems: jest.fn(),
  deleteSavedItem: jest.fn(),
  createCollection: jest.fn(),
  listCollections: jest.fn(),
}));
jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/env.config', () => ({ env: { NODE_ENV: 'test' } }));

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { supabaseAdmin } from '../../config/supabase.config';
import * as savedService from './saved.service';
import { savedRouter } from './saved.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockCreate = savedService.createSavedItem as jest.Mock;
const mockList = savedService.listSavedItems as jest.Mock;
const mockDelete = savedService.deleteSavedItem as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const POST = '33333333-3333-4333-8333-333333333333';

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: 'a@x.com' } }, error: null });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/saved', savedRouter);
  app.use(errorHandler);
  return app;
}

describe('saved routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/saved').send({ type: 'POST', postId: POST });
    expect(res.status).toBe(401);
  });

  it('creates a saved item (201)', async () => {
    authAs(USER_A);
    mockCreate.mockResolvedValue({ id: 's1', type: 'POST' });
    const res = await request(app)
      .post('/api/v1/saved')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'POST', postId: POST });
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(USER_A, { type: 'POST', postId: POST });
  });

  it('422s an invalid body', async () => {
    authAs(USER_A);
    const res = await request(app)
      .post('/api/v1/saved')
      .set('Authorization', 'Bearer valid-token')
      .send({ type: 'POST' });
    expect(res.status).toBe(422);
  });

  it('lists saved items', async () => {
    authAs(USER_A);
    mockList.mockResolvedValue({
      items: [{ id: 's1', type: 'POST' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    });
    const res = await request(app)
      .get('/api/v1/saved?type=post')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe('s1');
    expect(mockList).toHaveBeenCalledWith(USER_A, 'post', undefined, 1, 20);
  });

  it('deletes a saved item', async () => {
    authAs(USER_A);
    mockDelete.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/v1/saved/s1')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(USER_A, 's1');
  });
});
