import { JwtPayload } from './global.types';

// Augment Express Request to include typed user from Passport
declare global {
  namespace Express {
    interface User extends JwtPayload {}
  }
}

export {};
