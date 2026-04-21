// packages/frame-runtime/src/path.ts
// Sub-entry for SVG path morphing. Keeps `flubber` (~18 KB gz) out of the
// base `@stageflip/frame-runtime` bundle — consumers who don't use
// `interpolatePath` pay zero flubber cost. Import as:
//
//   import { interpolatePath } from '@stageflip/frame-runtime/path';
//
// See `skills/stageflip/runtimes/frame-runtime/SKILL.md` and
// `docs/dependencies.md` §4 Audit 3 addendum for the bundle-split rationale.

export { interpolatePath, type InterpolatePathOptions } from './interpolate-path.js';
