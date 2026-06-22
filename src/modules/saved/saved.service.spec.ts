jest.mock('./saved.repository');

import { ConflictError, NotFoundError } from '../../common/errors';
import * as repo from './saved.repository';
import {
  createCollection,
  createSavedItem,
  deleteSavedItem,
  listCollections,
  listSavedItems,
} from './saved.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const POST = '33333333-3333-4333-8333-333333333333';

const mockFindPost = repo.findPostForSave as jest.Mock;
const mockBlock = repo.findBlockBetween as jest.Mock;
const mockFollower = repo.isAcceptedFollower as jest.Mock;
const mockFindCollection = repo.findCollection as jest.Mock;
const mockFindExisting = repo.findExistingPostSave as jest.Mock;
const mockCreateItem = repo.createItem as jest.Mock;
const mockListItems = repo.listItems as jest.Mock;
const mockDeleteItem = repo.deleteItem as jest.Mock;
const mockCreateCollection = repo.createCollection as jest.Mock;
const mockListCollections = repo.listCollections as jest.Mock;

function itemRow(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    type: 'POST',
    postId: POST,
    linkUrl: null,
    linkTitle: null,
    linkThumbnailUrl: null,
    collectionId: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    post: {
      id: POST,
      content: 'A wonderful post about coffee',
      thumbnailUrl: 'http://x/t.jpg',
      mediaUrl: null,
      media: [],
      author: { id: OTHER, fullName: 'Jane', username: 'jane', avatarUrl: 'http://x/a.jpg' },
    },
    ...over,
  };
}

describe('saved.service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves a public post and maps it to a view', async () => {
    mockFindPost.mockResolvedValue({ id: POST, authorId: OTHER, privacy: 'PUBLIC' });
    mockBlock.mockResolvedValue(null);
    mockFindExisting.mockResolvedValue(null);
    mockCreateItem.mockResolvedValue(itemRow());

    const view = await createSavedItem(USER, { type: 'POST', postId: POST });
    expect(view).toMatchObject({
      id: 's1',
      type: 'POST',
      title: 'Jane',
      subtitle: 'A wonderful post about coffee',
      thumbnailUrl: 'http://x/t.jpg',
      avatarUrl: 'http://x/a.jpg',
      source: 'post',
    });
  });

  it('rejects a duplicate post save with ConflictError', async () => {
    mockFindPost.mockResolvedValue({ id: POST, authorId: OTHER, privacy: 'PUBLIC' });
    mockBlock.mockResolvedValue(null);
    mockFindExisting.mockResolvedValue({ id: 'existing' });
    await expect(createSavedItem(USER, { type: 'POST', postId: POST })).rejects.toBeInstanceOf(ConflictError);
  });

  it('404s when the post is private (ONLY_ME) and not the author', async () => {
    mockFindPost.mockResolvedValue({ id: POST, authorId: OTHER, privacy: 'ONLY_ME' });
    mockBlock.mockResolvedValue(null);
    await expect(createSavedItem(USER, { type: 'POST', postId: POST })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('404s when saving into a collection that is not the user’s', async () => {
    mockFindCollection.mockResolvedValue(null);
    await expect(
      createSavedItem(USER, { type: 'POST', postId: POST, collectionId: 'c-x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('saves a LINK item', async () => {
    mockCreateItem.mockResolvedValue(
      itemRow({ type: 'LINK', postId: null, linkUrl: 'https://x.com/a', linkTitle: 'Cool', linkThumbnailUrl: null, post: null }),
    );
    const view = await createSavedItem(USER, { type: 'LINK', linkUrl: 'https://x.com/a', linkTitle: 'Cool' });
    expect(view).toMatchObject({ type: 'LINK', title: 'Cool', subtitle: 'https://x.com/a', source: 'link' });
  });

  it('maps the list type filter and paginates', async () => {
    mockListItems.mockResolvedValue({ rows: [itemRow()], total: 1 });
    const result = await listSavedItems(USER, 'video', undefined, 1, 20);
    expect(mockListItems).toHaveBeenCalledWith(USER, 'VIDEO', undefined, 0, 20);
    expect(result.meta.total).toBe(1);
  });

  it('deletes an owned item', async () => {
    mockDeleteItem.mockResolvedValue({ count: 1 });
    await expect(deleteSavedItem(USER, 's1')).resolves.toBeUndefined();
  });

  it('404s deleting a non-owned/missing item', async () => {
    mockDeleteItem.mockResolvedValue({ count: 0 });
    await expect(deleteSavedItem(USER, 's1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates a collection with itemCount 0', async () => {
    mockCreateCollection.mockResolvedValue({
      id: 'c1',
      name: 'Recipes',
      description: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    const view = await createCollection(USER, 'Recipes');
    expect(view).toMatchObject({ id: 'c1', name: 'Recipes', itemCount: 0 });
  });

  it('lists collections with itemCount', async () => {
    mockListCollections.mockResolvedValue([
      { id: 'c1', name: 'Recipes', description: null, createdAt: new Date('2026-06-01T00:00:00.000Z'), _count: { items: 3 } },
    ]);
    const result = await listCollections(USER);
    expect(result[0].itemCount).toBe(3);
  });
});
