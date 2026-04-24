// packages/captions/src/pack.ts
// Word-list → CaptionSegment packing (T-184). The algorithm walks the
// Whisper output left-to-right, greedily filling lines to `maxCharsPerLine`
// and lines to `maxLines`. When either limit triggers, the accumulated
// buffer is emitted as a CaptionSegment and packing continues with the
// next word.
//
// Determinism: pure function of (words, options). Same inputs always
// produce byte-identical output.
//
// Out of scope here: per-aspect bouncing (T-185 re-packs with a tighter
// `maxCharsPerLine` for 9:16).

import type { CaptionSegment, PackOptions, TranscriptWord } from './types.js';

const DEFAULT_MIN_SEGMENT_MS = 400;

/**
 * Pack Whisper-style words into readable caption segments.
 *
 * Rules:
 * - Each segment is at most `maxLines × maxCharsPerLine` characters of
 *   text (excluding trailing spaces), packed greedily.
 * - A word that alone exceeds `maxCharsPerLine` starts its own segment
 *   and may overflow (no mid-word breaking).
 * - Segment `startMs` is the first word's start; `endMs` is the last
 *   word's end, raised to `startMs + minSegmentMs` when the segment
 *   would otherwise flash on-screen.
 * - Empty input returns an empty array.
 */
export function packWords(
  words: readonly TranscriptWord[],
  options: PackOptions,
): CaptionSegment[] {
  if (words.length === 0) return [];
  const { maxCharsPerLine, maxLines } = options;
  if (maxCharsPerLine <= 0 || maxLines <= 0) return [];
  const minSegmentMs = options.minSegmentMs ?? DEFAULT_MIN_SEGMENT_MS;

  const out: CaptionSegment[] = [];
  let bufferLines: string[] = [''];
  let bufferWords: TranscriptWord[] = [];

  const flush = (): void => {
    if (bufferWords.length === 0) return;
    const text = bufferLines
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
      .join('\n');
    const first = bufferWords[0];
    const last = bufferWords[bufferWords.length - 1];
    if (first === undefined || last === undefined) return;
    const startMs = first.startMs;
    const endMs = Math.max(last.endMs, startMs + minSegmentMs);
    out.push({ startMs, endMs, text });
    bufferLines = [''];
    bufferWords = [];
  };

  for (const word of words) {
    const currentLineIndex = bufferLines.length - 1;
    const currentLine = bufferLines[currentLineIndex] ?? '';
    const candidate = currentLine.length === 0 ? word.text : `${currentLine} ${word.text}`;
    if (candidate.length <= maxCharsPerLine) {
      bufferLines[currentLineIndex] = candidate;
      bufferWords.push(word);
      continue;
    }
    // Current line is full. Can we start a new line?
    if (bufferLines.length < maxLines) {
      bufferLines.push(word.text);
      bufferWords.push(word);
      continue;
    }
    // Out of lines — flush and start a new segment with this word.
    flush();
    bufferLines = [word.text];
    bufferWords = [word];
  }
  flush();
  return out;
}
