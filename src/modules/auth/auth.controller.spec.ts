import type { Request, Response } from 'express';

// Auto-mock the service so we can assert logout never revokes without a token.
jest.mock('./auth.service');

import { logout } from './auth.controller';
import { signOut } from './auth.service';
import { UnauthorizedError } from '../../common/errors';

const mockSignOut = signOut as jest.Mock;

describe('auth.controller', () => {
  describe('logout', () => {
    // This branch is unreachable via the router (supabaseAuthGuard blocks a
    // missing token first), but it guards the contract — and narrows
    // req.accessToken from `string | undefined` to `string` for signOut().
    it('throws UnauthorizedError and does not revoke when no access token is present', async () => {
      const req = { headers: {} } as unknown as Request;
      const res = {} as Response;

      await expect(logout(req, res)).rejects.toBeInstanceOf(UnauthorizedError);
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });
});
