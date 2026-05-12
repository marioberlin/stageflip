// packages/runtimes/audience/src/clips/reaction-stream/uniforms.ts
// T-470 — Pure deterministic helper that computes the per-frame uniform
// values consumed by the ReactionStream fragment shader. Given a frozen
// `ReactionStreamAggregation`, the clip's `palette`, the local frame, and
// the composition's fps, return the uniform bundle the shader needs to
// render the emoji particle storm.
//
// Pipeline (per ADR-010 §D4 + the T-470 spec):
//   1. For every palette entry, look up the matching `emojiCounts` row by
//      `emojiId`. Density = clamp(recentBurst / 10, 0, 1) — the per-voter
//      cap is 10 Hz per ADR-009 §D3 line 231 override for reaction-stream,
//      so a recentBurst at the cap saturates the per-emoji density.
//   2. `uTime` = `localFrame / fps` (seconds; deterministic).
//   3. `uTotalReactions` = sum of all `emojiCounts[i].count` (the
//      lifetime tally; drives the global animation modulation in the
//      shader).
//   4. `uPaletteSize` = the number of palette entries the shader should
//      iterate over (bounded ≤ 12 by the schema).
//
// Determinism (CLAUDE.md §3): no `Math.random`, no `Date.now`, no
// `setTimeout`, no `fetch`, no `performance.now`. Only arithmetic +
// `Math.min` / `Math.max`. Pure: given identical input arguments the
// returned `Float32Array.buffer` is byte-identical.
//
// Browser-safe — uses only the standard `Float32Array` constructor.

/**
 * Per-frame uniform bundle for the ReactionStream fragment shader. Keys
 * match the `uniform` declarations in `fragment.glsl.ts`.
 *
 * - `uTime`: clip-local time in seconds (`localFrame / fps`).
 * - `uDensities`: per-palette-entry density in `[0, 1]` (length =
 *   `palette.length`; bounded ≤ 12 by the schema).
 * - `uTotalReactions`: lifetime tally across all emoji buckets (informs
 *   global animation modulation).
 * - `uPaletteSize`: number of palette entries the shader iterates over.
 */
export interface ReactionStreamUniforms {
  readonly uTime: number;
  readonly uDensities: Float32Array;
  readonly uTotalReactions: number;
  readonly uPaletteSize: number;
}

/** Per-emoji recent-burst cap (per ADR-009 §D3 line 231 override). */
const MAX_RECENT_BURST = 10;

/**
 * Compute the per-frame uniforms for the ReactionStream shader.
 *
 * Pure: given identical `(emojiCounts, palette, localFrame, fps)` the
 * returned object is structurally equal AND its `uDensities` buffer is
 * byte-identical.
 *
 * @param emojiCounts   per-emoji `count` + `recentBurst` from the
 *                      snapshot's `ReactionStreamAggregation.emojiCounts`.
 * @param palette       per-clip `{ emojiId, glyph }[]` — drives the
 *                      shader's iteration order (densities map 1:1).
 * @param localFrame    clip-local frame number (`ctx.frame - ctx.clipFrom`).
 * @param fps           composition fps (for the time-in-seconds uniform).
 */
export function computeReactionStreamUniforms(
  emojiCounts: readonly { emojiId: string; count: number; recentBurst: number }[],
  palette: readonly { emojiId: string; glyph: string }[],
  localFrame: number,
  fps: number,
): ReactionStreamUniforms {
  const densities = new Float32Array(palette.length);
  for (let i = 0; i < palette.length; i += 1) {
    const entry = palette[i];
    if (entry === undefined) continue;
    const match = emojiCounts.find((e) => e.emojiId === entry.emojiId);
    const recentBurst = match?.recentBurst ?? 0;
    // Clamp `recentBurst / 10` to [0, 1]; missing palette entries → 0.
    const density = Math.min(Math.max(recentBurst / MAX_RECENT_BURST, 0), 1);
    densities[i] = density;
  }
  let totalReactions = 0;
  for (const e of emojiCounts) totalReactions += e.count;
  // `fps > 0` guarded by upstream; defensive fallback to 1 to avoid NaN.
  const safeFps = fps > 0 ? fps : 1;
  return {
    uTime: localFrame / safeFps,
    uDensities: densities,
    uTotalReactions: totalReactions,
    uPaletteSize: palette.length,
  };
}
