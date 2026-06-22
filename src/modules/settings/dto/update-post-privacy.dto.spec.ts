import { UpdatePostPrivacyDto } from './update-post-privacy.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('UpdatePostPrivacyDto', () => {
  it('accepts valid visibility level', async () => {
    const errors = await validateDto(UpdatePostPrivacyDto, { postsVisibility: 'PUBLIC' });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid visibility level', async () => {
    const errors = await validateDto(UpdatePostPrivacyDto, { postsVisibility: 'INVALID' });
    expect(errors.some((e) => e.property === 'postsVisibility')).toBe(true);
  });
});
