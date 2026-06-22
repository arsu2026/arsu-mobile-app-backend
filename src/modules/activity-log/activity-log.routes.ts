import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import * as activityLogController from './activity-log.controller';

const router = Router();

/**
 * @openapi
 * /activity-log:
 *   get:
 *     tags: [Activity]
 *     summary: List the current user's activity log
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [posts, liked, comments, shares, follows, watched-videos] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       '200': { description: Paginated activity items. }
 *       '401': { description: Missing or invalid access token. }
 */
router.get('/', supabaseAuthGuard, activityLogController.getActivityLog);

export { router as activityLogRouter };
