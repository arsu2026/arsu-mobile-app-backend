import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabaseClient, supabaseAdmin } from '../../config/supabase.config';
import { AppError, ConflictError, UnauthorizedError } from '../../common/errors';
import { joinFullName } from '../../common/utils/display-mapper.util';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — business logic for Supabase email authentication
// ─────────────────────────────────────────────────────────────────────────────
// Auth is fully delegated to Supabase. Public flows (signup, login) use the
// anon client; privileged session revocation (logout) uses the admin client.
// This layer translates Supabase's AuthError shape into the app's AppError
// hierarchy so the central error handler can render consistent responses.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthResult {
  user: User | null;
  session: Session | null;
}

export interface SignupInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  gender?: import('@prisma/client').Gender;
}

/**
 * Map a Supabase AuthError onto the app's operational error hierarchy.
 * Falls back to a generic AppError carrying Supabase's own status + code.
 */
function mapAuthError(error: AuthError): AppError {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return new ConflictError('An account with this email already exists');
    case 'invalid_credentials':
      return new UnauthorizedError('Invalid email or password');
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return new UnauthorizedError('Your session has expired. Please log in again.');
    case 'email_not_confirmed':
      return new AppError('Email address has not been confirmed yet', 403, 'EMAIL_NOT_CONFIRMED');
    case 'weak_password':
      return new AppError(error.message, 422, 'WEAK_PASSWORD');
    case 'otp_expired':
      return new AppError(
        'The reset code is invalid or has expired. Please request a new one.',
        400,
        'OTP_EXPIRED',
      );
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AppError(error.message, 429, 'RATE_LIMITED');
    default:
      return new AppError(
        error.message,
        error.status ?? 400,
        error.code ? error.code.toUpperCase() : 'SUPABASE_AUTH_ERROR',
      );
  }
}

/**
 * Register a new user with email + password.
 *
 * When email confirmation is enabled on the Supabase project (the hosted
 * default), `session` is null and the user must confirm via the emailed link
 * before logging in. When it is disabled, a session is returned immediately.
 */
export async function signUpWithEmail(input: SignupInput): Promise<AuthResult> {
  const fullName = joinFullName(input.firstName, input.lastName);
  const { data, error } = await supabaseClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        ...(fullName && { full_name: fullName }),
      },
    },
  });
  if (error) throw mapAuthError(error);
  return { user: data.user, session: data.session };
}

/**
 * Authenticate a user with email + password and return a Supabase session.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw mapAuthError(error);
  return { user: data.user, session: data.session };
}

/**
 * Revoke the user's session(s) server-side.
 *
 * `scope: 'global'` revokes every refresh token for the user, fully logging
 * them out across devices. Note: the supplied access token itself stays valid
 * until its `exp`; keep access-token lifetimes short for prompt revocation.
 */
export async function signOut(accessToken: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, 'global');
  if (error) throw mapAuthError(error);
}

/**
 * Send a password-reset email containing a recovery code.
 *
 * Supabase emails a 6-digit OTP when the project's "Reset Password" template
 * renders `{{ .Token }}`. It returns success even for addresses with no account,
 * so callers can respond with a generic message without revealing whether the
 * email is registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) throw mapAuthError(error);
}

/**
 * Complete a password reset using the emailed recovery code.
 *
 * Verifying the OTP proves the caller owns the address; the new password is then
 * set with the admin client (our shared clients are stateless, so there is no
 * recovery session to hold). Finally every session is revoked, so changing the
 * password forces a fresh login on all devices.
 */
export async function resetPassword(email: string, token: string, password: string): Promise<void> {
  const { data, error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) throw mapAuthError(error);
  if (!data.user || !data.session) {
    throw new UnauthorizedError('Could not verify the reset code');
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    password,
  });
  if (updateError) throw mapAuthError(updateError);

  await signOut(data.session.access_token);
}

/**
 * Exchange a refresh token for a fresh session.
 *
 * Access tokens are short-lived; the client trades its long-lived refresh token
 * for a new access/refresh pair. Supabase rotates refresh tokens, so the client
 * must replace its stored token with the one in the returned session. A missing,
 * expired, or already-used token surfaces as 401 — the client should send the
 * user back to login.
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  const { data, error } = await supabaseClient.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error) throw mapAuthError(error);
  return { user: data.user, session: data.session };
}
