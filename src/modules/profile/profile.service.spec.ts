jest.mock('./profile.repository');

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
});
