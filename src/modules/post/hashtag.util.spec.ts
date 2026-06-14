import { extractHashtags } from './hashtag.util';

describe('extractHashtags', () => {
  it('extracts unique, lowercased tags', () => {
    expect(extractHashtags('Love #Coding and #coding and #Travel')).toEqual([
      'coding',
      'travel',
    ]);
  });

  it('returns [] for null or empty content', () => {
    expect(extractHashtags(null)).toEqual([]);
    expect(extractHashtags('')).toEqual([]);
  });

  it('ignores a lone # and trailing punctuation', () => {
    expect(extractHashtags('a # b #c! #d.')).toEqual(['c', 'd']);
  });
});
