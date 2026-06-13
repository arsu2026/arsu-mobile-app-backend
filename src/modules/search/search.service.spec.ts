jest.mock('./search.repository');

import * as repo from './search.repository';
import { BadRequestError, NotFoundError } from '../../common/errors';
import {
  clearSearchHistory,
  deleteSearchHistoryItem,
  getHashtagFeed,
  saveSearchHistory,
  searchPosts,
  unifiedSearch,
} from './search.service';

const mockSearchPosts = repo.searchPosts as jest.Mock;
const mockFindPrivateProfileIdsNotFollowedBy = repo.findPrivateProfileIdsNotFollowedBy as jest.Mock;
const mockFindBlockedUserIds = repo.findBlockedUserIds as jest.Mock;
const mockCreateSearchHistory = repo.createSearchHistory as jest.Mock;
const mockFindHashtagByName = repo.findHashtagByName as jest.Mock;
const mockGetHashtagFeed = repo.getHashtagFeed as jest.Mock;
const mockDeleteSearchHistoryItem = repo.deleteSearchHistoryItem as jest.Mock;
const mockClearSearchHistory = repo.clearSearchHistory as jest.Mock;
const mockSearchProfiles = repo.searchProfiles as jest.Mock;
const mockSearchVideos = repo.searchVideos as jest.Mock;
const mockSearchShorts = repo.searchShorts as jest.Mock;
const mockSearchHashtags = repo.searchHashtags as jest.Mock;
const mockFindFollowingIds = repo.findFollowingIds as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';

const samplePost = {
  id: 'post-1',
  authorId: USER_A,
  content: 'Hello world',
  title: null,
  description: null,
  postType: 'TEXT' as const,
  privacy: 'PUBLIC' as const,
  mediaUrl: null,
  thumbnailUrl: null,
  isLongFormVideo: false,
  category: null,
  viewCount: 10,
  createdAt: new Date('2024-06-01'),
  author: {
    id: USER_A,
    username: 'john',
    fullName: 'John Doe',
    avatarUrl: null,
  },
};

describe('search.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindPrivateProfileIdsNotFollowedBy.mockResolvedValue([]);
    mockFindBlockedUserIds.mockResolvedValue([]);
    mockFindFollowingIds.mockResolvedValue([]);
  });

  describe('searchPosts', () => {
    it('returns matching posts with pagination meta', async () => {
      mockSearchPosts.mockResolvedValue({ rows: [samplePost], total: 1 });

      const result = await searchPosts('hello', USER_A, 1, 10);

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].content).toBe('Hello world');
      expect(result.meta.total).toBe(1);
      expect(mockCreateSearchHistory).toHaveBeenCalledWith(USER_A, 'hello', 'POSTS');
    });

    it('throws BadRequestError for short query', async () => {
      await expect(searchPosts('a', USER_A, 1, 10)).rejects.toBeInstanceOf(BadRequestError);
      expect(mockSearchPosts).not.toHaveBeenCalled();
    });
  });

  describe('unifiedSearch', () => {
    it('returns mixed results for type ALL', async () => {
      mockSearchProfiles.mockResolvedValue({ rows: [], total: 0 });
      mockSearchPosts.mockResolvedValue({ rows: [samplePost], total: 1 });
      mockSearchVideos.mockResolvedValue({ rows: [], total: 0 });
      mockSearchShorts.mockResolvedValue({ rows: [], total: 0 });
      mockSearchHashtags.mockResolvedValue([]);

      const result = await unifiedSearch('hello', 'ALL', USER_A, 1, 10);

      expect(result.type).toBe('ALL');
      expect(result.posts).toHaveLength(1);
      expect(mockCreateSearchHistory).toHaveBeenCalledWith(USER_A, 'hello', 'ALL');
    });
  });

  describe('getHashtagFeed', () => {
    it('throws NotFoundError when hashtag does not exist', async () => {
      mockFindHashtagByName.mockResolvedValue(null);

      await expect(getHashtagFeed('unknown', USER_A, 1, 10)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns feed for existing hashtag', async () => {
      mockFindHashtagByName.mockResolvedValue({ id: 'tag-1', name: 'music', postCount: 5 });
      mockGetHashtagFeed.mockResolvedValue({ rows: [samplePost], total: 1 });

      const result = await getHashtagFeed('music', USER_A, 1, 10);

      expect(result.hashtag.name).toBe('music');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('saveSearchHistory', () => {
    it('creates a search history entry', async () => {
      mockCreateSearchHistory.mockResolvedValue({
        id: 'hist-1',
        query: 'cats',
        searchType: 'ALL',
        createdAt: new Date('2024-06-01'),
      });

      const result = await saveSearchHistory(USER_A, 'cats', 'ALL');

      expect(result.query).toBe('cats');
      expect(mockCreateSearchHistory).toHaveBeenCalledWith(USER_A, 'cats', 'ALL');
    });
  });

  describe('deleteSearchHistoryItem', () => {
    it('throws NotFoundError when item does not exist', async () => {
      mockDeleteSearchHistoryItem.mockResolvedValue({ count: 0 });

      await expect(
        deleteSearchHistoryItem(USER_A, 'missing-id'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('clearSearchHistory', () => {
    it('clears all history for user', async () => {
      mockClearSearchHistory.mockResolvedValue({ count: 3 });

      const result = await clearSearchHistory(USER_A);

      expect(result.message).toBe('Search history cleared');
    });
  });
});
