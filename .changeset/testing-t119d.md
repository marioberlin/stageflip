---
'@stageflip/testing': minor
---

T-119d: `manifestToDocument(manifest)` converter.

Pure function that takes a `FixtureManifest` (composition + clip +
{runtime, kind, props}) and returns a full `RIRDocument` suitable
for `PuppeteerCdpSession.mount`. Hand-assembles a single-clip
document with full-bleed transform, timing derived from the clip
window, deterministic id + digest (both derived from `manifest.name`),
and empty animations/fontRequirements. The output is Zod-validated
via `rirDocumentSchema` before return so shape drift surfaces as a
parse error at conversion time rather than a mysterious mount failure.

This unblocks priming the 5 parity fixtures under
`packages/testing/fixtures/` via `stageflip-parity prime` (T-119b);
a follow-on patch extends its CLI with a `--parity` flag.

New dep: `@stageflip/rir` (workspace:*) — needed for the RIRDocument
type + rirDocumentSchema.
