// packages/runtimes/audience/src/clips/audience-ai-prompt/manifest.ts
// T-471 — Co-located `AudienceClipManifest` declaration for the
// `audience-ai-prompt` clip family. Eleventh + FINAL audience clip on
// disk; THIRD marquee differentiator (per ADR-010 §D1 + §D7):
// audience-driven AI generation. Follows the T-461..T-470 pattern
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
 * Co-located manifest for the `audience-ai-prompt` clip. The
 * `permissions` tuple is the literal `['audience-network']` so the
 * type-level check (T-455) and the source-scan CI gate
 * (`check-audience-permissions`) both pass.
 */
export const MANIFEST: AudienceClipManifest = {
  kind: 'audience-ai-prompt',
  permissions: ['audience-network'],
};
