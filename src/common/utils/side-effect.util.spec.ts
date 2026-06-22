jest.mock('./logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { bestEffort } from './side-effect.util';
import { logger } from './logger';

describe('bestEffort', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs the function and does not log on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await bestEffort('test', fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('swallows rejections and logs them with the label', async () => {
    const boom = new Error('boom');
    const fn = jest.fn().mockRejectedValue(boom);
    await expect(bestEffort('like-notif', fn)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('side-effect failed: like-notif', boom);
  });
});
