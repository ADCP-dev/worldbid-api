/**
 * Wikilink helpers shared by NoteService and NoteRepository.
 *
 * Extracted [[titles]] come from stored HTML (markdown-it escapes entities),
 * and refs must be compared against note titles without brittle exact-case
 * matching. Both concerns live here as pure functions.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|nbsp|#[0-9]+|#x[0-9a-fA-F]+);/g;

/**
 * Decode common named and numeric HTML entities in a single pass so titles
 * extracted from stored HTML ("A &amp; B") match the real note title
 * ("A & B"). Handles named entities and numeric references in decimal
 * (&#39;), and hexadecimal (&#x1F600;) form. Unknown entities are left
 * untouched, and a single-pass replace avoids cascading double-decoding.
 */
export function decodeHtmlEntities(input: string): string {
  return input.replace(ENTITY_PATTERN, (match, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const codePoint = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (
        !Number.isInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff
      ) {
        return match;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/**
 * Normalize a title (or wikilink ref) for comparison: trim, collapse
 * internal whitespace, lowercase. The SQL side mirrors this with
 * `LOWER(note.title) = LOWER(:title)` exact equality.
 */
export function normalizeTitleForMatch(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}
