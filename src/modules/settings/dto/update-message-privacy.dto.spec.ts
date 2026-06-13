import { UpdateMessagePrivacyDto } from './update-message-privacy.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('UpdateMessagePrivacyDto', () => {
  it('accepts valid message permission', async () => {
    const errors = await validateDto(UpdateMessagePrivacyDto, { messagesFrom: 'FOLLOWERS' });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid message permission', async () => {
    const errors = await validateDto(UpdateMessagePrivacyDto, { messagesFrom: 'INVALID' });
    expect(errors.some((e) => e.property === 'messagesFrom')).toBe(true);
  });
});
