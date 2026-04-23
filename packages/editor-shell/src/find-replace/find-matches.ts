// packages/editor-shell/src/find-replace/find-matches.ts
// Pure text-match discovery over slide-mode documents (T-139c).

import type { Document } from '@stageflip/schema';
import type { FindMatch, FindOptions } from './types';

/**
 * Scan every text element in a slide-mode document and return a
 * deterministic, slide-then-element-ordered array of matches.
 *
 * Non-text elements are skipped. A non-slide-mode `Document` (video /
 * display) yields an empty array — the editor routes those to the
 * right mode-specific searcher, but a guard here keeps this function
 * total.
 *
 * `query` of `''` yields `[]`. An invalid regex in `regex: true` mode
 * yields `[]` as well; callers that need to signal "invalid regex"
 * distinctly should compile their own pattern up front and gate the
 * call.
 */
export function findMatches(
  doc: Document | null,
  query: string,
  options: FindOptions = {},
): FindMatch[] {
  if (!doc || doc.content.mode !== 'slide' || query === '') return [];

  const { caseSensitive = false, wholeWord = false, regex = false } = options;

  let pattern: RegExp | null = null;
  if (regex) {
    try {
      pattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } catch {
      return [];
    }
  }

  const out: FindMatch[] = [];
  doc.content.slides.forEach((slide, slideIndex) => {
    for (const el of slide.elements) {
      if (el.type !== 'text') continue;
      const text = el.text;
      if (text === '') continue;

      if (pattern) {
        pattern.lastIndex = 0;
        for (const m of text.matchAll(pattern)) {
          const matched = m[0];
          if (matched.length === 0) continue;
          out.push({
            slideId: slide.id,
            slideIndex,
            elementId: el.id,
            elementText: text,
            start: m.index ?? 0,
            length: matched.length,
          });
        }
      } else {
        const needle = caseSensitive ? query : query.toLowerCase();
        const hay = caseSensitive ? text : text.toLowerCase();
        let pos = 0;
        while (pos <= hay.length) {
          const at = hay.indexOf(needle, pos);
          if (at < 0) break;
          if (!wholeWord || isWholeWord(text, at, query.length)) {
            out.push({
              slideId: slide.id,
              slideIndex,
              elementId: el.id,
              elementText: text,
              start: at,
              length: query.length,
            });
          }
          pos = at + Math.max(1, query.length);
        }
      }
    }
  });
  return out;
}

/**
 * True iff the character-class boundaries around `[at, at+len)` are
 * non-word on the outside (or end-of-string). Consistent with
 * `\b` — word characters are `[A-Za-z0-9_]`.
 */
function isWholeWord(text: string, at: number, len: number): boolean {
  const before = at > 0 ? text[at - 1] : '';
  const after = at + len < text.length ? text[at + len] : '';
  return !isWordChar(before) && !isWordChar(after);
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9_]/.test(ch);
}
