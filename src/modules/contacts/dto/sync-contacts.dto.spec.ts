import { validateDto } from '../../../../test/helpers/validate-dto';
import { SyncContactsDto } from './sync-contacts.dto';

describe('SyncContactsDto', () => {
  it('accepts a valid contacts array', async () => {
    const errors = await validateDto(SyncContactsDto, {
      contacts: [{ phone: '+15551234567', name: 'Sam' }, { phone: '01711223344' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a contact with a too-short phone', async () => {
    const errors = await validateDto(SyncContactsDto, { contacts: [{ phone: '1' }] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more than 1000 contacts', async () => {
    const contacts = Array.from({ length: 1001 }, () => ({ phone: '+15551234567' }));
    const errors = await validateDto(SyncContactsDto, { contacts });
    expect(errors.map((e) => e.property)).toContain('contacts');
  });
});
