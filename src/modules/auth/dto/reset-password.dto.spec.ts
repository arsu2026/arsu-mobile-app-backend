import { ResetPasswordDto } from './reset-password.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

const validPayload = {
  email: 'user@example.com',
  token: '123456',
  password: 'strongpass123',
};

const validatePayload = (payload: Record<string, unknown>) =>
  validateDto(ResetPasswordDto, payload);

describe('ResetPasswordDto', () => {
  it('accepts a valid email, token, and password', async () => {
    const errors = await validatePayload(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validatePayload({ ...validPayload, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing token', async () => {
    const errors = await validatePayload({
      email: validPayload.email,
      password: validPayload.password,
    });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects an empty token', async () => {
    const errors = await validatePayload({ ...validPayload, token: '' });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validatePayload({ ...validPayload, password: 'short' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password longer than 72 characters (bcrypt limit)', async () => {
    const errors = await validatePayload({ ...validPayload, password: 'a'.repeat(73) });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a missing password', async () => {
    const errors = await validatePayload({ email: validPayload.email, token: validPayload.token });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
