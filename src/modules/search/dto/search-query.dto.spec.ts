import { SearchQueryDto } from './search-query.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('SearchQueryDto', () => {
  it('accepts a valid search query', async () => {
    const errors = await validateDto(SearchQueryDto, { q: 'hello' });
    expect(errors).toHaveLength(0);
  });

  it('rejects queries shorter than 2 characters', async () => {
    const errors = await validateDto(SearchQueryDto, { q: 'a' });
    expect(errors.some((e) => e.property === 'q')).toBe(true);
  });
});
