import { ChangeEmailDto } from './change-email.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('ChangeEmailDto', () => {
  it('accepts a valid email', async () => {
    const errors = await validateDto(ChangeEmailDto, { newEmail: 'new@example.com' });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid email', async () => {
    const errors = await validateDto(ChangeEmailDto, { newEmail: 'not-email' });
    expect(errors.some((e) => e.property === 'newEmail')).toBe(true);
  });
});
