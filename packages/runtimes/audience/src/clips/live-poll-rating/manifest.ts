// packages/runtimes/audience/src/clips/live-poll-rating/manifest.ts
// T-463 — Co-located `AudienceClipManifest` declaration for the
// `live-poll-rating` clip family. Third audience clip on disk; follows
// the T-461 (`live-poll-multiple-choice`) + T-462 (`live-poll-open-text`)
// pattern verbatim.
//
// The `check-audience-permissions` CI gate scans this file (or
// `index.ts` as fallback) for the `MANIFEST` export and asserts the
// `permissions` literal is exactly `['audience-network']` per
// ADR-005 §D2 / ADR-009 §D13 / ADR-010 §D6.
//
// Browser-safe — type-only import, no runtime deps.

import type { AudienceClipManifest } from '../../clip-manifest.js';

/**
 * Co-located manifest for the `live-poll-rating` clip. The
 * `permissions` tuple is the literal `['audience-network']` so the
 * type-level check (T-455) and the source-scan CI gate
 * (`check-audience-permissions`) both pass.
 */
export const MANIFEST: AudienceClipManifest = {
  kind: 'live-poll-rating',
  permissions: ['audience-network'],
};
