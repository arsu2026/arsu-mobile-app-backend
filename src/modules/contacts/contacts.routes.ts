import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateBody } from '../../common/middleware/validate.middleware';
import * as contactsController from './contacts.controller';
import { SyncContactsDto } from './dto/sync-contacts.dto';

const router = Router();

/**
 * @openapi
 * /contacts/sync:
 *   post:
 *     tags: [Contacts]
 *     summary: Sync phone contacts and find matching users
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contacts]
 *             properties:
 *               contacts:
 *                 type: array
 *                 maxItems: 1000
 *                 items:
 *                   type: object
 *                   required: [phone]
 *                   properties:
 *                     phone: { type: string }
 *                     name: { type: string }
 *     responses:
 *       '200': { description: Synced contacts with matched users. }
 *       '401': { description: Missing or invalid access token. }
 *       '422': { description: Validation failed. }
 */
router.post('/sync', supabaseAuthGuard, validateBody(SyncContactsDto), contactsController.syncContacts);

export { router as contactsRouter };
