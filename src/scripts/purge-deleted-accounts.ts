import { supabaseAdmin } from '../config/supabase.config';
import { logger } from '../common/utils/logger';
import * as repo from '../modules/settings/settings.repository';

/**
 * Hard-deletes accounts whose 30-day grace window has elapsed. Intended to run
 * on a daily schedule (cron / scheduled job). Deleting the Supabase auth user
 * cascades to the profile row and all owned data via the existing FKs.
 */
export async function purgeDeletedAccounts(now: Date = new Date()): Promise<{ purged: number }> {
  const profiles = await repo.findPurgeableProfiles(now);
  let purged = 0;

  for (const profile of profiles) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
    if (error) {
      logger.error(`Failed to purge account ${profile.id}: ${error.message}`);
      continue;
    }
    purged += 1;
  }

  logger.info(`Purged ${purged} deleted account(s)`);
  return { purged };
}

if (require.main === module) {
  purgeDeletedAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Purge job failed', err);
      process.exit(1);
    });
}
