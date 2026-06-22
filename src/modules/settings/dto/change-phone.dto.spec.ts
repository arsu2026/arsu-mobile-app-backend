import { ChangePhoneDto } from './change-phone.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('ChangePhoneDto', () => {
  it('accepts a valid phone number', async () => {
    const errors = await validateDto(ChangePhoneDto, { newPhone: '+1 555-123-4567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid phone format', async () => {
    const errors = await validateDto(ChangePhoneDto, { newPhone: 'abc' });
    expect(errors.some((e) => e.property === 'newPhone')).toBe(true);
  });
});
