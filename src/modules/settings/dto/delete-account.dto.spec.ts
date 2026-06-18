import { validateDto } from '../../../../test/helpers/validate-dto';
import { DeleteAccountDto } from './delete-account.dto';

describe('DeleteAccountDto', () => {
  it('accepts a password', async () => {
    const errors = await validateDto(DeleteAccountDto, { password: 'pass1234' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing password', async () => {
    const errors = await validateDto(DeleteAccountDto, {});
    expect(errors.map((e) => e.property)).toContain('password');
  });
});
