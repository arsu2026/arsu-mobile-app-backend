import { Router } from 'express';
import { requireAdmin } from '../../../common/guards';
import { validateBody } from '../../../common/middleware/validate.middleware';
import * as adminAuthController from './admin-auth.controller';
import { LoginDto } from './dto/login.dto';

const router = Router();

/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     tags: [Admin · Auth]
 *     summary: Log in to the admin panel with email and password
 *     description: >
 *       Authenticates an AdminUser (a dedicated admin identity, separate from
 *       end-user Supabase auth) and returns an admin JWT signed with
 *       `ADMIN_JWT_SECRET`. Send that token as a `Bearer` token on subsequent
 *       admin requests. Unknown email and wrong password both return `401` with
 *       an identical message to avoid revealing which admin accounts exist. A
 *       successful login is recorded in the admin audit log.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *     responses:
 *       '200':
 *         description: Authenticated successfully; admin JWT and identity returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLoginResponse'
 *       '401':
 *         description: Invalid email or password.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: The admin account is suspended.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Validation failed (invalid email, or password shorter than 8 characters).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', validateBody(LoginDto), adminAuthController.login);
/**
 * @openapi
 * /admin/auth/me:
 *   get:
 *     tags: [Admin · Auth]
 *     summary: Get the currently authenticated admin
 *     description: >
 *       Returns the admin identity for the supplied admin JWT. The token is
 *       verified and the AdminUser is re-loaded fresh from the database on every
 *       call, so a suspension takes effect immediately (before token expiry).
 *       Used by the admin panel to validate a persisted session on load.
 *     security:
 *       - adminBearerAuth: []
 *     responses:
 *       '200':
 *         description: The authenticated admin's identity.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminMeResponse'
 *       '401':
 *         description: Missing, malformed, invalid, or expired admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: The admin account is suspended.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', requireAdmin, adminAuthController.me);
/**
 * @openapi
 * /admin/auth/logout:
 *   post:
 *     tags: [Admin · Auth]
 *     summary: Log out of the admin panel
 *     description: >
 *       Records a logout in the admin audit log. Admin JWTs are stateless, so the
 *       presented token remains valid until its own expiry (`exp`); the panel
 *       discards it client-side. Keep admin token lifetimes short for prompt
 *       de-authorisation.
 *     security:
 *       - adminBearerAuth: []
 *     responses:
 *       '200':
 *         description: Logout recorded; discard the token client-side.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLogoutResponse'
 *       '401':
 *         description: Missing, malformed, invalid, or expired admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: The admin account is suspended.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', requireAdmin, adminAuthController.logout);

export { router as adminAuthRouter };
