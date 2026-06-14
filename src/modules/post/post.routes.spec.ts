import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('../../config/supabase.config');
jest.mock('./post.service');

jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test' },
}));

import { supabaseAdmin } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import * as postService from './post.service';
import { postRouter } from './post.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockCreatePost = postService.createPost as jest.Mock;
const mockGetPostById = postService.getPostById as jest.Mock;
const mockListPostsByAuthor = postService.listPostsByAuthor as jest.Mock;
const mockUpdatePost = postService.updatePost as jest.Mock;
const mockDeletePost = postService.deletePost as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const POST_ID = '33333333-3333-4333-8333-333333333333';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/posts', postRouter);
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

describe('POST /api/v1/posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/posts').field('content', 'hi');
    expect(res.status).toBe(401);
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('creates a post for an authenticated user', async () => {
    authAs(USER_A);
    mockCreatePost.mockResolvedValue({ id: POST_ID, content: 'hi' });

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer t')
      .field('content', 'hi');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('hi');
    expect(mockCreatePost).toHaveBeenCalled();
  });

  it('rejects a non-image upload with 400', async () => {
    authAs(USER_A);
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer t')
      .attach('images', Buffer.from('%PDF-1.4'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(mockCreatePost).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a post without auth', async () => {
    mockGetPostById.mockResolvedValue({ id: POST_ID, content: 'hi' });
    const res = await request(app).get(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(POST_ID);
  });
});

describe('GET /api/v1/posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 422 when authorId is missing', async () => {
    const res = await request(app).get('/api/v1/posts');
    expect(res.status).toBe(422);
    expect(mockListPostsByAuthor).not.toHaveBeenCalled();
  });

  it('lists posts by author', async () => {
    mockListPostsByAuthor.mockResolvedValue({
      posts: [{ id: POST_ID }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const res = await request(app).get('/api/v1/posts').query({ authorId: USER_A });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('PATCH /api/v1/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`/api/v1/posts/${POST_ID}`).send({ content: 'x' });
    expect(res.status).toBe(401);
    expect(mockUpdatePost).not.toHaveBeenCalled();
  });

  it('updates a post for the owner', async () => {
    authAs(USER_A);
    mockUpdatePost.mockResolvedValue({ id: POST_ID, content: 'x' });

    const res = await request(app)
      .patch(`/api/v1/posts/${POST_ID}`)
      .set('Authorization', 'Bearer t')
      .send({ content: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('x');
    expect(mockUpdatePost).toHaveBeenCalledWith(POST_ID, USER_A, { content: 'x' });
  });
});

describe('DELETE /api/v1/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).delete(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(401);
    expect(mockDeletePost).not.toHaveBeenCalled();
  });

  it('deletes a post for the owner', async () => {
    authAs(USER_A);
    mockDeletePost.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/v1/posts/${POST_ID}`)
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(mockDeletePost).toHaveBeenCalledWith(POST_ID, USER_A);
  });
});
