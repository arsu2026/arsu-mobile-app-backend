import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import * as notificationController from './notification.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Routes — mounted at /api/v1/notifications
// ─────────────────────────────────────────────────────────────────────────────
// Every route is authenticated and scoped to the current user as the recipient.
// Static routes are registered before /:id to avoid collisions.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications
 *     description: Returns the authenticated user's notifications, newest first, paginated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Paginated list of notifications.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/NotificationView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/', supabaseAuthGuard, notificationController.getNotifications);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the current user's unread notification count
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Unread count.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer, example: 3 }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/unread-count', supabaseAuthGuard, notificationController.getUnreadCount);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all of the current user's notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: All notifications marked as read.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch('/read-all', supabaseAuthGuard, notificationController.markAllAsRead);

/**
 * @openapi
 * /notifications:
 *   delete:
 *     tags: [Notifications]
 *     summary: Clear all of the current user's notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: All notifications cleared.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/', supabaseAuthGuard, notificationController.clearAll);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: The updated notification.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/NotificationView' }
 *       '400':
 *         description: Malformed notification id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Notification not found (or not the caller's).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch('/:id/read', supabaseAuthGuard, notificationController.markAsRead);

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a single notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Notification deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '400':
 *         description: Malformed notification id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Notification not found (or not the caller's).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/:id', supabaseAuthGuard, notificationController.deleteNotification);

export { router as notificationRouter };
