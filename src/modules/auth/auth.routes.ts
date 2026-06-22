import { Router } from 'express';
import { validateBody } from '../../common/middleware/validate.middleware';
import { supabaseAuthGuard } from '../../common/guards';
import { EmailSignupDto } from './dto/email-signup.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as authController from './auth.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Routes — mounted at /api/v1/auth
// ─────────────────────────────────────────────────────────────────────────────
// Email + password authentication backed by Supabase Auth. The `email` path
// segment leaves room for sibling channels (e.g. /users/phone/..., OTP, MFA)
// to be added later without breaking existing clients.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * @openapi
 * /auth/users/email/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user with email and password
 *     description: >
 *       Creates a new user account in Supabase Auth using an email address and
 *       password. If email confirmation is enabled on the project (the hosted
 *       default), the response contains the created user but a `null` session —
 *       the user must click the confirmation link emailed to them before they
 *       can log in. If email confirmation is disabled, an active session
 *       (access + refresh tokens) is returned immediately.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailSignupRequest'
 *     responses:
 *       '201':
 *         description: Account created. Session is present only when email confirmation is disabled.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       '409':
 *         description: An account with this email already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Validation failed (invalid email, weak/short password).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/users/email/signup', validateBody(EmailSignupDto), authController.emailSignup);

/**
 * @openapi
 * /auth/users/email/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: >
 *       Authenticates an existing user against Supabase Auth with their email
 *       and password. On success, returns the user profile together with an
 *       active session containing a short-lived `access_token` and a
 *       `refresh_token`. Send the access token as a `Bearer` token on
 *       subsequent authenticated requests.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailLoginRequest'
 *     responses:
 *       '200':
 *         description: Authenticated successfully; session returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       '401':
 *         description: Invalid email or password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Email address has not been confirmed yet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Validation failed (missing email or password).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/users/email/login', validateBody(EmailLoginDto), authController.emailLogin);

/**
 * @openapi
 * /auth/users/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out the current user
 *     description: >
 *       Revokes the authenticated user's Supabase session(s). Requires a valid
 *       `Bearer` access token in the `Authorization` header. Uses the `global`
 *       scope, so every refresh token for the user is revoked across all
 *       devices. Note that the access token presented here remains valid until
 *       its own expiry (`exp`); keep access-token lifetimes short for prompt
 *       revocation.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Session revoked successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       '401':
 *         description: Missing, malformed, invalid, or expired access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/users/logout', supabaseAuthGuard, authController.logout);

/**
 * @openapi
 * /auth/users/email/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password-reset code by email
 *     description: >
 *       Sends a password-reset email containing a 6-digit recovery code (the
 *       project's "Reset Password" email template must render `{{ .Token }}`).
 *       To avoid revealing whether an email is registered, this endpoint always
 *       responds `200` with a generic message regardless of whether the account
 *       exists.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       '200':
 *         description: If the account exists, a reset code has been emailed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       '422':
 *         description: Validation failed (invalid email).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: Too many reset emails requested; try again later.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/users/email/forgot-password',
  validateBody(ForgotPasswordDto),
  authController.forgotPassword,
);

/**
 * @openapi
 * /auth/users/email/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset the password using an emailed recovery code
 *     description: >
 *       Completes a password reset. The `token` is the 6-digit recovery code
 *       from the forgot-password email. On success the new password is set and
 *       every existing session is revoked, so the user must log in again with
 *       the new password — no session is returned.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       '200':
 *         description: Password reset successfully; log in with the new password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       '400':
 *         description: The recovery code is invalid or has expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Validation failed (invalid email, missing code, weak/short password).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/users/email/reset-password',
  validateBody(ResetPasswordDto),
  authController.resetPassword,
);

/**
 * @openapi
 * /auth/users/token/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a fresh session
 *     description: >
 *       Access tokens are short-lived. When one expires, send the `refresh_token`
 *       from the last session to receive a new access + refresh token pair.
 *       Supabase rotates refresh tokens, so the client must replace its stored
 *       token with the one in the returned session. A missing, expired, or
 *       already-used refresh token returns `401` — the client should send the
 *       user back to login.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       '200':
 *         description: Session refreshed; a new access + refresh token pair is returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       '401':
 *         description: The refresh token is missing, expired, or already used.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Validation failed (missing refresh token).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/users/token/refresh', validateBody(RefreshTokenDto), authController.refreshToken);

export { router as authRouter };
