import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('../../config/supabase.config');
jest.mock('./search.service', () => ({
  searchPosts: jest.fn(),
  searchVideos: jest.fn(),
  searchHashtags: jest.fn(),
  unifiedSearch: jest.fn(),
  getHashtagFeed: jest.fn(),
  getExploreFeed: jest.fn(),
  getSearchHistory: jest.fn(),
  saveSearchHistory: jest.fn(),
  deleteSearchHistoryItem: jest.fn(),
  clearSearchHistory: jest.fn(),
}));

jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test' },
}));

import { supabaseAdmin } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import * as searchService from './search.service';
import { searchRouter } from './search.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockSearchPosts = searchService.searchPosts as jest.Mock;
const mockGetSearchHistory = searchService.getSearchHistory as jest.Mock;
const mockSaveSearchHistory = searchService.saveSearchHistory as jest.Mock;
const mockGetExploreFeed = searchService.getExploreFeed as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/search', searchRouter);
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

beforeEach(() => jest.clearAllMocks());

describe('GET /api/v1/search/hashtags', () => {
  it('returns hashtag search results without auth', async () => {
    const mockSearchHashtags = searchService.searchHashtags as jest.Mock;
    mockSearchHashtags.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/search/hashtags?q=hello');

    expect(res.status).toBe(200);
    expect(res.body.data.hashtags).toEqual([]);
  });
});

describe('GET /api/v1/search/posts', () => {
  it('returns search results without authentication', async () => {
    mockSearchPosts.mockResolvedValue({
      posts: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    });

    const res = await request(app).get('/api/v1/search/posts?q=hello');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.posts).toEqual([]);
  });

  it('returns 422 for short query', async () => {
    const res = await request(app).get('/api/v1/search/posts?q=a');

    expect(res.status).toBe(422);
    expect(mockSearchPosts).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/search/history', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/search/history');

    expect(res.status).toBe(401);
    expect(mockGetSearchHistory).not.toHaveBeenCalled();
  });

  it('returns search history for authenticated user', async () => {
    authAs(USER_A);
    mockGetSearchHistory.mockResolvedValue([
      {
        id: 'hist-1',
        query: 'cats',
        searchType: 'ALL',
        searchedAt: '2024-06-01T00:00:00.000Z',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/search/history')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].query).toBe('cats');
  });
});

describe('POST /api/v1/search/history', () => {
  it('saves search query for authenticated user', async () => {
    authAs(USER_A);
    mockSaveSearchHistory.mockResolvedValue({
      id: 'hist-1',
      query: 'dogs',
      searchType: 'ALL',
      searchedAt: '2024-06-01T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/v1/search/history')
      .set('Authorization', 'Bearer valid-token')
      .send({ query: 'dogs' });

    expect(res.status).toBe(201);
    expect(res.body.data.query).toBe('dogs');
  });
});

describe('GET /api/v1/search/explore', () => {
  it('returns explore feed without auth', async () => {
    mockGetExploreFeed.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    });

    const res = await request(app).get('/api/v1/search/explore');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.feed).toEqual([]);
  });
});
