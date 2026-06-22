import { ForgotPasswordDto } from './forgot-password.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

const validatePayload = (payload: Record<string, unknown>) =>
  validateDto(ForgotPasswordDto, payload);

describe('ForgotPasswordDto', () => {
  it('accepts a valid email', async () => {
    const errors = await validatePayload({ email: 'user@example.com' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validatePayload({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const errors = await validatePayload({});
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
