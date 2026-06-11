import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/response.util';
import { UnauthorizedError } from '../../common/errors';
import {
  refreshAccessToken,
  requestPasswordReset,
  resetPassword as resetUserPassword,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './auth.service';
import type { EmailSignupDto } from './dto/email-signup.dto';
import type { EmailLoginDto } from './dto/email-login.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Controller — thin HTTP layer over the auth service.
// ─────────────────────────────────────────────────────────────────────────────
// Handlers are async and simply throw on failure; Express 5 forwards rejected
// promises to the central error handler, so no try/catch is needed here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/users/email/signup
 *
 * The success message adapts to the project's email-confirmation setting: with
 * confirmation enabled, Supabase returns no session and the user must confirm
 * via email first; with it disabled, an active session is returned immediately.
 */
export async function emailSignup(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as EmailSignupDto;
  const result = await signUpWithEmail(email, password);

  const message = result.session
    ? 'Account created successfully.'
    : 'Account created. Check your email to confirm your address before logging in.';

  sendSuccess(res, result, { statusCode: 201, message });
}

/**
 * POST /auth/users/email/login
 */
export async function emailLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as EmailLoginDto;
  const result = await signInWithEmail(email, password);

  sendSuccess(res, result, { message: 'Logged in successfully.' });
}

/**
 * POST /auth/users/logout
 *
 * Requires the supabaseAuthGuard upstream, which verifies the Bearer token and
 * stashes the raw JWT on req.accessToken — needed to revoke the session.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const accessToken = req.accessToken;
  if (!accessToken) {
    throw new UnauthorizedError('Authentication required');
  }

  await signOut(accessToken);

  sendSuccess(res, null, { message: 'Logged out successfully' });
}

/**
 * POST /auth/users/email/forgot-password
 *
 * Always responds 200 with a generic message: Supabase returns success even for
 * unregistered emails, so the response must not reveal whether the account exists.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordDto;
  await requestPasswordReset(email);

  sendSuccess(res, null, {
    message: 'If an account exists for that email, a password reset code has been sent.',
  });
}

/**
 * POST /auth/users/email/reset-password
 *
 * Verifies the emailed recovery code, sets the new password, and revokes every
 * session — so the user must log in again with their new password.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { email, token, password } = req.body as ResetPasswordDto;
  await resetUserPassword(email, token, password);

  sendSuccess(res, null, {
    message: 'Password reset successfully. Please log in with your new password.',
  });
}

/**
 * POST /auth/users/token/refresh
 *
 * Exchanges a refresh token for a fresh session so a client can stay logged in
 * past the access token's short lifetime without re-entering credentials.
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body as RefreshTokenDto;
  const result = await refreshAccessToken(refresh_token);

  sendSuccess(res, result, { message: 'Session refreshed successfully.' });
}
