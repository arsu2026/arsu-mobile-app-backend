import { Router } from 'express';
import { supabaseAuthGuard, optionalSupabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
import { ExploreQueryDto } from './dto/explore-query.dto';
import { HashtagFeedDto } from './dto/hashtag-feed.dto';
import { SaveSearchHistoryDto } from './dto/save-search-history.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UnifiedSearchDto } from './dto/unified-search.dto';
import * as searchController from './search.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Search Routes — mounted at /api/v1/search
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * @openapi
 * /search/posts:
 *   get:
 *     tags: [Search]
 *     summary: Search posts
 *     description: Authentication is optional; supplying a token filters results by visibility.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Matching posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     query: { type: string }
 *                     posts:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SearchPostView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '422':
 *         description: Validation failed (query too short).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/posts', validateQuery(SearchQueryDto), optionalSupabaseAuthGuard, searchController.searchPosts);

/**
 * @openapi
 * /search/videos:
 *   get:
 *     tags: [Search]
 *     summary: Search videos
 *     description: Authentication is optional; supplying a token filters results by visibility.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Matching videos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     query: { type: string }
 *                     videos:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SearchPostView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '422':
 *         description: Validation failed (query too short).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/videos', validateQuery(SearchQueryDto), optionalSupabaseAuthGuard, searchController.searchVideos);

/**
 * @openapi
 * /search/hashtags:
 *   get:
 *     tags: [Search]
 *     summary: Search hashtags
 *     description: Public endpoint — no authentication required.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *     responses:
 *       '200':
 *         description: Matching hashtags.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     query: { type: string }
 *                     hashtags:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/HashtagView' }
 *       '422':
 *         description: Validation failed (query too short).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/hashtags', validateQuery(SearchQueryDto), searchController.searchHashtags);

/**
 * @openapi
 * /search/explore:
 *   get:
 *     tags: [Search]
 *     summary: Get the explore / trending feed
 *     description: >
 *       Returns trending content, optionally filtered by category. Authentication
 *       is optional and personalizes ranking when present.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { $ref: '#/components/schemas/ExploreCategory' }
 *         description: Optional category filter (case-insensitive).
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: The explore feed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     feed:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ExploreItemView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '422':
 *         description: Validation failed (invalid category).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/explore', validateQuery(ExploreQueryDto), optionalSupabaseAuthGuard, searchController.getExploreFeed);

/**
 * @openapi
 * /search/history:
 *   get:
 *     tags: [Search]
 *     summary: Get the current user's search history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of recent searches.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SearchHistoryView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     tags: [Search]
 *     summary: Save a search to history
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SaveSearchHistoryRequest' }
 *     responses:
 *       '201':
 *         description: Search saved to history.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Search saved to history' }
 *                 data: { $ref: '#/components/schemas/SearchHistoryView' }
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
 *   delete:
 *     tags: [Search]
 *     summary: Clear the current user's entire search history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Search history cleared.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/history', supabaseAuthGuard, searchController.getSearchHistory);
router.post('/history', supabaseAuthGuard, validateBody(SaveSearchHistoryDto), searchController.saveSearchHistory);
router.delete('/history', supabaseAuthGuard, searchController.clearSearchHistory);

/**
 * @openapi
 * /search/history/{searchId}:
 *   delete:
 *     tags: [Search]
 *     summary: Delete a single search-history entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Entry deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Entry not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/history/:searchId', supabaseAuthGuard, searchController.deleteSearchHistoryItem);

/**
 * @openapi
 * /search/hashtags/{tag}/feed:
 *   get:
 *     tags: [Search]
 *     summary: Get the post feed for a hashtag
 *     description: Authentication is optional and filters results by visibility when present.
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema: { type: string }
 *         description: The hashtag name, without the leading '#'.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: The hashtag and its associated posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     hashtag: { $ref: '#/components/schemas/HashtagView' }
 *                     feed:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SearchPostView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '404':
 *         description: Hashtag not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get(
  '/hashtags/:tag/feed',
  validateQuery(HashtagFeedDto),
  optionalSupabaseAuthGuard,
  searchController.getHashtagFeed,
);

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Unified search across all content types
 *     description: >
 *       Searches users, posts, videos, shorts, and hashtags in one call.
 *       Use the `type` filter to narrow the search to a single content type.
 *       Authentication is optional and filters results by visibility when present.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *       - in: query
 *         name: type
 *         schema: { $ref: '#/components/schemas/SearchType' }
 *         description: Optional content-type filter (case-insensitive). Defaults to ALL.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Unified search results grouped by content type.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/UnifiedSearchResult' }
 *       '422':
 *         description: Validation failed (query too short or invalid type).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/', validateQuery(UnifiedSearchDto), optionalSupabaseAuthGuard, searchController.unifiedSearch);

export { router as searchRouter };
