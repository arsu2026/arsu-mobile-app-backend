import { validateDto } from '../../../../test/helpers/validate-dto';
import { CreateCollectionDto } from './create-collection.dto';

describe('CreateCollectionDto', () => {
  it('accepts a valid name', async () => {
    const errors = await validateDto(CreateCollectionDto, { name: 'Recipes' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const errors = await validateDto(CreateCollectionDto, { name: '' });
    expect(errors.map((e) => e.property)).toContain('name');
  });

  it('rejects a name over 100 chars', async () => {
    const errors = await validateDto(CreateCollectionDto, { name: 'x'.repeat(101) });
    expect(errors.map((e) => e.property)).toContain('name');
  });
});
