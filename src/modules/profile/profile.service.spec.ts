jest.mock('./profile.repository');
jest.mock('../activity-log/activity-log.service');

import * as repo from './profile.repository';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../common/errors';
import {
  followUser,
  getProfile,
  updateProfile,
  blockUser,
  recordHeartbeat,
  getFollowRequests,
  getSuggestions,
} from './profile.service';

const mockFindProfileById = repo.findProfileById as jest.Mock;
const mockCountFollowers = repo.countFollowers as jest.Mock;
const mockCountFollowing = repo.countFollowing as jest.Mock;
const mockCountPosts = repo.countPosts as jest.Mock;
const mockFindFollow = repo.findFollow as jest.Mock;
const mockFindUsernameConflict = repo.findUsernameConflict as jest.Mock;
const mockUpdateProfile = repo.updateProfile as jest.Mock;
const mockCreateFollow = repo.createFollow as jest.Mock;
const mockCreateNotification = repo.createNotification as jest.Mock;
const mockFindBlockBetween = repo.findBlockBetween as jest.Mock;
const mockRemoveAllFollowRelationships = repo.removeAllFollowRelationships as jest.Mock;
const mockCreateBlock = repo.createBlock as jest.Mock;
const mockFindBlock = repo.findBlock as jest.Mock;
const mockTouchLastActive = repo.touchLastActive as jest.Mock;
const mockListPendingFollowRequests = repo.listPendingFollowRequests as jest.Mock;
const mockFindFollowingIds = repo.findFollowingIds as jest.Mock;
const mockCountMutualFollows = repo.countMutualFollows as jest.Mock;
const mockFindBlockedUserIds = repo.findBlockedUserIds as jest.Mock;
const mockFindSecondDegreeConnections = repo.findSecondDegreeConnections as jest.Mock;
const mockFindProfilesByIds = repo.findProfilesByIds as jest.Mock;
const mockFindContactSuggestions = repo.findContactSuggestions as jest.Mock;
const mockFindLocationSuggestions = repo.findLocationSuggestions as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const baseProfile = {
  id: USER_B,
  username: 'jane',
  fullName: 'Jane Doe',
  bio: null,
  avatarUrl: null,
  coverUrl: null,
  website: null,
  dateOfBirth: null,
  gender: null,
  relationshipStatus: null,
  location: null,
  work: null,
  education: null,
  currentCity: null,
  hometown: null,
  pinnedPostId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  privacySettings: { isPrivate: false },
};

