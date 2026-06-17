jest.mock('../../config/supabase.config');
jest.mock('./contacts.service', () => ({ syncContacts: jest.fn() }));
jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/env.config', () => ({ env: { NODE_ENV: 'test' } }));

import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { supabaseAdmin } from '../../config/supabase.config';
import * as contactsService from './contacts.service';
import { contactsRouter } from './contacts.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockSync = contactsService.syncContacts as jest.Mock;
const USER_A = '11111111-1111-4111-8111-111111111111';

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: 'a@x.com' } }, error: null });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/contacts', contactsRouter);
  app.use(errorHandler);
  return app;
}

describe('contacts routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/contacts/sync').send({ contacts: [] });
    expect(res.status).toBe(401);
  });

  it('422s a missing contacts array', async () => {
    authAs(USER_A);
    const res = await request(app)
      .post('/api/v1/contacts/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({});
    expect(res.status).toBe(422);
  });

  it('syncs contacts', async () => {
    authAs(USER_A);
    mockSync.mockResolvedValue({ syncedCount: 1, matchedCount: 0, matches: [] });
    const res = await request(app)
      .post('/api/v1/contacts/sync')
      .set('Authorization', 'Bearer valid-token')
      .send({ contacts: [{ phone: '+15551234567' }] });
    expect(res.status).toBe(200);
    expect(res.body.data.syncedCount).toBe(1);
    expect(mockSync).toHaveBeenCalledWith(USER_A, [{ phone: '+15551234567' }]);
  });
});
