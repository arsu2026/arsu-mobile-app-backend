import { validateDto } from '../../../../test/helpers/validate-dto';
import { VerifyTwoFactorDto } from './verify-two-factor.dto';

describe('VerifyTwoFactorDto', () => {
  it('accepts a 6-digit code', async () => {
    const errors = await validateDto(VerifyTwoFactorDto, { code: '123456' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a short code', async () => {
    const errors = await validateDto(VerifyTwoFactorDto, { code: '123' });
    expect(errors.map((e) => e.property)).toContain('code');
  });
});
