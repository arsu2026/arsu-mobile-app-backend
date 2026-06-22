jest.mock('./contacts.repository');

import * as repo from './contacts.repository';
import { syncContacts } from './contacts.service';

const mockFindProfiles = repo.findVerifiedProfilesByPhones as jest.Mock;
const mockAddContacts = repo.addContacts as jest.Mock;

const USER = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';

describe('contacts.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddContacts.mockResolvedValue({ count: 1 });
  });

  it('dedupes normalized phones for syncedCount and matches verified profiles', async () => {
    mockFindProfiles.mockResolvedValue([
      { phone: '+15551234567', profile: { id: FRIEND, fullName: 'Friend', username: 'friend', avatarUrl: null } },
    ]);
    const result = await syncContacts(USER, [
      { phone: '+1 (555) 123-4567' },
      { phone: '+15551234567' }, // same number, different formatting → deduped
      { phone: '01711223344' },
    ]);
    expect(result.syncedCount).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.matches[0].user.id).toBe(FRIEND);
    expect(mockAddContacts).toHaveBeenCalledWith(USER, [FRIEND]);
  });

  it('excludes the user themselves from matches', async () => {
    mockFindProfiles.mockResolvedValue([
      { phone: '+15551234567', profile: { id: USER, fullName: 'Me', username: 'me', avatarUrl: null } },
    ]);
    const result = await syncContacts(USER, [{ phone: '+15551234567' }]);
    expect(result.matchedCount).toBe(0);
    expect(mockAddContacts).toHaveBeenCalledWith(USER, []);
  });
});
