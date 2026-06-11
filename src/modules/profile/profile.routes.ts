import { Router } from 'express';
import { supabaseAuthGuard, optionalSupabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
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

router.get('/search', validateQuery(SearchUsersDto), optionalSupabaseAuthGuard, profileController.searchUsers);
router.get('/suggestions', supabaseAuthGuard, profileController.getSuggestions);
router.get('/blocked', supabaseAuthGuard, profileController.getBlockedUsers);
router.get('/follow-requests', supabaseAuthGuard, profileController.getFollowRequests);

router.put('/update', supabaseAuthGuard, validateBody(UpdateProfileDto), profileController.updateProfile);
router.put('/cover', supabaseAuthGuard, validateBody(UploadCoverDto), profileController.uploadCover);
router.put('/privacy', supabaseAuthGuard, validateBody(UpdatePrivacyDto), profileController.updatePrivacy);
router.put('/intro', supabaseAuthGuard, validateBody(UpdateIntroDto), profileController.updateProfileIntro);

router.put(
  '/follow-requests/:requesterId/accept',
  supabaseAuthGuard,
  profileController.acceptFollowRequest,
);
router.put(
  '/follow-requests/:requesterId/reject',
  supabaseAuthGuard,
  profileController.rejectFollowRequest,
);

router.put('/pin/:postId', supabaseAuthGuard, profileController.pinPost);
router.delete('/pin', supabaseAuthGuard, profileController.unpinPost);
router.delete('/followers/:followerId', supabaseAuthGuard, profileController.removeFollower);

router.get('/:userId', optionalSupabaseAuthGuard, profileController.getProfile);
router.get('/:userId/intro', optionalSupabaseAuthGuard, profileController.getProfileIntro);
router.get('/:userId/posts', optionalSupabaseAuthGuard, profileController.getUserPosts);
router.get('/:userId/videos', optionalSupabaseAuthGuard, profileController.getUserVideos);
router.get('/:userId/followers', optionalSupabaseAuthGuard, profileController.getFollowers);
router.get('/:userId/following', optionalSupabaseAuthGuard, profileController.getFollowing);

router.post('/:userId/follow', supabaseAuthGuard, profileController.followUser);
router.delete('/:userId/follow', supabaseAuthGuard, profileController.unfollowUser);
router.post('/:userId/block', supabaseAuthGuard, profileController.blockUser);
router.delete('/:userId/block', supabaseAuthGuard, profileController.unblockUser);

export { router as profileRouter };
