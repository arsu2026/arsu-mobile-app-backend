/**
 * Extract unique, lowercased hashtag names (without the leading '#') from post
 * text. `#Coding` and `#coding` collapse to one tag; lone '#' and punctuation
 * are ignored.
 */
export function extractHashtags(content: string | null | undefined): string[] {
  if (!content) return [];
  const matches = content.match(/#(\w+)/g) ?? [];
  const tags = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(tags)];
}
