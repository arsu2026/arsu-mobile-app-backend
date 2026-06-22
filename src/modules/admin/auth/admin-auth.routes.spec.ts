jest.mock('./admin-auth.service', () => ({
  login: jest.fn(),
  getMe: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../../../prisma', () => ({
  prisma: { adminUser: { findUnique: jest.fn() } },
}));

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { errorHandler } from '../../../common/middleware/error-handler.middleware';
import { env } from '../../../config/env.config';
import { UnauthorizedError } from '../../../common/errors';
import { prisma } from '../../../prisma';
import * as service from './admin-auth.service';
import { adminAuthRouter } from './admin-auth.routes';

const mockLogin = service.login as jest.Mock;
const mockGetMe = service.getMe as jest.Mock;
const mockLogout = service.logout as jest.Mock;
const mockFindUnique = (prisma.adminUser as { findUnique: jest.Mock }).findUnique;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/auth', adminAuthRouter);
  app.use(errorHandler);
  return app;
}

function bearer() {
  const token = jwt.sign({ sub: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN' }, env.ADMIN_JWT_SECRET);
  return `Bearer ${token}`;
}

describe('admin auth routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('422s an invalid login body', async () => {
    const res = await request(app).post('/api/v1/admin/auth/login').send({ email: 'bad', password: 'x' });
    expect(res.status).toBe(422);
  });

  it('401s on bad credentials', async () => {
    mockLogin.mockRejectedValue(new UnauthorizedError('Invalid email or password'));
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@arsu.app', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid email or password' });
  });

  it('200s with a token + admin on success', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt-123', admin: { id: 'admin-1', email: 'admin@arsu.app' } });
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@arsu.app', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { token: 'jwt-123' } });
  });

  it('401s /me without a token', async () => {
    const res = await request(app).get('/api/v1/admin/auth/me');
    expect(res.status).toBe(401);
  });

  it('200s /me with a valid token', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', status: 'ACTIVE' });
    mockGetMe.mockResolvedValue({ id: 'admin-1', email: 'admin@arsu.app' });
    const res = await request(app).get('/api/v1/admin/auth/me').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('admin-1');
    expect(mockGetMe).toHaveBeenCalledWith('admin-1');
  });

  it('200s /logout with a valid token', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', status: 'ACTIVE' });
    mockLogout.mockResolvedValue({ success: true });
    const res = await request(app).post('/api/v1/admin/auth/logout').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true });
  });
});
