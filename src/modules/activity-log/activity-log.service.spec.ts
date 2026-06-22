jest.mock('./activity-log.repository');
jest.mock('../../common/utils/post-preview.util');

import { BadRequestError } from '../../common/errors';
import { fetchPostPreviews } from '../../common/utils/post-preview.util';
import * as repo from './activity-log.repository';
import { getActivityLog, recordActivity } from './activity-log.service';

const mockListByUser = repo.listByUser as jest.Mock;
const mockCreateActivity = repo.createActivity as jest.Mock;
const mockFetchPreviews = fetchPostPreviews as jest.Mock;

const USER = '11111111-1111-4111-8111-111111111111';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    type: 'POST_LIKED',
    entityId: 'p1',
    entityType: 'POST',
    metadata: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    ...over,
  };
}

describe('activity-log.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPreviews.mockResolvedValue(new Map());
  });

  it('recordActivity persists via the repository', async () => {
    mockCreateActivity.mockResolvedValue(row());
    await recordActivity(USER, 'POST_CREATED', { entityId: 'p9', entityType: 'POST' });
    expect(mockCreateActivity).toHaveBeenCalledWith({
      userId: USER,
      type: 'POST_CREATED',
      entityId: 'p9',
      entityType: 'POST',
    });
  });

  it('maps the "liked" filter to POST_LIKED', async () => {
    mockListByUser.mockResolvedValue({ rows: [], total: 0 });
    await getActivityLog(USER, 'liked', 1, 20);
    expect(mockListByUser).toHaveBeenCalledWith(USER, 'POST_LIKED', 0, 20);
  });

  it('throws BadRequestError on an unknown filter', async () => {
    await expect(getActivityLog(USER, 'nonsense', 1, 20)).rejects.toBeInstanceOf(BadRequestError);
  });

  it('enriches POST activities with a preview', async () => {
    mockListByUser.mockResolvedValue({ rows: [row()], total: 1 });
    mockFetchPreviews.mockResolvedValue(
      new Map([['p1', { postId: 'p1', thumbnailUrl: 'http://x/t.jpg', snippet: 'hi' }]]),
    );
    const result = await getActivityLog(USER, undefined, 1, 20);
    expect(mockFetchPreviews).toHaveBeenCalledWith(['p1']);
    expect(result.items[0].preview).toEqual({ postId: 'p1', thumbnailUrl: 'http://x/t.jpg', snippet: 'hi' });
    expect(result.meta.total).toBe(1);
  });
});
