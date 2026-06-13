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

router.get('/posts', validateQuery(SearchQueryDto), optionalSupabaseAuthGuard, searchController.searchPosts);
router.get('/videos', validateQuery(SearchQueryDto), optionalSupabaseAuthGuard, searchController.searchVideos);
router.get('/hashtags', validateQuery(SearchQueryDto), searchController.searchHashtags);
router.get('/explore', validateQuery(ExploreQueryDto), optionalSupabaseAuthGuard, searchController.getExploreFeed);

router.get('/history', supabaseAuthGuard, searchController.getSearchHistory);
router.post('/history', supabaseAuthGuard, validateBody(SaveSearchHistoryDto), searchController.saveSearchHistory);
router.delete('/history', supabaseAuthGuard, searchController.clearSearchHistory);
router.delete('/history/:searchId', supabaseAuthGuard, searchController.deleteSearchHistoryItem);

router.get(
  '/hashtags/:tag/feed',
  validateQuery(HashtagFeedDto),
  optionalSupabaseAuthGuard,
  searchController.getHashtagFeed,
);

router.get('/', validateQuery(UnifiedSearchDto), optionalSupabaseAuthGuard, searchController.unifiedSearch);

export { router as searchRouter };
