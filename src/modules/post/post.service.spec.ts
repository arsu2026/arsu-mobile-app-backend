jest.mock('./post.repository');
jest.mock('../../common/storage/storage.service');

import * as repo from './post.repository';
import * as storage from '../../common/storage/storage.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { createPost, deletePost, getPostById, listPostsByAuthor, updatePost } from './post.service';

const mockCreatePost = repo.createPost as jest.Mock;
const mockFindPostById = repo.findPostById as jest.Mock;
const mockUpdatePost = repo.updatePost as jest.Mock;
const mockDeletePost = repo.deletePost as jest.Mock;
const mockListPostsByAuthor = repo.listPostsByAuthor as jest.Mock;
const mockSyncPostHashtags = repo.syncPostHashtags as jest.Mock;
const mockFindBlockBetween = repo.findBlockBetween as jest.Mock;
const mockIsAcceptedFollower = repo.isAcceptedFollower as jest.Mock;
const mockFindLikedPostIds = repo.findLikedPostIds as jest.Mock;
const mockIsPostLikedByUser = repo.isPostLikedByUser as jest.Mock;
const mockUploadImage = storage.uploadImage as jest.Mock;
const mockDeleteImages = storage.deleteImages as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';

const basePost = {
  id: POST_ID,
  authorId: USER_A,
  content: 'hello',
  postType: 'TEXT',
  privacy: 'PUBLIC',
  category: null,
  mediaUrl: null,
  thumbnailUrl: null,
  media: [],
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  isLongFormVideo: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  author: { id: USER_A, fullName: 'Test User', avatarUrl: null },
};

describe('post.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindLikedPostIds.mockResolvedValue([]);
    mockIsPostLikedByUser.mockResolvedValue(false);
  });

  describe('createPost', () => {
    it('creates a TEXT post and extracts hashtags', async () => {
      mockCreatePost.mockResolvedValue({ ...basePost, content: 'hi #World' });

      const result = await createPost(USER_A, { content: 'hi #World', images: [] });

      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: USER_A, postType: 'TEXT', mediaUrl: null }),
      );
      expect(mockSyncPostHashtags).toHaveBeenCalledWith(POST_ID, ['world']);
      expect(result.id).toBe(POST_ID);
    });

    it('uploads images, sets postType IMAGE, and mirrors the first URL', async () => {
      mockUploadImage
        .mockResolvedValueOnce('https://cdn/a.jpg')
        .mockResolvedValueOnce('https://cdn/b.jpg');
      mockCreatePost.mockResolvedValue({
        ...basePost,
        postType: 'IMAGE',
        mediaUrl: 'https://cdn/a.jpg',
        media: [
          { id: 'm1', url: 'https://cdn/a.jpg', position: 0 },
          { id: 'm2', url: 'https://cdn/b.jpg', position: 1 },
        ],
      });

      const result = await createPost(USER_A, {
        images: [
          { buffer: Buffer.from('a'), mimetype: 'image/jpeg' },
          { buffer: Buffer.from('b'), mimetype: 'image/png' },
        ],
      });

      expect(mockUploadImage).toHaveBeenCalledTimes(2);
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: 'IMAGE',
          mediaUrl: 'https://cdn/a.jpg',
          thumbnailUrl: 'https://cdn/a.jpg',
          mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
        }),
      );
      expect(result.media).toHaveLength(2);
    });

    it('rejects a post with neither text nor images', async () => {
      await expect(createPost(USER_A, { images: [] })).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('getPostById', () => {
    it('returns a public post to an anonymous viewer', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, privacy: 'PUBLIC' });
      const result = await getPostById(POST_ID, undefined);
      expect(result.id).toBe(POST_ID);
    });

    it('404s a missing post', async () => {
      mockFindPostById.mockResolvedValue(null);
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('404s an ONLY_ME post for a non-owner', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'ONLY_ME' });
      mockFindBlockBetween.mockResolvedValue(null);
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('404s a FOLLOWERS post for a non-follower', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'FOLLOWERS' });
      mockFindBlockBetween.mockResolvedValue(null);
      mockIsAcceptedFollower.mockResolvedValue(false);
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns a FOLLOWERS post to an accepted follower', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'FOLLOWERS' });
      mockFindBlockBetween.mockResolvedValue(null);
      mockIsAcceptedFollower.mockResolvedValue(true);
      const result = await getPostById(POST_ID, USER_A);
      expect(result.id).toBe(POST_ID);
    });

    it('404s when the viewer is blocked', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'PUBLIC' });
      mockFindBlockBetween.mockResolvedValue({ id: 'b1' });
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('listPostsByAuthor', () => {
    it('lists posts with pagination meta', async () => {
      mockListPostsByAuthor.mockResolvedValue({ rows: [basePost], total: 1 });
      const result = await listPostsByAuthor(USER_A, USER_A, 1, 20);
      expect(result.posts).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('returns an empty page when the viewer is blocked', async () => {
      mockFindBlockBetween.mockResolvedValue({ id: 'b1' });
      const result = await listPostsByAuthor(USER_B, USER_A, 1, 20);
      expect(result.posts).toEqual([]);
      expect(mockListPostsByAuthor).not.toHaveBeenCalled();
    });
  });

  describe('updatePost', () => {
    it('rejects editing someone else’s post', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B });
      await expect(updatePost(POST_ID, USER_A, { content: 'x' })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('updates content and re-syncs hashtags', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_A });
      mockUpdatePost.mockResolvedValue({ ...basePost, content: 'new #tag' });

      const result = await updatePost(POST_ID, USER_A, { content: 'new #tag' });

      expect(mockUpdatePost).toHaveBeenCalledWith(POST_ID, { content: 'new #tag' });
      expect(mockSyncPostHashtags).toHaveBeenCalledWith(POST_ID, ['tag']);
      expect(result.content).toBe('new #tag');
    });

    it('rejects an empty update', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_A });
      await expect(updatePost(POST_ID, USER_A, {})).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('deletePost', () => {
    it('deletes an own post, clears hashtags, and removes images', async () => {
      mockFindPostById.mockResolvedValue({
        ...basePost,
        authorId: USER_A,
        media: [{ id: 'm1', url: 'https://cdn/a.jpg', position: 0 }],
      });

      await deletePost(POST_ID, USER_A);

      expect(mockSyncPostHashtags).toHaveBeenCalledWith(POST_ID, []);
      expect(mockDeletePost).toHaveBeenCalledWith(POST_ID);
      expect(mockDeleteImages).toHaveBeenCalledWith(['https://cdn/a.jpg']);
    });

    it('rejects deleting someone else’s post', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B });
      await expect(deletePost(POST_ID, USER_A)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
