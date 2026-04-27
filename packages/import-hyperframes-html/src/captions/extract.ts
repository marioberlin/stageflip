// packages/import-hyperframes-html/src/captions/extract.ts
// Hyperframes inline-transcript extractor. The producer's pattern (per
// reference fixture style-10-prod) emits `const TRANSCRIPT = [{text, start,
// end}, ...]` inside a `<script>` block. T-247 spec §6 + AC #24 / #25:
//
// - Recognized shape: each entry is `{text: string, start: number, end:
//   number}`. Extra fields per entry skip that entry (NOT the whole array).
// - Missing required fields → CAPTIONS-UNRECOGNIZED on the entire array; the
//   resulting `videoContent.captions` is omitted.

import type { CaptionTrack } from '@stageflip/schema';

/** Result of `extractTranscript`. */
export type TranscriptExtraction =
  | { kind: 'none' } // No `TRANSCRIPT = [...]` substring found in the script.
  | { kind: 'captions'; captions: CaptionTrack }
  | { kind: 'unrecognized'; reason: string };

const TRANSCRIPT_RE = /(?:const|let|var)\s+TRANSCRIPT\s*=\s*(\[[\s\S]*?\])\s*;?/;
const WINDOW_TRANSCRIPT_RE = /window\.__transcript\s*=\s*(\[[\s\S]*?\])\s*;?/;

interface RawEntry {
  text?: unknown;
  start?: unknown;
  end?: unknown;
  [k: string]: unknown;
}

/**
 * Parse a script source string and return the transcript embedded in it. The
 * regex finds `const TRANSCRIPT = [...]` (or `window.__transcript = [...]`);
 * a JSON.parse runs over the array. Strict shape match: each entry must be
 * `{text: string, start: number, end: number}` and have NO extra fields. Any
 * extra-field entry is skipped; any missing-required-field entry causes the
 * whole array to fail recognition.
 */
export function extractTranscript(scriptText: string): TranscriptExtraction {
  const matched = TRANSCRIPT_RE.exec(scriptText) ?? WINDOW_TRANSCRIPT_RE.exec(scriptText);
  if (matched === null) return { kind: 'none' };
  const arrLiteral = matched[1];
  if (arrLiteral === undefined) return { kind: 'none' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(arrLiteral);
  } catch {
    return { kind: 'unrecognized', reason: 'array literal failed JSON.parse' };
  }
  if (!Array.isArray(parsed)) {
    return { kind: 'unrecognized', reason: 'TRANSCRIPT is not an array' };
  }

  const segments: { startMs: number; endMs: number; text: string }[] = [];
  for (const raw of parsed as RawEntry[]) {
    if (raw === null || typeof raw !== 'object') {
      return { kind: 'unrecognized', reason: 'entry is not an object' };
    }
    const text = raw.text;
    const start = raw.start;
    const end = raw.end;
    if (typeof text !== 'string' || typeof start !== 'number' || typeof end !== 'number') {
      return { kind: 'unrecognized', reason: 'entry missing required {text, start, end}' };
    }
    const keys = Object.keys(raw);
    // Reject extra fields per spec: skip this entry, but don't fail the array.
    if (
      keys.length !== 3 ||
      !keys.includes('text') ||
      !keys.includes('start') ||
      !keys.includes('end')
    ) {
      continue;
    }
    if (text.length === 0) continue; // schema forbids empty caption text.
    const startMs = Math.round(start * 1000);
    const endMs = Math.round(end * 1000);
    if (endMs <= startMs) continue; // schema requires endMs > startMs.
    segments.push({ startMs, endMs, text });
  }

  if (segments.length === 0) {
    return { kind: 'unrecognized', reason: 'no recognizable entries' };
  }
  return {
    kind: 'captions',
    captions: { lang: 'en', segments },
  };
}
