import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateBody } from '../../common/middleware/validate.middleware';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePhoneDto } from './dto/change-phone.dto';
import { UpdateMessagePrivacyDto } from './dto/update-message-privacy.dto';
import { UpdatePostPrivacyDto } from './dto/update-post-privacy.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';
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

export { router as settingsRouter };
