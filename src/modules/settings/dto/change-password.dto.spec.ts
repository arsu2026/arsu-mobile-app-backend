import { ChangePasswordDto } from './change-password.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('ChangePasswordDto', () => {
  it('accepts valid passwords', async () => {
    const errors = await validateDto(ChangePasswordDto, {
      currentPassword: 'oldpass12',
      newPassword: 'newpass12',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects short new password', async () => {
    const errors = await validateDto(ChangePasswordDto, {
      currentPassword: 'oldpass12',
      newPassword: 'short',
    });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});
