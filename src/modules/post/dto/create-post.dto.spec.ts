import { CreatePostDto } from './create-post.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('CreatePostDto', () => {
  it('accepts content only', async () => {
    const errors = await validateDto(CreatePostDto, { content: 'hello world' });
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload (photos may be the only content)', async () => {
    const errors = await validateDto(CreatePostDto, {});
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid privacy value', async () => {
    const errors = await validateDto(CreatePostDto, { privacy: 'SECRET' });
    expect(errors.some((e) => e.property === 'privacy')).toBe(true);
  });

  it('rejects content longer than 5000 chars', async () => {
    const errors = await validateDto(CreatePostDto, { content: 'a'.repeat(5001) });
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });
});
