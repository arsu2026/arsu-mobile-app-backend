import { EmailLoginDto } from './email-login.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

const validatePayload = (payload: Record<string, unknown>) => validateDto(EmailLoginDto, payload);

describe('EmailLoginDto', () => {
  it('accepts a valid email and non-empty password', async () => {
    const errors = await validatePayload({
      email: 'user@example.com',
      password: 'anything',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validatePayload({
      email: 'not-an-email',
      password: 'anything',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an empty password', async () => {
    const errors = await validatePayload({
      email: 'user@example.com',
      password: '',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  // Login deliberately does NOT disclose the signup password policy:
  // a long password is a *credential attempt*, not a validation error.
  it('does not impose a max length on the password', async () => {
    const errors = await validatePayload({
      email: 'user@example.com',
      password: 'a'.repeat(200),
    });
    expect(errors.some((e) => e.property === 'password')).toBe(false);
  });
});
