import { validateDto } from '../../../../test/helpers/validate-dto';
import { ListSavedDto } from './list-saved.dto';

describe('ListSavedDto', () => {
  it('accepts an empty query', async () => {
    const errors = await validateDto(ListSavedDto, {});
    expect(errors).toHaveLength(0);
  });

  it('accepts a known type filter', async () => {
    const errors = await validateDto(ListSavedDto, { type: 'video' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown type filter', async () => {
    const errors = await validateDto(ListSavedDto, { type: 'audio' });
    expect(errors.map((e) => e.property)).toContain('type');
  });
});
