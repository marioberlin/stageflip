// packages/import-pptx/src/geometries/format.ts
// Shared SVG-coordinate formatter. Trim trailing zeros without collapsing
// `0 → ''`. Three decimal places is plenty for visual fidelity at typical
// PPTX box sizes (max ~2000 px); deterministic across Node versions.

/** Format a number for inclusion in an SVG path `d` string. */
export function fmt(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(3).replace(/\.?0+$/, '');
}
