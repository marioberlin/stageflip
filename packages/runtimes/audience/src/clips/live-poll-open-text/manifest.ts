// packages/runtimes/audience/src/clips/live-poll-open-text/manifest.ts
// T-462 — Co-located `AudienceClipManifest` declaration for the
// `live-poll-open-text` clip family. Second audience clip on disk;
// follows the T-461 (`live-poll-multiple-choice`) pattern verbatim.
//
// The `check-audience-permissions` CI gate scans this file (or
// `index.ts` as fallback) for the `MANIFEST` export and asserts the
// `permissions` literal is exactly `['audience-network']` per
// ADR-005 §D2 / ADR-009 §D13 / ADR-010 §D6.
//
// Browser-safe — type-only import, no runtime deps.

import type { AudienceClipManifest } from '../../clip-manifest.js';

/**
 * Co-located manifest for the `live-poll-open-text` clip. The
 * `permissions` tuple is the literal `['audience-network']` so the
 * type-level check (T-455) and the source-scan CI gate
 * (`check-audience-permissions`) both pass.
 */
export const MANIFEST: AudienceClipManifest = {
  kind: 'live-poll-open-text',
  permissions: ['audience-network'],
};
