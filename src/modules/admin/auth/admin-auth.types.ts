import type { AdminRole, AdminStatus } from '@prisma/client';

// Attached to req.admin by requireAdmin (decoded + DB-fresh identity).
export interface AdminPrincipal {
  id: string;
  email: string;
  role: AdminRole;
}

// Claims we sign into / verify out of the admin JWT.
export interface AdminTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
}

// API-facing admin shape (dates as ISO strings).
export interface AdminView {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  status: AdminStatus;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  admin: AdminView;
}
