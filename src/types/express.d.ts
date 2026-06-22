import { JwtPayload } from './global.types';

// Augment Express Request to include typed user from Passport
declare global {
  namespace Express {
    interface User extends JwtPayload {}

    interface Request {
      // Raw Supabase access token, set by supabaseAuthGuard after verification
      accessToken?: string;
      // Authenticated admin identity, set by requireAdmin
      admin?: import('../modules/admin/auth/admin-auth.types').AdminPrincipal;
    }
  }
}

export {};
