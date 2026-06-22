import type { NextFunction, Request, Response } from 'express';
import { requireRole } from './admin-role.guard';

function ctx(admin?: { id: string; email: string; role: string }) {
  const req = { admin } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('requireRole', () => {
  it('calls next when the admin role is in the allowed set', () => {
    const { req, res, next } = ctx({ id: 'a', email: 'a@x.com', role: 'SUPER_ADMIN' });
    requireRole('SUPER_ADMIN', 'ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('throws 403 when the role is not allowed', () => {
    const { req, res, next } = ctx({ id: 'a', email: 'a@x.com', role: 'MODERATOR' });
    expect(() => requireRole('SUPER_ADMIN')(req, res, next)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('throws 401 when no admin is attached (guard order misuse)', () => {
    const { req, res, next } = ctx(undefined);
    expect(() => requireRole('ADMIN')(req, res, next)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
  });
});
