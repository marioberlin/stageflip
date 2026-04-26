// packages/import-google-slides/src/matching/text-equality.test.ts
// Pin AC #13-16: text equality (literal), NFC normalization, whitespace
// collapse, case sensitivity.

import { describe, expect, it } from 'vitest';
import { normalizeForMatch, textsMatch } from './text-equality.js';

describe('textsMatch', () => {
  it('AC #13: literal-equal strings match', () => {
    expect(textsMatch('Quarterly Revenue', 'Quarterly Revenue')).toBe(true);
  });

  it('AC #14: NFC normalization — composed "café" matches decomposed "café"', () => {
    const composed = '\u00e9'; // é
    const decomposed = 'e\u0301'; // e + combining acute
    expect(`caf${composed}`).not.toBe(`caf${decomposed}`); // sanity
    expect(textsMatch(`caf${composed}`, `caf${decomposed}`)).toBe(true);
  });

  it('AC #15: whitespace collapse — "  Hello   World  " matches "Hello World"', () => {
    expect(textsMatch('  Hello   World  ', 'Hello World')).toBe(true);
  });

  it('AC #16: case-sensitive — "Hello" does NOT match "hello"', () => {
    expect(textsMatch('Hello', 'hello')).toBe(false);
  });

  it('normalizeForMatch is idempotent', () => {
    const once = normalizeForMatch('  á   b  ');
    expect(normalizeForMatch(once)).toBe(once);
  });
});
