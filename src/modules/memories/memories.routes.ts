import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateQuery } from '../../common/middleware/validate.middleware';
import * as memoriesController from './memories.controller';
import { MemoriesQueryDto } from './dto/memories-query.dto';

const router = Router();

/**
 * @openapi
 * /memories:
 *   get:
 *     tags: [Memories]
 *     summary: List the user's "on this day" memories
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: '06-17' }
 *         description: MM-DD; defaults to today (UTC).
 *     responses:
 *       '200': { description: List of past posts from this calendar day. }
 *       '401': { description: Missing or invalid access token. }
 *       '422': { description: date is not a valid MM-DD. }
 */
router.get('/', supabaseAuthGuard, validateQuery(MemoriesQueryDto), memoriesController.getMemories);

export { router as memoriesRouter };
