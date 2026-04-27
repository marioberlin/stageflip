// packages/import-hyperframes-html/src/captions/emit.ts
// Reverse direction of `extract.ts`: serialize a CaptionTrack back to a
// `<script>` block matching the recognized inbound shape per T-247 spec §7.
// Output is deterministic — no per-call timestamps, no whitespace
// instability — so the round-trip suite (AC #32) can compare byte-for-byte.

import type { CaptionTrack } from '@stageflip/schema';

/**
 * Serialize a `CaptionTrack` to the inline `<script>` JSON shape Hyperframes
 * producers emit. The resulting block is wrapped in an IIFE so it can be
 * dropped into a master HTML body without leaking globals.
 */
export function emitTranscriptScript(captions: CaptionTrack): string {
  const lines: string[] = [];
  lines.push('(function () {');
  // Quote the keys + drop trailing commas so the array literal is parseable
  // as JSON on the import side (the regex captures the literal verbatim and
  // runs JSON.parse on it).
  const entries = captions.segments.map((seg) => {
    const start = seg.startMs / 1000;
    const end = seg.endMs / 1000;
    return `    { "text": ${JSON.stringify(seg.text)}, "start": ${start}, "end": ${end} }`;
  });
  lines.push('  const TRANSCRIPT = [');
  lines.push(entries.join(',\n'));
  lines.push('  ];');
  lines.push('  window.__transcript = TRANSCRIPT;');
  lines.push('})();');
  return lines.join('\n');
}
