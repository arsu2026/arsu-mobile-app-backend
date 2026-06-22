import { ListPostsDto } from './list-posts.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('ListPostsDto', () => {
  it('accepts a valid authorId', async () => {
    const errors = await validateDto(ListPostsDto, {
      authorId: '11111111-1111-4111-8111-111111111111',
    });
    expect(errors).toHaveLength(0);
  });

  it('requires authorId', async () => {
    const errors = await validateDto(ListPostsDto, {});
    expect(errors.some((e) => e.property === 'authorId')).toBe(true);
  });

  it('rejects a non-uuid authorId', async () => {
    const errors = await validateDto(ListPostsDto, { authorId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'authorId')).toBe(true);
  });
});
