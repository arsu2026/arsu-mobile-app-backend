jest.mock('./memories.repository');

import * as repo from './memories.repository';
import { getMemories } from './memories.service';

const mockFindIds = repo.findMemoryPostIds as jest.Mock;
const mockFindPosts = repo.findPostsByIds as jest.Mock;

const USER = '11111111-1111-4111-8111-111111111111';

function post(year: number) {
  return {
    id: 'p1',
    authorId: USER,
    content: 'memory',
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
    author: { id: USER, fullName: 'Me', avatarUrl: null },
    createdAt: new Date(`${year}-06-17T00:00:00.000Z`),
    updatedAt: new Date(`${year}-06-17T00:00:00.000Z`),
  };
}

describe('memories.service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to today (MM-DD) when no date given', async () => {
    mockFindIds.mockResolvedValue([]);
    mockFindPosts.mockResolvedValue([]);
    await getMemories(USER);
    const calledMonthDay = mockFindIds.mock.calls[0][1];
    expect(calledMonthDay).toMatch(/^\d{2}-\d{2}$/);
  });

  it('passes an explicit date through to the repository', async () => {
    mockFindIds.mockResolvedValue([]);
    mockFindPosts.mockResolvedValue([]);
    await getMemories(USER, '12-25');
    expect(mockFindIds.mock.calls[0][1]).toBe('12-25');
  });

  it('computes yearsAgo and maps the post', async () => {
    mockFindIds.mockResolvedValue(['p1']);
    mockFindPosts.mockResolvedValue([post(2020)]);
    const result = await getMemories(USER, '06-17');
    const expectedYears = new Date().getUTCFullYear() - 2020;
    expect(result[0].yearsAgo).toBe(expectedYears);
    expect(result[0].post.id).toBe('p1');
    expect(result[0].post.content).toBe('memory');
  });
});
