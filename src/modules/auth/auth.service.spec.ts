// The Supabase SDK is the one unavoidable external boundary — mock only it
// (shared manual mock in src/config/__mocks__). Everything below — error
// mapping and return shape — is real logic.
jest.mock('../../config/supabase.config');

import { supabaseClient, supabaseAdmin } from '../../config/supabase.config';
import { ConflictError, UnauthorizedError } from '../../common/errors';
import {
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './auth.service';

const mockSignUp = supabaseClient.auth.signUp as jest.Mock;
const mockSignIn = supabaseClient.auth.signInWithPassword as jest.Mock;
const mockAdminSignOut = supabaseAdmin.auth.admin.signOut as jest.Mock;
const mockResetForEmail = supabaseClient.auth.resetPasswordForEmail as jest.Mock;
const mockVerifyOtp = supabaseClient.auth.verifyOtp as jest.Mock;
const mockUpdateUserById = supabaseAdmin.auth.admin.updateUserById as jest.Mock;
const mockRefreshSession = supabaseClient.auth.refreshSession as jest.Mock;

/** Build a Supabase-shaped AuthError. */
function authError(code: string, status = 400, message = 'supabase says no') {
  return { name: 'AuthApiError', message, status, code };
}

describe('auth.service', () => {
  describe('signUpWithEmail', () => {
    it('returns the user and session on success', async () => {
      const user = { id: 'u1', email: 'user@example.com' };
      const session = { access_token: 'a', refresh_token: 'r' };
      mockSignUp.mockResolvedValue({ data: { user, session }, error: null });

      const result = await signUpWithEmail({
        email: 'user@example.com',
        password: 'strongpass123',
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'strongpass123',
        options: { data: {} },
      });
      expect(result).toEqual({ user, session });
    });

    it('maps email_exists to a 409 ConflictError', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: authError('email_exists', 422) });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('maps user_already_exists to a 409 ConflictError', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: authError('user_already_exists') });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toMatchObject({ statusCode: 409 });
    });

    it('maps weak_password to a 422 error', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: authError('weak_password', 422) });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toMatchObject({
        statusCode: 422,
        code: 'WEAK_PASSWORD',
      });
    });

    it('maps email send rate limiting to a 429 error', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: authError('over_email_send_rate_limit', 429),
      });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toMatchObject({ statusCode: 429 });
    });

    it('falls back to the Supabase status and uppercased code for unknown errors', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: authError('some_new_code', 418),
      });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toMatchObject({
        statusCode: 418,
        code: 'SOME_NEW_CODE',
      });
    });

    it('maps request rate limiting to a 429 error', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: authError('over_request_rate_limit', 429),
      });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toMatchObject({ statusCode: 429 });
    });

    it('defaults a malformed error (no code/status) to 400 SUPABASE_AUTH_ERROR', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { name: 'AuthApiError', message: 'something opaque' },
      });
      await expect(signUpWithEmail({ email: 'u@e.com', password: 'pw' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'SUPABASE_AUTH_ERROR',
      });
    });
  });

  describe('signInWithEmail', () => {
    it('returns the user and session on success', async () => {
      const user = { id: 'u1' };
      const session = { access_token: 'a' };
      mockSignIn.mockResolvedValue({ data: { user, session }, error: null });

      const result = await signInWithEmail('user@example.com', 'strongpass123');

      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'strongpass123',
      });
      expect(result).toEqual({ user, session });
    });

    it('maps invalid_credentials to a 401 UnauthorizedError', async () => {
      mockSignIn.mockResolvedValue({ data: {}, error: authError('invalid_credentials', 400) });
      await expect(signInWithEmail('u@e.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('maps email_not_confirmed to a 403 error', async () => {
      mockSignIn.mockResolvedValue({ data: {}, error: authError('email_not_confirmed', 400) });
      await expect(signInWithEmail('u@e.com', 'pw')).rejects.toMatchObject({
        statusCode: 403,
        code: 'EMAIL_NOT_CONFIRMED',
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('exchanges a refresh token for a fresh session', async () => {
      const user = { id: 'u1' };
      const session = { access_token: 'new-access', refresh_token: 'new-refresh' };
      mockRefreshSession.mockResolvedValue({ data: { user, session }, error: null });

      const result = await refreshAccessToken('old-refresh');

      expect(mockRefreshSession).toHaveBeenCalledWith({ refresh_token: 'old-refresh' });
      expect(result).toEqual({ user, session });
    });

    it('maps a not-found or already-used refresh token to a 401', async () => {
      mockRefreshSession.mockResolvedValue({
        data: {},
        error: authError('refresh_token_not_found', 400),
      });
      await expect(refreshAccessToken('revoked')).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('signOut', () => {
    it('revokes all sessions globally by default', async () => {
      mockAdminSignOut.mockResolvedValue({ data: null, error: null });

      await signOut('access-token-123');

      expect(mockAdminSignOut).toHaveBeenCalledWith('access-token-123', 'global');
    });

    it('throws a mapped error when Supabase reports one', async () => {
      mockAdminSignOut.mockResolvedValue({
        data: null,
        error: authError('session_not_found', 404),
      });
      await expect(signOut('bad-token')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('requestPasswordReset', () => {
    it('asks Supabase to email a recovery code for the address', async () => {
      mockResetForEmail.mockResolvedValue({ data: {}, error: null });

      await requestPasswordReset('user@example.com');

      expect(mockResetForEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('maps email send rate limiting to a 429 error', async () => {
      mockResetForEmail.mockResolvedValue({
        data: {},
        error: authError('over_email_send_rate_limit', 429),
      });
      await expect(requestPasswordReset('user@example.com')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('resetPassword', () => {
    const verified = {
      data: { user: { id: 'u1' }, session: { access_token: 'recovery-token' } },
      error: null,
    };

    it('verifies the code, sets the new password, then revokes all sessions', async () => {
      mockVerifyOtp.mockResolvedValue(verified);
      mockUpdateUserById.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
      mockAdminSignOut.mockResolvedValue({ data: null, error: null });

      await resetPassword('user@example.com', '123456', 'newstrongpass');

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        token: '123456',
        type: 'recovery',
      });
      expect(mockUpdateUserById).toHaveBeenCalledWith('u1', { password: 'newstrongpass' });
      expect(mockAdminSignOut).toHaveBeenCalledWith('recovery-token', 'global');
    });

    it('maps an expired/invalid code to a 400 and never changes the password', async () => {
      mockVerifyOtp.mockResolvedValue({ data: {}, error: authError('otp_expired', 403) });

      await expect(resetPassword('user@example.com', 'bad', 'newstrongpass')).rejects.toMatchObject(
        { statusCode: 400, code: 'OTP_EXPIRED' },
      );
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it('throws a mapped error when the password update is rejected', async () => {
      mockVerifyOtp.mockResolvedValue(verified);
      mockUpdateUserById.mockResolvedValue({ data: {}, error: authError('weak_password', 422) });

      await expect(resetPassword('user@example.com', '123456', 'weak')).rejects.toMatchObject({
        statusCode: 422,
        code: 'WEAK_PASSWORD',
      });
    });
  });
});
