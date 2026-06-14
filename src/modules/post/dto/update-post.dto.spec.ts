import { UpdatePostDto } from './update-post.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('UpdatePostDto', () => {
  it('accepts a partial update', async () => {
    const errors = await validateDto(UpdatePostDto, { content: 'edited' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a privacy-only update', async () => {
    const errors = await validateDto(UpdatePostDto, { privacy: 'ONLY_ME' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid privacy value', async () => {
    const errors = await validateDto(UpdatePostDto, { privacy: 'NOPE' });
    expect(errors.some((e) => e.property === 'privacy')).toBe(true);
  });
});
