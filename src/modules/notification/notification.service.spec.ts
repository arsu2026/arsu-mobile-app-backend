jest.mock('./notification.repository');
jest.mock('../../common/utils/post-preview.util', () => ({
  fetchPostPreviews: jest.fn().mockResolvedValue(new Map()),
}));

import { BadRequestError, NotFoundError } from '../../common/errors';
import * as repo from './notification.repository';
import * as service from './notification.service';

const mockListByRecipient = repo.listByRecipient as jest.Mock;
const mockCountUnread = repo.countUnread as jest.Mock;
const mockFindOwned = repo.findOwned as jest.Mock;
const mockMarkRead = repo.markRead as jest.Mock;
const mockMarkAllRead = repo.markAllRead as jest.Mock;
const mockDeleteOne = repo.deleteOne as jest.Mock;
const mockDeleteAll = repo.deleteAll as jest.Mock;
const mockEnsurePreferences = repo.ensurePreferences as jest.Mock;
const mockUpdatePreferences = repo.updatePreferences as jest.Mock;
const mockCreateNotification = repo.createNotification as jest.Mock;

const RECIPIENT = '11111111-1111-4111-8111-111111111111';
const NOTIF_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = {
  id: '22222222-2222-4222-8222-222222222222',
  username: 'jane',
  fullName: 'Jane Doe',
  avatarUrl: null,
};

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIF_ID,
    type: 'FOLLOW',
    actor: ACTOR,
    entityId: null,
    message: 'started following you',
    isRead: false,
    createdAt: new Date('2026-06-16T10:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('notification.service', () => {
  describe('getNotifications', () => {
    it('maps rows to NotificationView with pagination meta', async () => {
      mockListByRecipient.mockResolvedValue({ rows: [buildRow()], total: 1 });

      const result = await service.getNotifications(RECIPIENT, 1, 20);

      expect(mockListByRecipient).toHaveBeenCalledWith(RECIPIENT, 0, 20);
      expect(result.notifications).toEqual([
        {
          id: NOTIF_ID,
          type: 'FOLLOW',
          actor: ACTOR,
          entityId: null,
          message: 'started following you',
          isRead: false,
          createdAt: '2026-06-16T10:00:00.000Z',
        },
      ]);
      expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('computes skip from the page and returns an empty page', async () => {
      mockListByRecipient.mockResolvedValue({ rows: [], total: 0 });

      const result = await service.getNotifications(RECIPIENT, 2, 20);

      expect(mockListByRecipient).toHaveBeenCalledWith(RECIPIENT, 20, 20);
      expect(result.notifications).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the unread count', async () => {
      mockCountUnread.mockResolvedValue(5);

      await expect(service.getUnreadCount(RECIPIENT)).resolves.toEqual({ count: 5 });
      expect(mockCountUnread).toHaveBeenCalledWith(RECIPIENT);
    });
  });

  describe('markAsRead', () => {
    it('marks an owned notification read and returns the view', async () => {
      mockFindOwned.mockResolvedValue(buildRow());
      mockMarkRead.mockResolvedValue({ count: 1 });

      const result = await service.markAsRead(RECIPIENT, NOTIF_ID);

      expect(mockFindOwned).toHaveBeenCalledWith(RECIPIENT, NOTIF_ID);
      expect(mockMarkRead).toHaveBeenCalledWith(RECIPIENT, NOTIF_ID);
      expect(result.isRead).toBe(true);
    });

    it("throws NotFoundError when the notification is not the recipient's", async () => {
      mockFindOwned.mockResolvedValue(null);

      await expect(service.markAsRead(RECIPIENT, NOTIF_ID)).rejects.toThrow(NotFoundError);
      expect(mockMarkRead).not.toHaveBeenCalled();
    });

    it('throws BadRequestError on a malformed id', async () => {
      await expect(service.markAsRead(RECIPIENT, 'not-a-uuid')).rejects.toThrow(BadRequestError);
      expect(mockFindOwned).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('delegates to the repository', async () => {
      mockMarkAllRead.mockResolvedValue({ count: 3 });

      await service.markAllAsRead(RECIPIENT);

      expect(mockMarkAllRead).toHaveBeenCalledWith(RECIPIENT);
    });
  });

  describe('deleteNotification', () => {
    it('deletes an owned notification', async () => {
      mockDeleteOne.mockResolvedValue({ count: 1 });

      await service.deleteNotification(RECIPIENT, NOTIF_ID);

      expect(mockDeleteOne).toHaveBeenCalledWith(RECIPIENT, NOTIF_ID);
    });

    it('throws NotFoundError when nothing was deleted', async () => {
      mockDeleteOne.mockResolvedValue({ count: 0 });

      await expect(service.deleteNotification(RECIPIENT, NOTIF_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws BadRequestError on a malformed id', async () => {
      await expect(service.deleteNotification(RECIPIENT, 'bad')).rejects.toThrow(BadRequestError);
      expect(mockDeleteOne).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('delegates to the repository', async () => {
      mockDeleteAll.mockResolvedValue({ count: 7 });

      await service.clearAll(RECIPIENT);

      expect(mockDeleteAll).toHaveBeenCalledWith(RECIPIENT);
    });
  });
});

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const allOnPrefs = {
  profileId: USER_B,
  comments: true,
  tags: true,
  reminders: false,
  moreActivityAboutYou: true,
  updatesFromFriends: true,
  pushEnabled: true,
  emailEnabled: false,
  smsEnabled: false,
};

describe('notification.service emitNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsurePreferences.mockResolvedValue(allOnPrefs);
  });

  it('skips creation when recipient === actor', async () => {
    await service.emitNotification({ recipientId: USER_A, actorId: USER_A, type: 'LIKE', entityId: 'p1' });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('creates the notification when the gating preference is on', async () => {
    await service.emitNotification({
      recipientId: USER_B,
      actorId: USER_A,
      type: 'LIKE',
      entityId: 'p1',
      message: 'liked your post',
    });
    expect(mockCreateNotification).toHaveBeenCalledWith({
      recipientId: USER_B,
      actorId: USER_A,
      type: 'LIKE',
      entityId: 'p1',
      message: 'liked your post',
    });
  });

  it('suppresses LIKE/SHARE when moreActivityAboutYou is off', async () => {
    mockEnsurePreferences.mockResolvedValue({ ...allOnPrefs, moreActivityAboutYou: false });
    await service.emitNotification({ recipientId: USER_B, actorId: USER_A, type: 'LIKE', entityId: 'p1' });
    await service.emitNotification({ recipientId: USER_B, actorId: USER_A, type: 'SHARE', entityId: 'p1' });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('suppresses COMMENT when comments is off but allows MENTION (tags on)', async () => {
    mockEnsurePreferences.mockResolvedValue({ ...allOnPrefs, comments: false });
    await service.emitNotification({ recipientId: USER_B, actorId: USER_A, type: 'COMMENT', entityId: 'p1' });
    await service.emitNotification({ recipientId: USER_B, actorId: USER_A, type: 'MENTION', entityId: 'p1' });
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification.mock.calls[0][0].type).toBe('MENTION');
  });
});

describe('notification.service preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsurePreferences.mockResolvedValue(allOnPrefs);
  });

  it('maps stored prefs into the nested view', async () => {
    const view = await service.getPreferences(USER_B);
    expect(view).toEqual({
      preferences: { comments: true, tags: true, reminders: false, moreActivityAboutYou: true, updatesFromFriends: true },
      channels: { push: true, email: false, sms: false },
    });
  });

  it('translates a partial update into prisma fields (channels → *Enabled)', async () => {
    mockUpdatePreferences.mockResolvedValue({ ...allOnPrefs, comments: false, emailEnabled: true });
    const view = await service.updatePreferences(USER_B, {
      preferences: { comments: false },
      channels: { email: true },
    });
    expect(mockUpdatePreferences).toHaveBeenCalledWith(USER_B, { comments: false, emailEnabled: true });
    expect(view.preferences.comments).toBe(false);
    expect(view.channels.email).toBe(true);
  });
});
