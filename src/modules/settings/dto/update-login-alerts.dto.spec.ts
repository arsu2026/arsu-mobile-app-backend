import { validateDto } from '../../../../test/helpers/validate-dto';
import { UpdateLoginAlertsDto } from './update-login-alerts.dto';

describe('UpdateLoginAlertsDto', () => {
  it('accepts a boolean', async () => {
    const errors = await validateDto(UpdateLoginAlertsDto, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean', async () => {
    const errors = await validateDto(UpdateLoginAlertsDto, { enabled: 'yes' });
    expect(errors.map((e) => e.property)).toContain('enabled');
  });
});
