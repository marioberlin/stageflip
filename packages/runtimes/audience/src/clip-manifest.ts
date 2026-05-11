// packages/runtimes/audience/src/clip-manifest.ts
// T-455 — `AudienceClipManifest` type per ADR-005 §D2 / ADR-009 §D13 /
// ADR-010 §D6. Co-located declaration shipped alongside every Live
// Audience clip module under `packages/runtimes/audience/src/clips/`.
// The `check-audience-permissions` CI gate (scripts/check-audience-
// permissions.ts) statically scans each clip directory's `manifest.ts`
// (or `index.ts` fallback), locates the `MANIFEST` export, and asserts
// `permissions` is the literal tuple `['audience-network']`.
//
// The `permissions` field is typed as `readonly ['audience-network']`
// (a literal tuple, NOT `readonly string[]` or `readonly Permission[]`).
// Type-level: this rejects assignment of `['audience-network', 'other']`
// or any wider shape at the call site, before the CI scan runs.
//
// **Strict scope** — this is a type-level co-located declaration, not a
// schema element. ADR-005 §D2 establishes the clip-manifest convention
// the audience modality reuses; the schema-side `AudienceClip.permissions:
// Permission[]` is T-460's surface.

import type { AudienceClipKind } from '@stageflip/audience-contract';

/**
 * Co-located manifest declaration for a Live Audience clip module. Every
 * clip module under `packages/runtimes/audience/src/clips/<kind>/`
 * exports a `MANIFEST: AudienceClipManifest` constant alongside its
 * `ClipDefinition`. The `check-audience-permissions` CI gate enforces
 * the manifest's presence + literal `permissions` shape.
 *
 * Per ADR-009 §D13, the `audience-network` permission is scoped to the
 * audience-backend origin allowlist. The literal-tuple typing rejects
 * any other permission combination at type-check time; the CI gate is
 * the second line of defence (catches stale source on disk).
 *
 * @see docs/decisions/ADR-005-frontier-clip-catalogue.md §D2
 * @see docs/decisions/ADR-009-audience-backend.md §D13
 * @see docs/decisions/ADR-010-live-audience-clip-family.md §D6
 */
export interface AudienceClipManifest {
  /**
   * The audience clip's discriminant. Must be one of the 11
   * `AudienceClipKind` values (one per vote-payload variant +
   * `leaderboard`) per ADR-010 §D2.
   */
  readonly kind: AudienceClipKind;
  /**
   * Permission scope declared by the clip module. Must be the literal
   * tuple `['audience-network']` — exactly one entry, exactly that
   * scope. Wider scopes (`'network'`) or additional permissions defeat
   * the audience-backend origin allowlist per ADR-009 §D13.
   *
   * If a future clip genuinely needs a second permission (e.g.,
   * `microphone` for live-audio AudienceAiPrompt), the rule will need a
   * per-kind exception table; see docs/tasks/T-455.md §"Implementation
   * notes" for the punt rationale.
   */
  readonly permissions: readonly ['audience-network'];
}
