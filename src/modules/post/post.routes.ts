import { Router } from 'express';
import { optionalSupabaseAuthGuard, supabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
import { uploadPostImages } from '../../common/middleware/upload.middleware';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import * as postController from './post.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Post Routes — mounted at /api/v1/posts
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * @openapi
 * /posts:
 *   post:
 *     tags: [Post]
 *     summary: Create a post (text and/or photos)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/CreatePostRequest' }
 *     responses:
 *       '201':
 *         description: Post created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Post created successfully' }
 *                 data: { $ref: '#/components/schemas/PostView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   get:
 *     tags: [Post]
 *     summary: List a user's posts (viewer-aware, paginated)
 *     description: Authentication is optional; supplying a token reveals follower-only posts you may see.
 *     parameters:
 *       - in: query
 *         name: authorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: The author's visible posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PostView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '422':
 *         description: Validation failed (missing or invalid authorId).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/', supabaseAuthGuard, uploadPostImages, validateBody(CreatePostDto), postController.createPost);
router.get('/', validateQuery(ListPostsDto), optionalSupabaseAuthGuard, postController.listPosts);

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     tags: [Post]
 *     summary: Get a single post (viewer-aware)
 *     description: Authentication is optional. Posts hidden from the viewer return 404.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: The post.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/PostView' }
 *       '404':
 *         description: Post not found or not visible.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   patch:
 *     tags: [Post]
 *     summary: Edit a post (text / privacy / category)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdatePostRequest' }
 *     responses:
 *       '200':
 *         description: Post updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Post updated successfully' }
 *                 data: { $ref: '#/components/schemas/PostView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '403':
 *         description: Not the post owner.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Post not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   delete:
 *     tags: [Post]
 *     summary: Delete a post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Post deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '403':
 *         description: Not the post owner.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Post not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', optionalSupabaseAuthGuard, postController.getPost);
router.patch('/:id', supabaseAuthGuard, validateBody(UpdatePostDto), postController.updatePost);
router.delete('/:id', supabaseAuthGuard, postController.deletePost);

export { router as postRouter };
