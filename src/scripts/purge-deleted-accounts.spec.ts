jest.mock('../config/supabase.config');
jest.mock('../modules/settings/settings.repository');
jest.mock('../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { supabaseAdmin } from '../config/supabase.config';
import * as repo from '../modules/settings/settings.repository';
import { purgeDeletedAccounts } from './purge-deleted-accounts';

const mockFind = repo.findPurgeableProfiles as jest.Mock;
const mockDeleteUser = supabaseAdmin.auth.admin.deleteUser as jest.Mock;

describe('purgeDeletedAccounts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes each purgeable account', async () => {
    mockFind.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockDeleteUser.mockResolvedValue({ data: {}, error: null });
    const result = await purgeDeletedAccounts(new Date('2026-07-20T00:00:00.000Z'));
    expect(mockDeleteUser).toHaveBeenCalledTimes(2);
    expect(result.purged).toBe(2);
  });

  it('continues when one deletion fails', async () => {
    mockFind.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockDeleteUser
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      .mockResolvedValueOnce({ data: {}, error: null });
    const result = await purgeDeletedAccounts(new Date('2026-07-20T00:00:00.000Z'));
    expect(result.purged).toBe(1);
  });
});
