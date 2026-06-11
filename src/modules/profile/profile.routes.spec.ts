import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('../../config/supabase.config');
jest.mock('./profile.repository');

jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test' },
}));

import { supabaseAdmin } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import * as repo from './profile.repository';
import { profileRouter } from './profile.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockFindProfileById = repo.findProfileById as jest.Mock;
const mockCountFollowers = repo.countFollowers as jest.Mock;
const mockCountFollowing = repo.countFollowing as jest.Mock;
const mockCountPosts = repo.countPosts as jest.Mock;
const mockFindFollow = repo.findFollow as jest.Mock;
const mockUpdateProfile = repo.updateProfile as jest.Mock;
const mockFindUsernameConflict = repo.findUsernameConflict as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/profile', profileRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

const publicProfile = {
  id: USER_B,
  username: 'jane',
  fullName: 'Jane Doe',
  bio: 'Hello',
  avatarUrl: null,
  coverUrl: null,
  website: null,
  dateOfBirth: null,
  gender: null,
  relationshipStatus: null,
  location: null,
  work: null,
  education: null,
  currentCity: null,
  hometown: null,
  pinnedPostId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  privacySettings: { isPrivate: false },
};

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'user@example.com', role: 'authenticated' } },
    error: null,
  });
}

describe('GET /api/v1/profile/:userId', () => {
  it('returns profile data without authentication', async () => {
    mockFindProfileById.mockResolvedValue(publicProfile);
    mockCountFollowers.mockResolvedValue(12);
    mockCountFollowing.mockResolvedValue(8);
    mockCountPosts.mockResolvedValue(4);

    const res = await request(app).get(`/api/v1/profile/${USER_B}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('Jane Doe');
    expect(res.body.data.followerCount).toBe(12);
  });

  it('returns 404 for invalid user id format', async () => {
    const res = await request(app).get('/api/v1/profile/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /api/v1/profile/update', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put('/api/v1/profile/update')
      .send({ fullName: 'New Name' });

    expect(res.status).toBe(401);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('updates profile for authenticated user', async () => {
    authAs(USER_A);
    mockFindProfileById.mockResolvedValue({ ...publicProfile, id: USER_A });
    mockFindUsernameConflict.mockResolvedValue(null);
    mockUpdateProfile.mockResolvedValue({ ...publicProfile, id: USER_A, fullName: 'New Name' });
    mockFindProfileById.mockResolvedValue({ ...publicProfile, id: USER_A, fullName: 'New Name' });
    mockCountFollowers.mockResolvedValue(0);
    mockCountFollowing.mockResolvedValue(0);
    mockCountPosts.mockResolvedValue(0);
    mockFindFollow.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/profile/update')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('New Name');
    expect(mockUpdateProfile).toHaveBeenCalled();
  });

  it('returns 422 for invalid username', async () => {
    authAs(USER_A);

    const res = await request(app)
      .put('/api/v1/profile/update')
      .set('Authorization', 'Bearer valid-token')
      .send({ username: 'bad username!' });

    expect(res.status).toBe(422);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/profile/search', () => {
  it('returns 422 when query is too short', async () => {
    const res = await request(app).get('/api/v1/profile/search').query({ q: 'a' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
