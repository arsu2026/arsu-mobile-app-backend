jest.mock('../../prisma', () => ({
  prisma: { post: { findMany: jest.fn() } },
}));

import { fetchPostPreviews } from './post-preview.util';
import { prisma } from '../../prisma';

const mockFindMany = prisma.post.findMany as jest.Mock;

describe('fetchPostPreviews', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty map for no ids without querying', async () => {
    const result = await fetchPostPreviews([]);
    expect(result.size).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('dedupes ids and prefers thumbnailUrl, then first media, then mediaUrl', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', content: 'hi', thumbnailUrl: 'thumb1', mediaUrl: 'media1', media: [{ url: 'm1' }] },
      { id: 'p2', content: null, thumbnailUrl: null, mediaUrl: 'media2', media: [{ url: 'm2' }] },
      { id: 'p3', content: 'yo', thumbnailUrl: null, mediaUrl: null, media: [] },
    ]);

    const result = await fetchPostPreviews(['p1', 'p1', 'p2', 'p3']);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ id: { in: ['p1', 'p2', 'p3'] } });
    expect(result.get('p1')).toEqual({ postId: 'p1', thumbnailUrl: 'thumb1', snippet: 'hi' });
    expect(result.get('p2')).toEqual({ postId: 'p2', thumbnailUrl: 'm2', snippet: null });
    expect(result.get('p3')).toEqual({ postId: 'p3', thumbnailUrl: null, snippet: 'yo' });
  });
});
