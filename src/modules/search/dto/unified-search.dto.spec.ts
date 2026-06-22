import { UnifiedSearchDto } from './unified-search.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('UnifiedSearchDto', () => {
  it('accepts query with optional type filter', async () => {
    const errors = await validateDto(UnifiedSearchDto, { q: 'music', type: 'VIDEOS' });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid search type', async () => {
    const errors = await validateDto(UnifiedSearchDto, { q: 'test', type: 'INVALID' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });
});
