import { normalizePhone } from './phone.util';

describe('normalizePhone', () => {
  it('strips spaces, dashes and parens', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('keeps a plain national number as digits', () => {
    expect(normalizePhone('01711-223344')).toBe('01711223344');
  });

  it('returns null for too-short input', () => {
    expect(normalizePhone('123')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull();
  });
});
