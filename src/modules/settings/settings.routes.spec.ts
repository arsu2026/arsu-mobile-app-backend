import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('../../config/supabase.config');
jest.mock('./settings.repository');

jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test', MAIL_USER: '', MAIL_FROM: 'test@example.com' },
}));

import { supabaseAdmin } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import * as repo from './settings.repository';
import { settingsRouter } from './settings.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockFindProfileById = repo.findProfileById as jest.Mock;
const mockGetPrivacySettings = repo.getPrivacySettings as jest.Mock;
const mockEnsureAccountSettings = repo.ensureAccountSettings as jest.Mock;
const mockCountUserSessions = repo.countUserSessions as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';

const baseProfile = {
  id: USER_A,
  createdAt: new Date('2024-01-01'),
  accountSettings: {
    phone: '+15551234567',
    lastLoginAt: new Date('2024-06-01'),
    lastPasswordChangeAt: null,
    twoFactorEnabled: false,
    lastLoginLocation: 'New York, US',
    lastLoginDevice: 'Chrome',
  },
  privacySettings: {
    isPrivate: false,
    postsVisibility: 'PUBLIC',
    messagesFrom: 'EVERYONE',
    followersListVisibility: 'PUBLIC',
    followingListVisibility: 'PUBLIC',
  },
};

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/settings', settingsRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'user@example.com', role: 'authenticated' } },
    error: null,
  });
}

describe('GET /api/v1/settings/account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindProfileById.mockResolvedValue(baseProfile);
    mockEnsureAccountSettings.mockResolvedValue(baseProfile.accountSettings);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/settings/account');
    expect(res.status).toBe(401);
  });

  it('returns account info for authenticated user', async () => {
    authAs(USER_A);

    const res = await request(app)
      .get('/api/v1/settings/account')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('user@example.com');
    expect(res.body.data.phone).toBe('***-***-4567');
  });
});

describe('GET /api/v1/settings/privacy', () => {
  it('returns privacy settings', async () => {
    authAs(USER_A);
    mockFindProfileById.mockResolvedValue(baseProfile);
    mockGetPrivacySettings.mockResolvedValue(baseProfile.privacySettings);

    const res = await request(app)
      .get('/api/v1/settings/privacy')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.data.postsVisibility).toBe('PUBLIC');
  });
});

describe('GET /api/v1/settings/security', () => {
  it('returns security overview', async () => {
    authAs(USER_A);
    mockFindProfileById.mockResolvedValue(baseProfile);
    mockEnsureAccountSettings.mockResolvedValue(baseProfile.accountSettings);
    mockCountUserSessions.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/v1/settings/security')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.data.twoFactorEnabled).toBe(false);
    expect(res.body.data.activeSessionCount).toBe(2);
  });
});

describe('PUT /api/v1/settings/password', () => {
  it('returns 422 for short new password', async () => {
    authAs(USER_A);

    const res = await request(app)
      .put('/api/v1/settings/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ currentPassword: 'oldpass12', newPassword: 'short' });

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/v1/settings/privacy/messages', () => {
  it('updates message privacy', async () => {
    authAs(USER_A);
    mockFindProfileById.mockResolvedValue(baseProfile);
    const mockUpdatePrivacySettings = repo.updatePrivacySettings as jest.Mock;
    mockUpdatePrivacySettings.mockResolvedValue({
      ...baseProfile.privacySettings,
      messagesFrom: 'FOLLOWERS',
    });

    const res = await request(app)
      .put('/api/v1/settings/privacy/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ messagesFrom: 'FOLLOWERS' });

    expect(res.status).toBe(200);
    expect(res.body.data.messagesFrom).toBe('FOLLOWERS');
  });
});
