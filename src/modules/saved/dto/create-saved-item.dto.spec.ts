import { validateDto } from '../../../../test/helpers/validate-dto';
import { CreateSavedItemDto } from './create-saved-item.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('CreateSavedItemDto', () => {
  it('accepts a POST save with a valid postId', async () => {
    const errors = await validateDto(CreateSavedItemDto, { type: 'POST', postId: UUID });
    expect(errors).toHaveLength(0);
  });

  it('rejects a POST save without postId', async () => {
    const errors = await validateDto(CreateSavedItemDto, { type: 'POST' });
    expect(errors.map((e) => e.property)).toContain('postId');
  });

  it('rejects a LINK save with an invalid url', async () => {
    const errors = await validateDto(CreateSavedItemDto, { type: 'LINK', linkUrl: 'not-a-url' });
    expect(errors.map((e) => e.property)).toContain('linkUrl');
  });

  it('accepts a LINK save with a valid url', async () => {
    const errors = await validateDto(CreateSavedItemDto, { type: 'LINK', linkUrl: 'https://x.com/a' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown type', async () => {
    const errors = await validateDto(CreateSavedItemDto, { type: 'WAT' });
    expect(errors.map((e) => e.property)).toContain('type');
  });
});
