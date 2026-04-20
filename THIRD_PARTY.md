# Third-Party Attributions and License Posture

This document tracks all external code that influences StageFlip, whether vendored, depended upon at runtime, or studied during design.

## 1. Runtime Dependencies

Populated automatically by `scripts/check-licenses.ts` (Phase 0 / T-010). All production dependencies must fall into the permitted-license whitelist below.

### Permitted Licenses

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- 0BSD
- CC0-1.0
- Unlicense
- BlueOak-1.0.0
- Python-2.0
- LGPL-2.1 or LGPL-3.0 **only via dynamic linking, whitelisted per-package with ADR**

### Forbidden Licenses

- GPL-2.0, GPL-3.0, AGPL — copyleft contamination risk
- SSPL — prohibits SaaS-competitive use
- **Remotion License** — prohibits building competing products
- Any custom source-available license with competitive-use restrictions
- Any license we have not audited

CI enforces the whitelist (`pnpm check-licenses`).

## 2. Vendored Code

Third-party code we include directly in our repository, with license obligations preserved.

### `@hyperframes/engine` → `packages/renderer-cdp/vendor/`

- **Upstream**: https://github.com/heygen-com/hyperframes
- **License**: Apache License 2.0
- **Copyright**: © HeyGen Inc.
- **What we take**: the CDP/BeginFrame frame-capture engine, FFmpeg orchestration, video frame extraction, audio mixer.
- **Why vendored**: reimplementing this is ~2–3 months; Apache 2.0 permits vendoring with attribution; it's infrastructure, not product-differentiating surface.
- **Our modifications**: scoped to adapter layer between Hyperframes engine and StageFlip's `ClipRuntime` contract. Modifications documented in each changed file's header.
- **Obligations**:
  - Preserve `LICENSE` and `NOTICE` files from upstream inside the `vendor/` directory.
  - Note "Modified by StageFlip, YYYY-MM-DD" in any file we change.
  - Do not use the "Hyperframes" trademark in StageFlip marketing.
  - Include attribution in this file and in the product's public docs.

Specific commit/tag vendored: _to be locked in Phase 4 / T-080_.

## 3. Studied Codebases (No Copying)

Codebases we have read for architectural context but do not depend on or copy from.

### SlideMotion (our own prior iteration)

- **Location**: `reference/slidemotion/` (local-only, gitignored)
- **License**: ours (IP we own)
- **Relationship**: StageFlip is the successor architecture. We port UI components, test fixtures, and domain tools during Phase 6. Agents may read freely.

### Hyperframes (the parts we don't vendor)

- **Location**: `reference/hyperframes/` (local-only, gitignored)
- **License**: Apache 2.0
- **Relationship**: studied for overall architecture (Frame Adapter pattern, skills-as-docs structure, linter design) but **not** copied for those patterns. Implementations are fresh, designed around StageFlip's RIR and canonical schema.

### Remotion — DELIBERATELY NOT INCLUDED

- **Upstream**: https://www.remotion.dev
- **License**: Remotion License (proprietary; prohibits competing products)
- **Relationship**: **none**. We do not depend on Remotion, we do not vendor Remotion, we do not copy Remotion. Our `@stageflip/frame-runtime` package provides equivalent functionality (useCurrentFrame, spring, interpolate, Sequence, etc.) via a clean-sheet implementation studying only public API documentation at https://remotion.dev/docs.
- **Enforcement**: `pnpm check-remotion-imports` CI gate fails on any match for `from "remotion"` or `from "@remotion/*"` in source.

## 4. Provenance Discipline

For every PR that implements functionality informed by studied third-party code:

1. **Commit messages** name the codebase studied, if any, and state that the implementation is original.
2. **PR descriptions** cite URLs read (docs, blog posts, specs — never source code of forbidden prior art).
3. **File headers** note the conceptual source where helpful (e.g., "spring physics from standard harmonic oscillator equations; not derived from any specific implementation").
4. When in doubt, **do not copy**. Reimplement from public specifications and math.

## 5. Trademarks

- "Claude" and "Anthropic" are trademarks of Anthropic PBC. We use them only to reference the MCP integration, not as endorsement.
- "Firebase" is a trademark of Google LLC. We use Firebase services under their standard terms.
- "Hyperframes" is a trademark of HeyGen Inc. We reference it only in attribution contexts (this file, commit messages, vendored code NOTICE).
- "StageFlip" and the product names (StageFlip.Slide, StageFlip.Video, StageFlip.Display) are our own.

## 6. Updates

This file is kept current by:

- `scripts/check-licenses.ts` — regenerates § 1 on every run; CI diffs against checked-in version.
- Pull request reviewers — verify § 2 and § 3 entries match what was actually done.
- Quarterly audit — product owner signs off on the table.

Breaking changes to this file require an ADR.
