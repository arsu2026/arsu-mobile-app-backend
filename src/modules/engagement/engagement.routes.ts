import { Router } from 'express';
import { optionalSupabaseAuthGuard, supabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListLikesDto } from './dto/list-likes.dto';
import * as engagementController from './engagement.controller';

const router = Router({ mergeParams: true });

router.post('/:postId/like', supabaseAuthGuard, engagementController.likePost);
router.delete('/:postId/like', supabaseAuthGuard, engagementController.unlikePost);
router.get(
  '/:postId/likes',
  validateQuery(ListLikesDto),
  optionalSupabaseAuthGuard,
  engagementController.getPostLikes,
);
router.get('/:postId/comments', optionalSupabaseAuthGuard, engagementController.listComments);
router.post(
  '/:postId/comments',
  supabaseAuthGuard,
  validateBody(CreateCommentDto),
  engagementController.addComment,
);
router.delete(
  '/:postId/comments/:id',
  supabaseAuthGuard,
  engagementController.deleteComment,
);
router.post(
  '/:postId/comments/:id/like',
  supabaseAuthGuard,
  engagementController.likeComment,
);
router.post('/:postId/share', supabaseAuthGuard, engagementController.sharePost);

export { router as engagementRouter };
