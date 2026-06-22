import { parseMentions } from './mention.util';

describe('parseMentions', () => {
  it('returns [] when there are no mentions', () => {
    expect(parseMentions('just a plain comment')).toEqual([]);
  });

  it('extracts a single mention without the @', () => {
    expect(parseMentions('hey @alice nice post')).toEqual(['alice']);
  });

  it('extracts multiple unique mentions, deduping case-insensitively (first case wins)', () => {
    expect(parseMentions('@Bob and @bob and @carol')).toEqual(['Bob', 'carol']);
  });

  it('ignores email-like @ and stops at non-handle chars', () => {
    expect(parseMentions('mail me at x@y.com and ping @dan!')).toEqual(['y', 'dan']);
  });
});
