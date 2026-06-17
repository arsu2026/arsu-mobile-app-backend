import { Router } from 'express';
import { supabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
import * as savedController from './saved.controller';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateSavedItemDto } from './dto/create-saved-item.dto';
import { ListSavedDto } from './dto/list-saved.dto';

const router = Router();

/**
 * @openapi
 * /saved/collections:
 *   post:
 *     tags: [Saved]
 *     summary: Create a saved-items collection
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       '201': { description: Collection created. }
 *       '401': { description: Missing or invalid access token. }
 *       '409': { description: A collection with this name already exists. }
 *       '422': { description: Validation failed. }
 *   get:
 *     tags: [Saved]
 *     summary: List the current user's collections
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Collections with item counts. }
 *       '401': { description: Missing or invalid access token. }
 */
router.post('/collections', supabaseAuthGuard, validateBody(CreateCollectionDto), savedController.createCollection);
router.get('/collections', supabaseAuthGuard, savedController.listCollections);

/**
 * @openapi
 * /saved:
 *   post:
 *     tags: [Saved]
 *     summary: Save a post, video, or link
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [POST, VIDEO, LINK] }
 *               postId: { type: string, format: uuid }
 *               linkUrl: { type: string, format: uri }
 *               linkTitle: { type: string }
 *               linkThumbnailUrl: { type: string, format: uri }
 *               collectionId: { type: string, format: uuid }
 *     responses:
 *       '201': { description: Item saved. }
 *       '401': { description: Missing or invalid access token. }
 *       '404': { description: Post or collection not found. }
 *       '409': { description: Post already saved. }
 *       '422': { description: Validation failed. }
 *   get:
 *     tags: [Saved]
 *     summary: List saved items
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [post, video, link] }
 *       - in: query
 *         name: collection
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       '200': { description: Paginated saved items. }
 *       '401': { description: Missing or invalid access token. }
 */
router.post('/', supabaseAuthGuard, validateBody(CreateSavedItemDto), savedController.createSavedItem);
router.get('/', supabaseAuthGuard, validateQuery(ListSavedDto), savedController.listSavedItems);

/**
 * @openapi
 * /saved/{id}:
 *   delete:
 *     tags: [Saved]
 *     summary: Remove a saved item
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200': { description: Saved item removed. }
 *       '401': { description: Missing or invalid access token. }
 *       '404': { description: Saved item not found. }
 */
router.delete('/:id', supabaseAuthGuard, savedController.deleteSavedItem);

export { router as savedRouter };
