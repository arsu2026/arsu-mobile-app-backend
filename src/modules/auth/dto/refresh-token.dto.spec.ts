import { RefreshTokenDto } from './refresh-token.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

const validatePayload = (payload: Record<string, unknown>) => validateDto(RefreshTokenDto, payload);

describe('RefreshTokenDto', () => {
  it('accepts a non-empty refresh token', async () => {
    const errors = await validatePayload({ refresh_token: 'a-refresh-token' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing refresh token', async () => {
    const errors = await validatePayload({});
    expect(errors.some((e) => e.property === 'refresh_token')).toBe(true);
  });

  it('rejects an empty refresh token', async () => {
    const errors = await validatePayload({ refresh_token: '' });
    expect(errors.some((e) => e.property === 'refresh_token')).toBe(true);
  });
});
