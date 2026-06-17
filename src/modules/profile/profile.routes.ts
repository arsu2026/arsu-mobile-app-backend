import { Router } from 'express';
import { supabaseAuthGuard, optionalSupabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
import { uploadAvatarImage } from '../../common/middleware/upload.middleware';
import { UpdateIntroDto } from './dto/update-intro.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadCoverDto } from './dto/upload-cover.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import * as profileController from './profile.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Profile Routes — mounted at /api/v1/profile
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// Static routes must be registered before /:userId to avoid collisions.

/**
 * @openapi
 * /profile/search:
 *   get:
 *     tags: [Profile]
 *     summary: Search users by name or username
 *     description: >
 *       Full-text search across usernames and full names. Authentication is
 *       optional — when a Bearer token is supplied, each result is annotated
 *       with the viewer's follow relationship (`isFollowing`).
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *         description: Search term (minimum 2 characters).
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Paginated list of matching users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/BasicUserInfo' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '422':
 *         description: Validation failed (query too short).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/search', validateQuery(SearchUsersDto), optionalSupabaseAuthGuard, profileController.searchUsers);

/**
 * @openapi
 * /profile/suggestions:
 *   get:
 *     tags: [Profile]
 *     summary: Get follow suggestions for the current user
 *     description: >
 *       Returns people the authenticated user may want to follow, ranked by
 *       mutual followers, shared contacts, or location.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of suggested users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/UserSuggestion' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/suggestions', supabaseAuthGuard, profileController.getSuggestions);

/**
 * @openapi
 * /profile/blocked:
 *   get:
 *     tags: [Profile]
 *     summary: List users the current user has blocked
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
 *         description: Paginated list of blocked users.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/BasicUserInfo' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/blocked', supabaseAuthGuard, profileController.getBlockedUsers);

/**
 * @openapi
 * /profile/follow-requests:
 *   get:
 *     tags: [Profile]
 *     summary: List pending follow requests for the current user
 *     description: Only meaningful for private accounts, which gate new followers behind approval.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of pending follow requests.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/FollowRequestView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/follow-requests', supabaseAuthGuard, profileController.getFollowRequests);

/**
 * @openapi
 * /profile/me/heartbeat:
 *   post:
 *     tags: [Profile]
 *     summary: Update the current user's presence (last-active timestamp)
 *     description: >
 *       Stamps `last_active_at = now()` for the authenticated user. The FE pings
 *       this periodically while foregrounded; `isOnline`/`lastSeen` on friend cards
 *       are derived from it.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Presence updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Presence updated' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     lastSeen: { type: string, format: 'date-time' }
 *                     isOnline: { type: boolean, example: true }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/me/heartbeat', supabaseAuthGuard, profileController.heartbeat);

/**
 * @openapi
 * /profile/me:
 *   get:
 *     tags: [Profile]
 *     summary: Get the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', supabaseAuthGuard, profileController.getMyProfile);

/**
 * @openapi
 * /profile/avatar:
 *   post:
 *     tags: [Profile]
 *     summary: Upload the current user's avatar image
 *     security:
 *       - bearerAuth: []
 */
router.post('/avatar', supabaseAuthGuard, uploadAvatarImage, profileController.uploadAvatar);

/**
 * @openapi
 * /profile/update:
 *   put:
 *     tags: [Profile]
 *     summary: Update the current user's profile
 *     description: Partial update — only the fields present in the body are changed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateProfileRequest' }
 *     responses:
 *       '200':
 *         description: Updated profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Profile updated successfully' }
 *                 data: { $ref: '#/components/schemas/ProfileView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: Username already taken.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/update', supabaseAuthGuard, validateBody(UpdateProfileDto), profileController.updateProfile);

/**
 * @openapi
 * /profile/cover:
 *   put:
 *     tags: [Profile]
 *     summary: Update the current user's cover photo
 *     description: Sets the cover photo URL (upload the file elsewhere first, then submit its URL).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UploadCoverRequest' }
 *     responses:
 *       '200':
 *         description: Cover photo updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Cover photo updated successfully' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     coverUrl: { type: string, format: uri }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed (invalid URL).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/cover', supabaseAuthGuard, validateBody(UploadCoverDto), profileController.uploadCover);

/**
 * @openapi
 * /profile/privacy:
 *   put:
 *     tags: [Profile]
 *     summary: Update the current user's privacy settings
 *     description: Partial update — only the fields present in the body are changed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdatePrivacyRequest' }
 *     responses:
 *       '200':
 *         description: Updated privacy settings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Privacy settings updated successfully' }
 *                 data: { $ref: '#/components/schemas/PrivacySettingsView' }
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
 */
router.put('/privacy', supabaseAuthGuard, validateBody(UpdatePrivacyDto), profileController.updatePrivacy);

/**
 * @openapi
 * /profile/intro:
 *   put:
 *     tags: [Profile]
 *     summary: Update the current user's intro (work, education, etc.)
 *     description: Partial update — only the fields present in the body are changed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateIntroRequest' }
 *     responses:
 *       '200':
 *         description: Updated intro.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Profile intro updated successfully' }
 *                 data: { $ref: '#/components/schemas/ProfileIntro' }
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
 */
router.put('/intro', supabaseAuthGuard, validateBody(UpdateIntroDto), profileController.updateProfileIntro);

/**
 * @openapi
 * /profile/follow-requests/{requesterId}/accept:
 *   put:
 *     tags: [Profile]
 *     summary: Accept a pending follow request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The user whose follow request is being accepted.
 *     responses:
 *       '200':
 *         description: Follow request accepted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: No pending request from this user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put(
  '/follow-requests/:requesterId/accept',
  supabaseAuthGuard,
  profileController.acceptFollowRequest,
);

/**
 * @openapi
 * /profile/follow-requests/{requesterId}/reject:
 *   put:
 *     tags: [Profile]
 *     summary: Reject a pending follow request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The user whose follow request is being rejected.
 *     responses:
 *       '200':
 *         description: Follow request rejected.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: No pending request from this user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put(
  '/follow-requests/:requesterId/reject',
  supabaseAuthGuard,
  profileController.rejectFollowRequest,
);

/**
 * @openapi
 * /profile/pin/{postId}:
 *   put:
 *     tags: [Profile]
 *     summary: Pin a post to the current user's profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Post pinned.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Post not found or not owned by the user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.put('/pin/:postId', supabaseAuthGuard, profileController.pinPost);

/**
 * @openapi
 * /profile/pin:
 *   delete:
 *     tags: [Profile]
 *     summary: Unpin the currently pinned post
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Post unpinned.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/pin', supabaseAuthGuard, profileController.unpinPost);

/**
 * @openapi
 * /profile/followers/{followerId}:
 *   delete:
 *     tags: [Profile]
 *     summary: Remove a follower
 *     description: Forcibly removes someone from the current user's followers list.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: followerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Follower removed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/followers/:followerId', supabaseAuthGuard, profileController.removeFollower);

/**
 * @openapi
 * /profile/{userId}:
 *   get:
 *     tags: [Profile]
 *     summary: Get a user's profile
 *     description: >
 *       Returns a user's public profile. Authentication is optional — when a
 *       Bearer token is supplied, viewer-relative fields (`isFollowing`,
 *       `isOwnProfile`, `followStatus`) are populated.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: The requested profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/ProfileView' }
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:userId', optionalSupabaseAuthGuard, profileController.getProfile);

/**
 * @openapi
 * /profile/{userId}/intro:
 *   get:
 *     tags: [Profile]
 *     summary: Get a user's intro section
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: The user's intro.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/ProfileIntro' }
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:userId/intro', optionalSupabaseAuthGuard, profileController.getProfileIntro);

/**
 * @openapi
 * /profile/{userId}/posts:
 *   get:
 *     tags: [Profile]
 *     summary: List a user's posts
 *     description: Visibility is filtered by the viewer's relationship to the author.
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: Paginated list of posts.
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
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:userId/posts', optionalSupabaseAuthGuard, profileController.getUserPosts);

/**
 * @openapi
 * /profile/{userId}/videos:
 *   get:
 *     tags: [Profile]
 *     summary: List a user's videos
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: Paginated list of video posts.
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
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:userId/videos', optionalSupabaseAuthGuard, profileController.getUserVideos);

/**
 * @openapi
 * /profile/{userId}/followers:
 *   get:
 *     tags: [Profile]
 *     summary: List a user's followers
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: Paginated list of followers.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/BasicUserInfo' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:userId/followers', optionalSupabaseAuthGuard, profileController.getFollowers);

/**
 * @openapi
 * /profile/{userId}/following:
 *   get:
 *     tags: [Profile]
 *     summary: List the accounts a user follows
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: Paginated list of followed accounts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/BasicUserInfo' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:userId/following', optionalSupabaseAuthGuard, profileController.getFollowing);

/**
 * @openapi
 * /profile/{userId}/follow:
 *   post:
 *     tags: [Profile]
 *     summary: Follow a user
 *     description: >
 *       Follows the target user. For public accounts the follow takes effect
 *       immediately; for private accounts a pending follow request is created.
 *       The response `message` reflects which happened.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '201':
 *         description: Now following, or a follow request was created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/:userId/follow', supabaseAuthGuard, profileController.followUser);

/**
 * @openapi
 * /profile/{userId}/follow:
 *   delete:
 *     tags: [Profile]
 *     summary: Unfollow a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Unfollowed successfully.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/:userId/follow', supabaseAuthGuard, profileController.unfollowUser);

/**
 * @openapi
 * /profile/{userId}/block:
 *   post:
 *     tags: [Profile]
 *     summary: Block a user
 *     description: Blocking also removes any existing follow relationship in both directions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '201':
 *         description: User blocked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/:userId/block', supabaseAuthGuard, profileController.blockUser);

/**
 * @openapi
 * /profile/{userId}/block:
 *   delete:
 *     tags: [Profile]
 *     summary: Unblock a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: User unblocked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/:userId/block', supabaseAuthGuard, profileController.unblockUser);

export { router as profileRouter };
