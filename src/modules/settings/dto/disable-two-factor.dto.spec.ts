import { validateDto } from '../../../../test/helpers/validate-dto';
import { DisableTwoFactorDto } from './disable-two-factor.dto';

describe('DisableTwoFactorDto', () => {
  it('accepts a password', async () => {
    const errors = await validateDto(DisableTwoFactorDto, { password: 'pass1234' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing password', async () => {
    const errors = await validateDto(DisableTwoFactorDto, {});
    expect(errors.map((e) => e.property)).toContain('password');
  });
});