describe('profile.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getProfile', () => {
    it('returns profile with counts for a public profile', async () => {
      mockFindProfileById.mockResolvedValue(baseProfile);
      mockCountFollowers.mockResolvedValue(10);
      mockCountFollowing.mockResolvedValue(5);
      mockCountPosts.mockResolvedValue(3);
      mockFindFollow.mockResolvedValue(null);

      const result = await getProfile(USER_B, USER_A);

      expect(result.fullName).toBe('Jane Doe');
      expect(result.followerCount).toBe(10);
      expect(result.isOwnProfile).toBe(false);
      expect(result.isFollowing).toBe(false);
    });

    it('throws NotFoundError for private profile when viewer is not a follower', async () => {
      mockFindProfileById.mockResolvedValue({
        ...baseProfile,
        privacySettings: { isPrivate: true },
      });

      await expect(getProfile(USER_B, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('throws ConflictError when username is taken', async () => {
      mockFindProfileById.mockResolvedValue(baseProfile);
      mockFindUsernameConflict.mockResolvedValue({ id: 'other' });

      await expect(
        updateProfile(USER_A, { username: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('updates profile when username is available', async () => {
      mockFindProfileById.mockResolvedValue({ ...baseProfile, id: USER_A });
      mockFindUsernameConflict.mockResolvedValue(null);
      mockUpdateProfile.mockResolvedValue({ ...baseProfile, id: USER_A, username: 'newname' });
      mockCountFollowers.mockResolvedValue(0);
      mockCountFollowing.mockResolvedValue(0);
      mockCountPosts.mockResolvedValue(0);
      mockFindFollow.mockResolvedValue(null);

      const result = await updateProfile(USER_A, { username: 'newname' });

      expect(mockUpdateProfile).toHaveBeenCalledWith(USER_A, { username: 'newname' });
      expect(result.isOwnProfile).toBe(true);
    });
  });

  describe('followUser', () => {
    it('creates a pending follow for private accounts', async () => {
      mockFindProfileById
        .mockResolvedValueOnce({ ...baseProfile, id: USER_A })
        .mockResolvedValueOnce({
          ...baseProfile,
          privacySettings: { isPrivate: true },
        });
      mockFindBlockBetween.mockResolvedValue(null);
      mockFindFollow.mockResolvedValue(null);
      mockCreateFollow.mockResolvedValue({ id: 'f1', status: 'PENDING' });
      mockCreateNotification.mockResolvedValue({});

      const result = await followUser(USER_A, USER_B);

      expect(mockCreateFollow).toHaveBeenCalledWith(USER_A, USER_B, 'PENDING');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('blockUser', () => {
    it('removes follow relationships and creates a block', async () => {
      mockFindProfileById.mockResolvedValue(baseProfile);
      mockFindBlock.mockResolvedValue(null);
      mockRemoveAllFollowRelationships.mockResolvedValue({ count: 1 });
      mockCreateBlock.mockResolvedValue({});

      const result = await blockUser(USER_A, USER_B);

      expect(mockRemoveAllFollowRelationships).toHaveBeenCalledWith(USER_A, USER_B);
      expect(mockCreateBlock).toHaveBeenCalledWith(USER_A, USER_B);
      expect(result.message).toMatch(/blocked/i);
    });

    it('prevents blocking yourself', async () => {
      await expect(blockUser(USER_A, USER_A)).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('recordHeartbeat', () => {
    it('stamps last active and reports the user online', async () => {
      const now = new Date('2026-06-16T12:00:00.000Z');
      mockTouchLastActive.mockResolvedValue({ lastActiveAt: now, updated: true });

      const result = await recordHeartbeat(USER_A);

      expect(mockTouchLastActive).toHaveBeenCalledWith(USER_A);
      expect(result).toEqual({ lastSeen: now.toISOString(), isOnline: true });
    });

    it('throws NotFoundError when no profile row was updated', async () => {
      mockTouchLastActive.mockResolvedValue({ lastActiveAt: new Date(), updated: false });

      await expect(recordHeartbeat(USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getFollowRequests', () => {
    const requestRow = (lastActiveAt: Date | null) => ({
      follower: {
        id: USER_B,
        username: 'jane',
        fullName: 'Jane Doe',
        avatarUrl: null,
        lastActiveAt,
      },
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
    });

    it('enriches requests with mutualFriends and exposes lastSeen for a followed requester', async () => {
      mockListPendingFollowRequests.mockResolvedValue([requestRow(new Date())]);
      mockFindFollowingIds.mockResolvedValue([USER_B]);
      mockCountMutualFollows.mockResolvedValue(new Map([[USER_B, 3]]));

      const result = await getFollowRequests(USER_A);

      expect(result[0].mutualFriends).toBe(3);
      expect(result[0].requester.isFollowing).toBe(true);
      expect(result[0].requester.isOnline).toBe(true);
      expect(result[0].requester.lastSeen).not.toBeNull();
      expect(result[0].requestedAt).toBe('2026-06-16T10:00:00.000Z');
      expect(result[0].requester).not.toHaveProperty('lastActiveAt');
    });

    it('withholds exact lastSeen from a requester the owner does not follow', async () => {
      mockListPendingFollowRequests.mockResolvedValue([requestRow(new Date())]);
      mockFindFollowingIds.mockResolvedValue([]);
      mockCountMutualFollows.mockResolvedValue(new Map([[USER_B, 1]]));

      const result = await getFollowRequests(USER_A);

      expect(result[0].requester.isFollowing).toBe(false);
      expect(result[0].requester.isOnline).toBe(true);
      expect(result[0].requester.lastSeen).toBeNull();
    });

    it('marks a stale or missing lastActiveAt as offline with zero mutuals', async () => {
      const stale = new Date(Date.now() - 10 * 60 * 1000);
      mockListPendingFollowRequests.mockResolvedValue([requestRow(stale)]);
      mockFindFollowingIds.mockResolvedValue([]);
      mockCountMutualFollows.mockResolvedValue(new Map());

      const result = await getFollowRequests(USER_A);

      expect(result[0].requester.isOnline).toBe(false);
      expect(result[0].mutualFriends).toBe(0);
    });
  });

  describe('getSuggestions presence', () => {
    it('shows isOnline but withholds exact lastSeen for suggested non-followers', async () => {
      const recent = new Date();
      mockFindProfileById.mockResolvedValue({ ...baseProfile, id: USER_A, location: null });
      mockFindBlockedUserIds.mockResolvedValue([]);
      mockFindSecondDegreeConnections.mockResolvedValue([
        { followerId: USER_B, followingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      ]);
      mockFindProfilesByIds.mockResolvedValue([
        { id: USER_B, username: 'jane', fullName: 'Jane Doe', avatarUrl: null, lastActiveAt: recent },
      ]);
      mockFindContactSuggestions.mockResolvedValue([]);
      mockFindLocationSuggestions.mockResolvedValue([]);
      mockFindFollowingIds.mockResolvedValue([]);

      const result = await getSuggestions(USER_A);

      expect(result[0].user.id).toBe(USER_B);
      expect(result[0].mutualCount).toBe(1);
      expect(result[0].reason).toBe('mutual_followers');
      expect(result[0].user.isOnline).toBe(true);
      expect(result[0].user.lastSeen).toBeNull();
      expect(result[0].user).not.toHaveProperty('lastActiveAt');
    });
  });
});
