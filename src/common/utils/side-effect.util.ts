import { logger } from './logger';

/**
 * Runs a side-effect that must never break the core action. On rejection the
 * error is logged (with the label) and swallowed — the caller's flow continues.
 */
export async function bestEffort(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error(`side-effect failed: ${label}`, err);
  }
}
