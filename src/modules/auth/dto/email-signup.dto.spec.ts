import { EmailSignupDto } from './email-signup.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

const validatePayload = (payload: Record<string, unknown>) => validateDto(EmailSignupDto, payload);

describe('EmailSignupDto', () => {
  it('accepts a valid email and password', async () => {
    const errors = await validatePayload({
      email: 'user@example.com',
      password: 'strongpass123',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validatePayload({
      email: 'not-an-email',
      password: 'strongpass123',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validatePayload({
      email: 'user@example.com',
      password: 'short',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password longer than 72 characters (bcrypt limit)', async () => {
    const errors = await validatePayload({
      email: 'user@example.com',
      password: 'a'.repeat(73),
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a missing password', async () => {
    const errors = await validatePayload({ email: 'user@example.com' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
