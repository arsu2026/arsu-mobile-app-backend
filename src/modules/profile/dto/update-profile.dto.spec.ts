import { validateDto } from '../../../../test/helpers/validate-dto';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('accepts a valid partial update', async () => {
    const errors = await validateDto(UpdateProfileDto, {
      fullName: 'Jane Doe',
      username: 'jane_doe',
      bio: 'Hello world',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid username characters', async () => {
    const errors = await validateDto(UpdateProfileDto, { username: 'bad name!' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects bio longer than 500 characters', async () => {
    const errors = await validateDto(UpdateProfileDto, { bio: 'x'.repeat(501) });
    expect(errors.length).toBeGreaterThan(0);
  });
});
