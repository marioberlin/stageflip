// packages/import-hyperframes-html/src/tracks/classify.ts
// Track-kind heuristics per T-247 spec §3. Hyperframes compositions don't
// carry a track-kind enum; the importer derives one from the composition id +
// track index + content shape. The heuristic is documented in
// skills/stageflip/workflows/import-hyperframes-html/SKILL.md so future
// producers can target it deterministically.

import type { TrackKind } from '@stageflip/schema';

/**
 * Classification input. The classifier doesn't traverse children itself; the
 * caller pre-walks each composition to compute the booleans below.
 */
export interface ClassifyInput {
  compositionId: string;
  trackIndex: number;
  /** True if the composition contains at least one media element with no visual children. */
  audioOnly: boolean;
}

/**
 * Classify a Hyperframes composition into a canonical track kind.
 * Order is significant: caption-name match wins first; index-0 + main prefix
 * wins next; audio-only wins after that; everything else is `'overlay'`.
 */
export function classifyTrackKind(input: ClassifyInput): TrackKind {
  const id = input.compositionId.toLowerCase();
  if (/^caption/.test(id) || /^subtitle/.test(id)) return 'caption';
  if (input.trackIndex === 0 && /^main/.test(id)) return 'visual';
  if (input.audioOnly) return 'audio';
  return 'overlay';
}
