import express, { type Express } from 'express';
import request from 'supertest';

// Mock only the Supabase boundary (shared manual mock in src/config/__mocks__).
// Everything in between — validation middleware, the guard, the service, the
// controller, Express 5 async error forwarding, and the central error handler —
// runs for real.
jest.mock('../../config/supabase.config');

// Keep test output pristine: the real error handler logs every AppError.
jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Avoid loading the real .env (the error handler imports env.config, which runs
// dotenv). Its only dependency here is NODE_ENV, so a stub keeps the test hermetic.
jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test' },
}));

import { supabaseAdmin, supabaseClient } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import { authRouter } from './auth.routes';

const mockSignUp = supabaseClient.auth.signUp as jest.Mock;
const mockSignIn = supabaseClient.auth.signInWithPassword as jest.Mock;
const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockAdminSignOut = supabaseAdmin.auth.admin.signOut as jest.Mock;
const mockResetForEmail = supabaseClient.auth.resetPasswordForEmail as jest.Mock;
const mockVerifyOtp = supabaseClient.auth.verifyOtp as jest.Mock;
const mockUpdateUserById = supabaseAdmin.auth.admin.updateUserById as jest.Mock;
const mockRefreshSession = supabaseClient.auth.refreshSession as jest.Mock;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const validSignup = { email: 'user@example.com', password: 'strongpass123' };

describe('POST /api/v1/auth/users/email/signup', () => {
  it('returns 201 with the session when email confirmation is disabled', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'a' } },
      error: null,
    });

    const res = await request(app).post('/api/v1/auth/users/email/signup').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session).toEqual({ access_token: 'a' });
    expect(res.body.message).not.toMatch(/confirm/i);
  });

  it('returns 201 and asks the user to confirm when no session is issued', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });

    const res = await request(app).post('/api/v1/auth/users/email/signup').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.data.session).toBeNull();
    expect(res.body.message).toMatch(/confirm/i);
  });

  it('returns 422 when the body fails validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users/email/signup')
      .send({ email: 'nope', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/users/email/login', () => {
  it('returns 200 with the session on valid credentials', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'a' } },
      error: null,
    });

    const res = await request(app).post('/api/v1/auth/users/email/login').send(validSignup);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session).toEqual({ access_token: 'a' });
  });

  it('returns 401 on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'no' },
    });

    const res = await request(app).post('/api/v1/auth/users/email/login').send(validSignup);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/users/logout', () => {
  it('returns 200 and revokes the session with a valid Bearer token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'user@example.com', role: 'authenticated' } },
      error: null,
    });
    mockAdminSignOut.mockResolvedValue({ data: null, error: null });

    const res = await request(app)
      .post('/api/v1/auth/users/logout')
      .set('Authorization', 'Bearer good-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/logged out/i);
    expect(mockAdminSignOut).toHaveBeenCalledWith('good-token', 'global');
  });

  it('returns 401 when no Bearer token is provided', async () => {
    const res = await request(app).post('/api/v1/auth/users/logout');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(mockAdminSignOut).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/users/email/forgot-password', () => {
  it('returns 200 with a generic message and emails a recovery code', async () => {
    mockResetForEmail.mockResolvedValue({ data: {}, error: null });

    const res = await request(app)
      .post('/api/v1/auth/users/email/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockResetForEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('returns 422 when the email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users/email/forgot-password')
      .send({ email: 'nope' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(mockResetForEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/users/email/reset-password', () => {
  const validBody = { email: 'user@example.com', token: '123456', password: 'newstrongpass' };

  it('returns 200 after verifying the code and setting the new password', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'recovery-token' } },
      error: null,
    });
    mockUpdateUserById.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockAdminSignOut.mockResolvedValue({ data: null, error: null });

    const res = await request(app).post('/api/v1/auth/users/email/reset-password').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUpdateUserById).toHaveBeenCalledWith('u1', { password: 'newstrongpass' });
    expect(mockAdminSignOut).toHaveBeenCalledWith('recovery-token', 'global');
  });

  it('returns 400 when the recovery code is invalid or expired', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'expired' },
    });

    const res = await request(app).post('/api/v1/auth/users/email/reset-password').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it('returns 422 when the new password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users/email/reset-password')
      .send({ ...validBody, password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/users/token/refresh', () => {
  it('returns 200 with a fresh session for a valid refresh token', async () => {
    mockRefreshSession.mockResolvedValue({
      data: {
        user: { id: 'u1' },
        session: { access_token: 'new-access', refresh_token: 'new-refresh' },
      },
      error: null,
    });

    const res = await request(app)
      .post('/api/v1/auth/users/token/refresh')
      .send({ refresh_token: 'old-refresh' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.access_token).toBe('new-access');
    expect(mockRefreshSession).toHaveBeenCalledWith({ refresh_token: 'old-refresh' });
  });

  it('returns 401 when the refresh token is invalid or expired', async () => {
    mockRefreshSession.mockResolvedValue({
      data: {},
      error: {
        name: 'AuthApiError',
        code: 'refresh_token_not_found',
        status: 400,
        message: 'not found',
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/users/token/refresh')
      .send({ refresh_token: 'revoked' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 when the refresh token is missing', async () => {
    const res = await request(app).post('/api/v1/auth/users/token/refresh').send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});
