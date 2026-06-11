import { JwtPayload } from './global.types';

// Augment Express Request to include typed user from Passport
declare global {
  namespace Express {
    interface User extends JwtPayload {}

    interface Request {
      // Raw Supabase access token, set by supabaseAuthGuard after verification
      accessToken?: string;
    }
  }
}

export {};
