import type { NextFunction, Request, Response } from 'express';

jest.mock('../../config/supabase.config');

import { supabaseAdmin } from '../../config/supabase.config';
import { optionalSupabaseAuthGuard } from './optional-supabase-auth.guard';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;

function mockReq(authHeader?: string): Request {
  return { headers: authHeader ? { authorization: authHeader } : {} } as Request;
}

describe('optionalSupabaseAuthGuard', () => {
  const next = jest.fn() as NextFunction;
  const res = {} as Response;

  beforeEach(() => jest.clearAllMocks());

  it('continues without user when no Authorization header is present', async () => {
    await optionalSupabaseAuthGuard(mockReq(), res, next);
    expect(next).toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('attaches user when token is valid', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', role: 'authenticated' } },
      error: null,
    });

    const req = mockReq('Bearer good-token');
    await optionalSupabaseAuthGuard(req, res, next);

    expect(req.user?.sub).toBe('u1');
    expect(req.accessToken).toBe('good-token');
    expect(next).toHaveBeenCalled();
  });

  it('continues without user when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });

    const req = mockReq('Bearer bad-token');
    await optionalSupabaseAuthGuard(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
