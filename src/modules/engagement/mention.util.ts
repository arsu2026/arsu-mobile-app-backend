const MENTION_REGEX = /@([a-zA-Z0-9_]{1,30})/g;

/**
 * Extracts @mention handles from text. Returns unique handles (without the
 * leading @), deduped case-insensitively, preserving the first-seen casing.
 */
export function parseMentions(content: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of content.matchAll(MENTION_REGEX)) {
    const handle = match[1];
    const key = handle.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(handle);
    }
  }
  return result;
}
