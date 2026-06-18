/**
 * Normalizes a raw phone string to digits with an optional leading '+'.
 * Returns null when the result is outside E.164 length bounds (7–15 digits).
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}
