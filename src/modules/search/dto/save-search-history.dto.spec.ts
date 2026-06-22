import { SaveSearchHistoryDto } from './save-search-history.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('SaveSearchHistoryDto', () => {
  it('accepts a valid search query', async () => {
    const errors = await validateDto(SaveSearchHistoryDto, { query: 'cats' });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty query', async () => {
    const errors = await validateDto(SaveSearchHistoryDto, { query: 'a' });
    expect(errors.some((e) => e.property === 'query')).toBe(true);
  });
});
