export interface ContactInput {
  phone: string;
  name?: string;
}

export interface ContactMatch {
  phone: string;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null };
}

export interface SyncContactsResult {
  syncedCount: number;
  matchedCount: number;
  matches: ContactMatch[];
}
