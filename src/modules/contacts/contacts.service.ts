import * as repo from './contacts.repository';
import { normalizePhone } from '../../common/utils/phone.util';
import type { ContactInput, ContactMatch, SyncContactsResult } from './contacts.types';

export async function syncContacts(userId: string, contacts: ContactInput[]): Promise<SyncContactsResult> {
  const normalized = new Set<string>();
  for (const c of contacts) {
    const phone = normalizePhone(c.phone);
    if (phone) normalized.add(phone);
  }
  const phones = [...normalized];

  const profiles = await repo.findVerifiedProfilesByPhones(phones);
  const matches: ContactMatch[] = profiles
    .filter((p) => p.phone !== null && p.profile.id !== userId)
    .map((p) => ({
      phone: p.phone as string,
      user: {
        id: p.profile.id,
        fullName: p.profile.fullName,
        username: p.profile.username,
        avatarUrl: p.profile.avatarUrl,
      },
    }));

  await repo.addContacts(userId, matches.map((m) => m.user.id));

  return { syncedCount: phones.length, matchedCount: matches.length, matches };
}
