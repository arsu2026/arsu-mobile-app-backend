import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateBody } from '../../common/middleware/validate.middleware';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePhoneDto } from './dto/change-phone.dto';
import { UpdateMessagePrivacyDto } from './dto/update-message-privacy.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdatePostPrivacyDto } from './dto/update-post-privacy.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { DisableTwoFactorDto } from './dto/disable-two-factor.dto';
import { UpdateLoginAlertsDto } from './dto/update-login-alerts.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import * as settingsController from './settings.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Settings Routes — mounted at /api/v1/settings
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * @openapi
 * /settings/password:
 *   put:
 *     tags: [Settings]
 *     summary: Change the account password
 *     description: Requires the current password for re-authentication before setting the new one.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChangePasswordRequest' }
 *     responses:
 *       '200':
 *         description: Password changed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing/invalid access token, or the current password is wrong.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/password', supabaseAuthGuard, validateBody(ChangePasswordDto), settingsController.changePassword);

/**
 * @openapi
 * /settings/email:
 *   put:
 *     tags: [Settings]
 *     summary: Request an email-address change
 *     description: >
 *       Starts the email-change flow by sending a 6-digit verification code to
 *       the new address. The change is not applied until confirmed via
 *       `PUT /settings/email/verify`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChangeEmailRequest' }
 *     responses:
 *       '200':
 *         description: Verification code sent to the new email address.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Verification code sent to the new email' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *                     pendingEmail: { type: string, format: email }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: The new email is already in use.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (invalid email).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/email', supabaseAuthGuard, validateBody(ChangeEmailDto), settingsController.changeEmail);

/**
 * @openapi
 * /settings/email/verify:
 *   put:
 *     tags: [Settings]
 *     summary: Confirm a pending email change
 *     description: Completes the email change using the 6-digit code sent to the new address.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VerifyOtpRequest' }
 *     responses:
 *       '200':
 *         description: Email address updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '400':
 *         description: The verification code is invalid or has expired.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (code must be 6 digits).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/email/verify', supabaseAuthGuard, validateBody(VerifyEmailChangeDto), settingsController.verifyEmailChange);

/**
 * @openapi
 * /settings/phone:
 *   put:
 *     tags: [Settings]
 *     summary: Request a phone-number change
 *     description: >
 *       Starts the phone-change flow by sending a 6-digit verification code to
 *       the new number. The change is not applied until confirmed via
 *       `PUT /settings/phone/verify`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChangePhoneRequest' }
 *     responses:
 *       '200':
 *         description: Verification code sent to the new phone number.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Verification code sent to the new phone' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *                     pendingPhone: { type: string }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (invalid phone number).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/phone', supabaseAuthGuard, validateBody(ChangePhoneDto), settingsController.changePhone);

/**
 * @openapi
 * /settings/phone/verify:
 *   put:
 *     tags: [Settings]
 *     summary: Confirm a pending phone change
 *     description: Completes the phone change using the 6-digit code sent to the new number.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VerifyOtpRequest' }
 *     responses:
 *       '200':
 *         description: Phone number updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '400':
 *         description: The verification code is invalid or has expired.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (code must be 6 digits).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/phone/verify', supabaseAuthGuard, validateBody(VerifyEmailChangeDto), settingsController.verifyPhoneChange);

/**
 * @openapi
 * /settings/account:
 *   get:
 *     tags: [Settings]
 *     summary: Get account information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Account info.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/AccountInfoView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/account', supabaseAuthGuard, settingsController.getAccountInfo);

/**
 * @openapi
 * /settings/security:
 *   get:
 *     tags: [Settings]
 *     summary: Get a security overview
 *     description: Includes 2FA status, active session count, and last-login details.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Security overview.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/SecurityOverviewView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/security', supabaseAuthGuard, settingsController.getSecurityOverview);

/**
 * @openapi
 * /settings/privacy:
 *   get:
 *     tags: [Settings]
 *     summary: Get privacy settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current privacy settings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/PrivacySettingsView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/privacy', supabaseAuthGuard, settingsController.getPrivacySettings);

/**
 * @openapi
 * /settings/privacy/posts:
 *   put:
 *     tags: [Settings]
 *     summary: Update the default post visibility
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdatePostPrivacyRequest' }
 *     responses:
 *       '200':
 *         description: Updated privacy settings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Default post visibility updated' }
 *                 data: { $ref: '#/components/schemas/PrivacySettingsView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (invalid visibility level).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/privacy/posts', supabaseAuthGuard, validateBody(UpdatePostPrivacyDto), settingsController.updatePostDefaultVisibility);

/**
 * @openapi
 * /settings/privacy/messages:
 *   put:
 *     tags: [Settings]
 *     summary: Update who can send direct messages
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateMessagePrivacyRequest' }
 *     responses:
 *       '200':
 *         description: Updated privacy settings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Message privacy updated' }
 *                 data: { $ref: '#/components/schemas/PrivacySettingsView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (invalid message permission).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/privacy/messages', supabaseAuthGuard, validateBody(UpdateMessagePrivacyDto), settingsController.updateMessagePrivacy);

/**
 * @openapi
 * /settings/sessions:
 *   get:
 *     tags: [Settings]
 *     summary: List active sessions
 *     description: Returns every active session for the account; the current session is flagged.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of active sessions.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SessionView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/sessions', supabaseAuthGuard, settingsController.getActiveSessions);

/**
 * @openapi
 * /settings/sessions/{sessionId}:
 *   delete:
 *     tags: [Settings]
 *     summary: Revoke a session
 *     description: Signs out a specific device by revoking its session.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Session revoked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Session not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/sessions/:sessionId', supabaseAuthGuard, settingsController.revokeSession);

/**
 * @openapi
 * /settings/notifications:
 *   get:
 *     tags: [Settings]
 *     summary: Get notification preferences
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Current notification preferences and channels. }
 *       '401': { description: Missing or invalid access token. }
 *   put:
 *     tags: [Settings]
 *     summary: Update notification preferences
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences: { type: object }
 *               channels: { type: object }
 *     responses:
 *       '200': { description: Updated notification preferences. }
 *       '401': { description: Missing or invalid access token. }
 *       '422': { description: Validation failed. }
 */
