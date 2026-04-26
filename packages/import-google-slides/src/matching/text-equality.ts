// packages/import-google-slides/src/matching/text-equality.ts
// Unicode-normalized, case-sensitive text equality for matching API
// `shape.text` against CV `textLine.text`. Per T-244 spec §5 axis #1:
// "build the API element's text string by concatenating its
// `textElements[].textRun.content`; find the CV `textLine` whose normalized
// text matches (Unicode NFC + collapsed whitespace + case-sensitive)".

/** Normalize a candidate string: NFC + collapse whitespace runs to single spaces + trim. */
export function normalizeForMatch(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Case-sensitive equality after NFC + whitespace collapse. AC #14 (NFC),
 * AC #15 (whitespace), AC #16 (case-sensitive).
 */
export function textsMatch(a: string, b: string): boolean {
  return normalizeForMatch(a) === normalizeForMatch(b);
}
