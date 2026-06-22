import { validateDto } from '../../../../../test/helpers/validate-dto';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a valid email + password', async () => {
    const errors = await validateDto(LoginDto, { email: 'admin@arsu.app', password: 'password123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto(LoginDto, { email: 'not-an-email', password: 'password123' });
    expect(errors.map((e) => e.property)).toContain('email');
  });

  it('rejects a password shorter than 8 chars', async () => {
    const errors = await validateDto(LoginDto, { email: 'admin@arsu.app', password: 'short' });
    expect(errors.map((e) => e.property)).toContain('password');
  });
});