router.get('/notifications', supabaseAuthGuard, settingsController.getNotificationPreferences);
router.put(
  '/notifications',
  supabaseAuthGuard,
  validateBody(UpdateNotificationPreferencesDto),
  settingsController.updateNotificationPreferences,
);

/**
 * @openapi
 * /settings/two-factor/enable:
 *   post:
 *     tags: [Settings]
 *     summary: Begin SMS two-factor enrollment (sends a code to the verified phone)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Verification code sent. }
 *       '400': { description: No verified phone on file. }
 *       '401': { description: Missing or invalid access token. }
 *       '409': { description: Two-factor is already enabled. }
 */
router.post('/two-factor/enable', supabaseAuthGuard, settingsController.enableTwoFactor);

/**
 * @openapi
 * /settings/two-factor/verify:
 *   post:
 *     tags: [Settings]
 *     summary: Confirm SMS two-factor enrollment
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Two-factor enabled. }
 *       '400': { description: Invalid or expired code. }
 *       '401': { description: Missing or invalid access token. }
 *       '422': { description: Validation failed. }
 */
router.post('/two-factor/verify', supabaseAuthGuard, validateBody(VerifyTwoFactorDto), settingsController.verifyTwoFactor);

/**
 * @openapi
 * /settings/two-factor:
 *   delete:
 *     tags: [Settings]
 *     summary: Disable two-factor authentication (requires password)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Two-factor disabled. }
 *       '401': { description: Missing token or incorrect password. }
 *       '422': { description: Validation failed. }
 */
router.delete('/two-factor', supabaseAuthGuard, validateBody(DisableTwoFactorDto), settingsController.disableTwoFactor);

/**
 * @openapi
 * /settings/login-alerts:
 *   get:
 *     tags: [Settings]
 *     summary: Get login-alert preference and recent logins
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Login-alert flag and recent sessions. }
 *       '401': { description: Missing or invalid access token. }
 *   put:
 *     tags: [Settings]
 *     summary: Toggle login alerts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Updated flag. }
 *       '401': { description: Missing or invalid access token. }
 *       '422': { description: Validation failed. }
 */
router.get('/login-alerts', supabaseAuthGuard, settingsController.getLoginAlerts);
router.put('/login-alerts', supabaseAuthGuard, validateBody(UpdateLoginAlertsDto), settingsController.updateLoginAlerts);

/**
 * @openapi
 * /settings/account:
 *   delete:
 *     tags: [Settings]
 *     summary: Schedule account deletion (soft delete, 30-day grace)
 *     description: Requires the current password. Bans the auth user and marks the profile for purge after 30 days.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Account scheduled for deletion. }
 *       '401': { description: Missing token or incorrect password. }
 *       '422': { description: Validation failed. }
 */
router.delete('/account', supabaseAuthGuard, validateBody(DeleteAccountDto), settingsController.deleteAccount);

export { router as settingsRouter };
