jest.mock('../../prisma', () => ({
  prisma: { adminUser: { findUnique: jest.fn() } },
}));

import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.config';
import { prisma } from '../../prisma';
import { requireAdmin } from './admin-auth.guard';

const mockFindUnique = (prisma.adminUser as { findUnique: jest.Mock }).findUnique;

function ctx(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

function signToken(over: Record<string, unknown> = {}) {
  return jwt.sign({ sub: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', ...over }, env.ADMIN_JWT_SECRET);
}

const activeAdmin = { id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', status: 'ACTIVE' };

describe('requireAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches req.admin and calls next for a valid token + active admin', async () => {
    mockFindUnique.mockResolvedValue(activeAdmin);
    const { req, res, next } = ctx(`Bearer ${signToken()}`);
    await requireAdmin(req, res, next);
    expect(req.admin).toEqual({ id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN' });
    expect(next).toHaveBeenCalledWith();
  });

  it('throws 401 when the Authorization header is missing', async () => {
    const { req, res, next } = ctx();
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a malformed / non-Bearer header', async () => {
    const { req, res, next } = ctx('Token abc');
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a token signed with the wrong secret', async () => {
    const bad = jwt.sign({ sub: 'admin-1', email: 'x', role: 'ADMIN' }, 'wrong-secret');
    const { req, res, next } = ctx(`Bearer ${bad}`);
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when the admin no longer exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const { req, res, next } = ctx(`Bearer ${signToken()}`);
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 when the admin is suspended', async () => {
    mockFindUnique.mockResolvedValue({ ...activeAdmin, status: 'SUSPENDED' });
    const { req, res, next } = ctx(`Bearer ${signToken()}`);
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 403 });
  });
});
