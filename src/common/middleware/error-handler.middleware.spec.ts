import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { errorHandler } from './error-handler.middleware';
import { NotFoundError } from '../errors';

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const req = { method: 'POST', path: '/profile/me/heartbeat' } as Request;
const next = jest.fn();

describe('errorHandler', () => {
  it('maps a Prisma P2025 (record not found) to a 404', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
      code: 'P2025',
      clientVersion: 'test',
    });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect((res.json as jest.Mock).mock.calls[0][0]).toMatchObject({ success: false });
  });

  it('passes an AppError status code through', () => {
    const res = mockRes();

    errorHandler(new NotFoundError('Profile'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('falls back to 500 for an unknown error', () => {
    const res = mockRes();

    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
