jest.mock('./admin-auth.repository');
jest.mock('../audit/admin-audit.repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as auditRepo from '../audit/admin-audit.repository';
import * as repo from './admin-auth.repository';
import { getMe, login, logout } from './admin-auth.service';

const mockFindByEmail = repo.findByEmail as jest.Mock;
const mockFindById = repo.findById as jest.Mock;
const mockUpdateLastActive = repo.updateLastActiveAt as jest.Mock;
const mockWriteAudit = auditRepo.writeAuditLog as jest.Mock;
const mockCompare = bcrypt.compare as unknown as jest.Mock;
const mockSign = jwt.sign as unknown as jest.Mock;

function adminRow(over: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@arsu.app',
    passwordHash: 'hashed',
    fullName: 'Super Admin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    lastActiveAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...over,
  };
}

describe('admin-auth.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('returns a token + view, updates lastActiveAt, writes an audit row', async () => {
      mockFindByEmail.mockResolvedValue(adminRow());
      mockCompare.mockResolvedValue(true);
      mockSign.mockReturnValue('signed.jwt.token');
      mockUpdateLastActive.mockResolvedValue(
        adminRow({ lastActiveAt: new Date('2026-06-22T00:00:00.000Z') }),
      );

      const result = await login({ email: 'Admin@Arsu.app', password: 'password123' }, '127.0.0.1');

      expect(mockFindByEmail).toHaveBeenCalledWith('admin@arsu.app'); // lowercased
      expect(mockCompare).toHaveBeenCalledWith('password123', 'hashed');
      expect(mockSign).toHaveBeenCalledWith(
        { sub: 'admin-1', email: 'admin@arsu.app', role: 'SUPER_ADMIN' },
        expect.any(String),
        expect.objectContaining({ expiresIn: expect.anything() }),
      );
      expect(mockUpdateLastActive).toHaveBeenCalledWith('admin-1');
      expect(mockWriteAudit).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'admin.login',
        ipAddress: '127.0.0.1',
      });
      expect(result.token).toBe('signed.jwt.token');
      expect(result.admin).toMatchObject({
        id: 'admin-1',
        email: 'admin@arsu.app',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        lastActiveAt: '2026-06-22T00:00:00.000Z',
        createdAt: '2026-06-01T00:00:00.000Z',
      });
    });

    it('throws 401 when the email is unknown (no enumeration)', async () => {
      mockFindByEmail.mockResolvedValue(null);
      await expect(login({ email: 'nobody@arsu.app', password: 'password123' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
      expect(mockSign).not.toHaveBeenCalled();
    });

    it('throws 401 with the same message when the password is wrong', async () => {
      mockFindByEmail.mockResolvedValue(adminRow());
      mockCompare.mockResolvedValue(false);
      await expect(login({ email: 'admin@arsu.app', password: 'wrongpass1' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('throws 403 when the account is suspended', async () => {
      mockFindByEmail.mockResolvedValue(adminRow({ status: 'SUSPENDED' }));
      mockCompare.mockResolvedValue(true);
      await expect(login({ email: 'admin@arsu.app', password: 'password123' })).rejects.toMatchObject({
        statusCode: 403,
        message: 'This admin account is suspended',
      });
      expect(mockSign).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('re-reads and maps the admin to a view', async () => {
      mockFindById.mockResolvedValue(adminRow());
      const view = await getMe('admin-1');
      expect(mockFindById).toHaveBeenCalledWith('admin-1');
      expect(view).toMatchObject({ id: 'admin-1', email: 'admin@arsu.app' });
    });

    it('throws 401 when the admin no longer exists', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(getMe('ghost')).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('logout', () => {
    it('writes an audit row and returns success', async () => {
      const result = await logout('admin-1', '10.0.0.1');
      expect(mockWriteAudit).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'admin.logout',
        ipAddress: '10.0.0.1',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
