import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.config';
import { ForbiddenError, UnauthorizedError } from '../../../common/errors';
import * as auditRepo from '../audit/admin-audit.repository';
import * as repo from './admin-auth.repository';
import type { AdminView, LoginResult } from './admin-auth.types';

type AdminRow = NonNullable<Awaited<ReturnType<typeof repo.findById>>>;

function mapAdmin(row: AdminRow): AdminView {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    lastActiveAt: row.lastActiveAt ? row.lastActiveAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function login(
  input: { email: string; password: string },
  ipAddress?: string,
): Promise<LoginResult> {
  const email = input.email.toLowerCase();
  const admin = await repo.findByEmail(email);

  // Same 401 for unknown email and bad password — avoid user enumeration.
  if (!admin) throw new UnauthorizedError('Invalid email or password');

  const passwordOk = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordOk) throw new UnauthorizedError('Invalid email or password');

  if (admin.status !== 'ACTIVE') throw new ForbiddenError('This admin account is suspended');

  const token = jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role },
    env.ADMIN_JWT_SECRET,
    { expiresIn: env.ADMIN_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  const updated = await repo.updateLastActiveAt(admin.id);
  await auditRepo.writeAuditLog({ adminId: admin.id, action: 'admin.login', ipAddress });

  return { token, admin: mapAdmin(updated) };
}

export async function getMe(adminId: string): Promise<AdminView> {
  const admin = await repo.findById(adminId);
  if (!admin) throw new UnauthorizedError('Invalid or expired token');
  return mapAdmin(admin);
}

export async function logout(adminId: string, ipAddress?: string): Promise<{ success: true }> {
  await auditRepo.writeAuditLog({ adminId, action: 'admin.logout', ipAddress });
  return { success: true };
}
