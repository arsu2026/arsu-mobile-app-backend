jest.mock('./engagement.repository');
jest.mock('../notification/notification.service');
jest.mock('../activity-log/activity-log.service');

import * as repo from './engagement.repository';
import * as notificationService from '../notification/notification.service';
import * as activityService from '../activity-log/activity-log.service';
import { likePost, addComment, sharePost } from './engagement.service';

const mockFindPostForEngagement = repo.findPostForEngagement as jest.Mock;
const mockFindBlockBetween = repo.findBlockBetween as jest.Mock;
const mockCreatePostLike = repo.createPostLike as jest.Mock;
const mockCreateComment = repo.createComment as jest.Mock;
const mockCreatePostShare = repo.createPostShare as jest.Mock;
const mockFindPostLike = repo.findPostLike as jest.Mock;
const mockFindProfilesByUsernames = repo.findProfilesByUsernames as jest.Mock;
const mockEmit = notificationService.emitNotification as jest.Mock;
const mockRecordActivity = activityService.recordActivity as jest.Mock;

const LIKER = '11111111-1111-4111-8111-111111111111';
const AUTHOR = '22222222-2222-4222-8222-222222222222';
const MENTIONED = '33333333-3333-4333-8333-333333333333';
const POST_ID = '44444444-4444-4444-8444-444444444444';

const publicPost = {
  id: POST_ID,
  authorId: AUTHOR,
  privacy: 'PUBLIC',
  // fields consumed by mapPostToView:
  content: 'hello',
  postType: 'TEXT',
  category: null,
  mediaUrl: null,
  thumbnailUrl: null,
  viewCount: 0,
  likeCount: 1,
  commentCount: 0,
  shareCount: 0,
  isLongFormVideo: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  author: { id: AUTHOR, fullName: 'Author', avatarUrl: null },
  media: [],
};

describe('engagement notification hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindPostForEngagement.mockResolvedValue(publicPost);
    mockFindBlockBetween.mockResolvedValue(null);
    mockCreatePostLike.mockResolvedValue({});
    mockCreatePostShare.mockResolvedValue({ ...publicPost, shareCount: 1 });
    mockFindPostLike.mockResolvedValue(null);
    mockEmit.mockResolvedValue(undefined);
  });

  it('emits a LIKE notification to the post author on like', async () => {
    await likePost(POST_ID, LIKER);
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: AUTHOR, actorId: LIKER, type: 'LIKE', entityId: POST_ID }),
    );
  });

  it('emits a SHARE notification on share', async () => {
    await sharePost(POST_ID, LIKER);
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: AUTHOR, actorId: LIKER, type: 'SHARE', entityId: POST_ID }),
    );
  });

  it('records a POST_LIKED activity', async () => {
    await likePost(POST_ID, LIKER);
    expect(mockRecordActivity).toHaveBeenCalledWith(LIKER, 'POST_LIKED', {
      entityId: POST_ID,
      entityType: 'POST',
    });
  });

  it('does not break the like when emitNotification rejects', async () => {
    mockEmit.mockRejectedValue(new Error('notif down'));
    await expect(likePost(POST_ID, LIKER)).resolves.toBeDefined();
    expect(mockCreatePostLike).toHaveBeenCalled();
  });

  it('emits a COMMENT notification plus a MENTION per resolved @handle (skipping author/self)', async () => {
    mockCreateComment.mockResolvedValue({
      id: 'c1', postId: POST_ID, authorId: LIKER, content: 'hi @mentioned @author', likeCount: 0,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
      author: { id: LIKER, fullName: 'Liker', avatarUrl: null },
    });
    mockFindProfilesByUsernames.mockResolvedValue([
      { id: MENTIONED, username: 'mentioned' },
      { id: AUTHOR, username: 'author' },
    ]);

    await addComment(POST_ID, LIKER, 'hi @mentioned @author');

    const types = mockEmit.mock.calls.map((c) => c[0].type);
    expect(types).toContain('COMMENT');
    expect(types).toContain('MENTION');
    // the author is notified once (COMMENT), not a second time via MENTION:
    const mentionCalls = mockEmit.mock.calls.filter((c) => c[0].type === 'MENTION');
    expect(mentionCalls).toHaveLength(1);
    expect(mentionCalls[0][0].recipientId).toBe(MENTIONED);
  });
});
