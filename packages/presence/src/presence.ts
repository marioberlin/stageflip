// packages/presence/src/presence.ts
// Shared types + colorForUserId helper for the presence plane.
// Per ADR-006 §D5, presence is a separate plane from canonical state and
// must NOT be implemented atop y-protocols/awareness; this module defines
// the shape that flows through both adapters and the client.

/** Twelve-color palette assigned by hash of `userId`. WCAG-AA on white,
 * distinguishable to deuteranopes. The order is part of the API contract:
 * changing it shifts every user's color across releases. */
export const PRESENCE_PALETTE: readonly string[] = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#eab308',
] as const;

/**
 * Ephemeral presence record fanned out via the presence adapter.
 *
 * Cursor coordinates are slide-local in canonical-pixel units (per RIR);
 * editor consumers transform DOM-space cursors to canonical-space before
 * calling `setCursor`.
 */
export interface Presence {
  userId: string;
  /** Stable color across sessions — derived from `userId` via {@link colorForUserId}. */
  color: string;
  /** Last-seen wall-clock ms. Server-side stale filter compares against current time. */
  lastSeenMs: number;
  cursor?: {
    slideId: string;
    x: number;
    y: number;
  };
  selection?: {
    elementIds: string[];
  };
  status?: 'active' | 'idle' | 'away';
}

/**
 * Pure, deterministic color assignment. Same `userId` always returns the same
 * palette entry. The hash is a simple polynomial — fine for distribution into
 * 12 buckets, not a security primitive.
 */
export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PRESENCE_PALETTE.length;
  // PRESENCE_PALETTE is fixed-length; the `!` reflects the modulo invariant.
  // biome-ignore lint/style/noNonNullAssertion: palette modulo is exhaustive
  return PRESENCE_PALETTE[idx]!;
}
