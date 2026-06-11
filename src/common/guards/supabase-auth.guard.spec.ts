import type { NextFunction, Request, Response } from 'express';

// Mock only the Supabase boundary; the guard's extraction logic is real.
jest.mock('../../config/supabase.config');

import { supabaseAdmin } from '../../config/supabase.config';
import { UnauthorizedError } from '../errors';
import { supabaseAuthGuard } from './supabase-auth.guard';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;

function buildCtx(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('supabaseAuthGuard', () => {
  it('rejects when the Authorization header is missing', async () => {
    const { req, res, next } = buildCtx();
    await expect(supabaseAuthGuard(req, res, next)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('rejects when the Authorization header is not a Bearer token', async () => {
    const { req, res, next } = buildCtx({ authorization: 'Basic dXNlcjpwYXNz' });
    await expect(supabaseAuthGuard(req, res, next)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('rejects a Bearer header whose token is empty/whitespace', async () => {
    const { req, res, next } = buildCtx({ authorization: 'Bearer    ' });
    await expect(supabaseAuthGuard(req, res, next)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('rejects when Supabase cannot validate the token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const { req, res, next } = buildCtx({ authorization: 'Bearer invalid-token' });

    await expect(supabaseAuthGuard(req, res, next)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the user and raw token, then calls next on a valid token', async () => {
    const user = { id: 'user-123', email: 'user@example.com', role: 'authenticated' };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    const { req, res, next } = buildCtx({ authorization: 'Bearer good-token' });

    await supabaseAuthGuard(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('good-token');
    expect(req.accessToken).toBe('good-token');
    expect(req.user).toMatchObject({
      sub: 'user-123',
      email: 'user@example.com',
      role: 'authenticated',
    });
    expect(next).toHaveBeenCalledWith();
  });
});
