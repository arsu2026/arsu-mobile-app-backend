import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('UpdateNotificationPreferencesDto', () => {
  it('accepts an empty body (no-op update)', async () => {
    const errors = await validateDto(UpdateNotificationPreferencesDto, {});
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial nested body', async () => {
    const errors = await validateDto(UpdateNotificationPreferencesDto, {
      preferences: { comments: false },
      channels: { email: true },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean preference flag', async () => {
    const errors = await validateDto(UpdateNotificationPreferencesDto, {
      preferences: { comments: 'yes' },
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
