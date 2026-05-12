// packages/runtimes/audience/src/clips/leaderboard/manifest.ts
// T-466 — Co-located `AudienceClipManifest` declaration for the
// `leaderboard` clip family. Sixth audience clip on disk; first DERIVED
// clip (paired with `live-quiz`). Follows the T-461..T-465 pattern
// verbatim.
//
// The `check-audience-permissions` CI gate scans this file (or
// `index.ts` as fallback) for the `MANIFEST` export and asserts the
// `permissions` literal is exactly `['audience-network']` per
// ADR-005 §D2 / ADR-009 §D13 / ADR-010 §D6.
//
// Browser-safe — type-only import, no runtime deps.

import type { AudienceClipManifest } from '../../clip-manifest.js';

/**
 * Co-located manifest for the `leaderboard` clip. The `permissions`
 * tuple is the literal `['audience-network']` so the type-level check
 * (T-455) and the source-scan CI gate (`check-audience-permissions`)
 * both pass.
 */
export const MANIFEST: AudienceClipManifest = {
  kind: 'leaderboard',
  permissions: ['audience-network'],
};
