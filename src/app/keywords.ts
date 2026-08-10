/**
 * Words you would search for, written on a slip after the fact.
 *
 * `a123fff4` is a password, and nothing about those eight characters will ever
 * come to mind when you go looking for it. A keyword is the handle: write "lol"
 * on the slip and searching "lol" finds it.
 *
 * This is deliberately not a tag system. There is no keyword list, no
 * autocomplete, and no browsing by keyword — those turn filing into a chore, and
 * a chore is the thing this product refuses to add. A keyword belongs to one slip
 * and exists only to be searched.
 *
 * It is also never part of capture. Nothing asks for a keyword while a slip is
 * being made; the field appears afterwards, when you have a reason to want one.
 */

/** Enough to find a thing, few enough that the slip stays a slip. */
const MAX_KEYWORDS = 8;
const MAX_LENGTH = 24;

/**
 * Split on commas and newlines only, never on spaces, so "kredi kartı" stays one
 * keyword rather than becoming two useless ones.
 */
export function parseKeywords(input: string): string[] {
  const seen = new Set<string>();

  for (const part of input.split(/[,\n]/)) {
    const word = part.trim().toLowerCase().slice(0, MAX_LENGTH);
    if (word) seen.add(word);
    if (seen.size >= MAX_KEYWORDS) break;
  }

  return [...seen];
}

/** How a slip's keywords read back into the field that edits them. */
export function formatKeywords(keywords: readonly string[] | undefined): string {
  return keywords?.join(', ') ?? '';
}

/** Keeps imported and hand-edited data to the same shape as parsed input. */
export function sanitizeKeywords(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keywords = parseKeywords(value.filter((item) => typeof item === 'string').join('\n'));
  return keywords.length ? keywords : undefined;
}
