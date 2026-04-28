// packages/render-farm/src/state-markers.ts
// State-marker protocol (D-T266-5). The blender worker emits these to stdout;
// the in-memory adapter parses each line to drive lifecycle transitions.
//
// Protocol — exact stdout lines (no surrounding whitespace, one per line):
//
//   STAGEFLIP_RENDER_FARM_STARTED bakeId=<id>
//   STAGEFLIP_RENDER_FARM_FINISHED bakeId=<id> status=<succeeded|failed> [error=<message>]
//
// The marker is text rather than JSON because the worker's existing log lines
// are already a mix of structured and free-form output; a single greppable
// prefix avoids ambiguity. The keys (bakeId, status, error) are k=v pairs after
// the prefix.
//
// Real K8s adapters won't use this protocol — they read pod status from the
// Kubernetes API. Markers are only meaningful for the in-memory adapter.

/** Prefix for the "I started running" marker. Followed by `bakeId=<id>`. */
export const STARTED_MARKER_PREFIX = 'STAGEFLIP_RENDER_FARM_STARTED';

/** Prefix for the "I finished" marker. Followed by `bakeId=<id> status=<...>`. */
export const FINISHED_MARKER_PREFIX = 'STAGEFLIP_RENDER_FARM_FINISHED';

/** Parsed marker — discriminated by `kind`. */
export type ParsedMarker =
  | { readonly kind: 'started'; readonly bakeId: string }
  | {
      readonly kind: 'finished';
      readonly bakeId: string;
      readonly status: 'succeeded' | 'failed';
      readonly error?: string;
    };

/** Build the started marker line (used by the worker). */
export function buildStartedMarker(bakeId: string): string {
  return `${STARTED_MARKER_PREFIX} bakeId=${bakeId}`;
}

/** Build the finished marker line (used by the worker). */
export function buildFinishedMarker(args: {
  bakeId: string;
  status: 'succeeded' | 'failed';
  error?: string;
}): string {
  const base = `${FINISHED_MARKER_PREFIX} bakeId=${args.bakeId} status=${args.status}`;
  if (args.error !== undefined) {
    // Sanitize: strip newlines so the marker fits on one line. Backslashes
    // pass through; consumers only need the human-readable error preview.
    const sanitized = args.error.replace(/[\r\n]+/g, ' ').trim();
    return `${base} error=${sanitized}`;
  }
  return base;
}

/**
 * Parse a single line. Returns null if the line is not a state marker. Tolerant
 * of leading whitespace and ANSI noise: only the prefix match matters.
 */
export function parseMarkerLine(line: string): ParsedMarker | null {
  const trimmed = line.trim();
  if (trimmed.startsWith(STARTED_MARKER_PREFIX)) {
    const rest = trimmed.slice(STARTED_MARKER_PREFIX.length).trim();
    const bakeId = extractKey(rest, 'bakeId');
    if (bakeId === null) return null;
    return { kind: 'started', bakeId };
  }
  if (trimmed.startsWith(FINISHED_MARKER_PREFIX)) {
    const rest = trimmed.slice(FINISHED_MARKER_PREFIX.length).trim();
    const bakeId = extractKey(rest, 'bakeId');
    const status = extractKey(rest, 'status');
    if (bakeId === null || status === null) return null;
    if (status !== 'succeeded' && status !== 'failed') return null;
    const error = extractKey(rest, 'error');
    if (error !== null) {
      return { kind: 'finished', bakeId, status, error };
    }
    return { kind: 'finished', bakeId, status };
  }
  return null;
}

/**
 * Extract `<key>=<value>` from a `k1=v1 k2=v2 ...` string. Values may NOT
 * contain spaces except for the trailing `error=` value, which absorbs the
 * remainder of the line (since error messages typically include spaces).
 */
function extractKey(input: string, key: string): string | null {
  const needle = `${key}=`;
  const idx = input.indexOf(needle);
  if (idx === -1) return null;
  // Ensure key boundary — must be at start or preceded by space.
  if (idx > 0 && input[idx - 1] !== ' ') return null;
  const start = idx + needle.length;
  if (key === 'error') {
    // Special case: error= absorbs the remainder of the line.
    return input.slice(start);
  }
  // Standard case: value runs until the next space or end-of-string.
  const space = input.indexOf(' ', start);
  return space === -1 ? input.slice(start) : input.slice(start, space);
}
