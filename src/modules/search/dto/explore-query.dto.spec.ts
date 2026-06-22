import { ExploreQueryDto } from './explore-query.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('ExploreQueryDto', () => {
  it('accepts optional category filter', async () => {
    const errors = await validateDto(ExploreQueryDto, { category: 'MUSIC' });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid category', async () => {
    const errors = await validateDto(ExploreQueryDto, { category: 'INVALID' });
    expect(errors.some((e) => e.property === 'category')).toBe(true);
  });
});
