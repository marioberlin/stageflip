// packages/runtimes/interactive/src/permission-flow/i18n-posture.test.ts
// T-385 AC #18 — pin the i18n posture: no hardcoded English UI strings inside
// `permission-flow/**`. CLAUDE.md §10 + D-T385-1 require all user-facing text
// to flow through the host application's i18n catalogue. This test is a grep
// against the source files in this directory.
//
// The matcher allow-lists strings that are NOT user-facing copy: type
// discriminators, ARIA roles, data-attribute slot names, error-message
// templates referenced by a JSDoc cross-link, etc. The list is intentionally
// short — anything outside it must come from a `messages` prop.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILES = readdirSync(HERE).filter(
  (f) =>
    (f.endsWith('.ts') || f.endsWith('.tsx')) &&
    !f.endsWith('.test.ts') &&
    !f.endsWith('.test.tsx'),
);

/**
 * Words that, if found inside a quoted string, would suggest user-facing
 * English copy leaked into the package. The list is illustrative — a real
 * regression would catch a noun like "Microphone" or "Permission" in copy
 * position. Discriminator literals + data-attribute names are scoped out
 * via the per-line allow-list below.
 */
const SUSPECT_WORDS = [
  /\bMicrophone\b/i,
  /\bCamera\b/i,
  /\bAllow\b/,
  /\bDeny\b/,
  /\bRetry\b/,
  /\bSettings\b/,
  /\bClick\b/i,
  /\bPlease\b/i,
  /\bblocked\b/i,
];

/**
 * Per-line allow-list for technical strings that legitimately appear in the
 * code (e.g., ARIA roles, telemetry event names, data attribute names).
 */
const ALLOW_PATTERNS: RegExp[] = [
  /role="(alert|dialog)"/,
  /aria-modal="true"/,
  /data-testid/,
  /data-stageflip-/,
  /'permission\..+'/,
  /'permission-denied'/,
  /'tenant-denied'/,
  /'pre-prompt-cancelled'/,
  /'pre-prompt'/,
  /'requesting'/,
  /'granted'/,
  /'denied'/,
  /'idle'/,
  /'mic'|'camera'|'network'/,
];

/**
 * Strip block comments (/* ... *\/) from source, replacing them with an
 * equal number of newlines so per-line offsets stay correct.
 */
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

describe('i18n posture (AC #18)', () => {
  it('no hardcoded English UI copy in permission-flow source', () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const file of SOURCE_FILES) {
      const path = join(HERE, file);
      const stripped = stripBlockComments(readFileSync(path, 'utf8'));
      const lines = stripped.split('\n');
      lines.forEach((rawLine, idx) => {
        // Strip line comments — they explain intent and may legitimately
        // describe user-facing copy without producing it.
        const commentStart = rawLine.indexOf('//');
        const code = commentStart >= 0 ? rawLine.slice(0, commentStart) : rawLine;
        if (ALLOW_PATTERNS.some((p) => p.test(code))) return;
        for (const suspect of SUSPECT_WORDS) {
          if (suspect.test(code)) {
            // Only flag if the suspect appears inside a quoted string.
            // Heuristic: look for a quote on the same line.
            if (/['"`]/.test(code)) {
              offenders.push({ file, line: idx + 1, text: rawLine.trim() });
            }
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
