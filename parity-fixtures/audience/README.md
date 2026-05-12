# `parity-fixtures/audience/` — audience-clip golden frames (T-476)

Per **ADR-010 §D5** and **T-476**, every audience clip kind (the eleven
`AudienceClipKind` discriminants) ships a parity-fixture artifact bundle
exercising its **static-fallback path**.

These fixtures carry the **§13 end-to-end render verification** obligation
that T-451 (ADR-010) deferred. Per the T-451 §13 statement: "T-476 Cluster I
parity fixtures + the PO ratification sign-off carry the end-to-end render
verification per CLAUDE.md §13 means-of-verification (option 2 — reference
preset / fixture sign-off via standard parity-fixture flow)."

## Directory layout

```
parity-fixtures/audience/<clip-kind>/
  manifest.json         # FixtureManifest (composition + reference frames + audit tag)
  snapshot.json         # AggregationValue input driving the static-fallback render
  thresholds.json       # PSNR + SSIM thresholds (defaults from @stageflip/parity)
  golden-frame-<n>.png  # Rendered reference frame (generated; NOT committed initially)
```

The eleven clip kinds:

- `live-poll-multiple-choice`
- `live-poll-open-text`
- `live-poll-rating`
- `live-qa`
- `live-quiz`
- `leaderboard`
- `word-cloud`
- `survey`
- `heatmap`
- `reaction-stream`
- `audience-ai-prompt`

## How to (re)generate a fixture

```
$ pnpm generate-audience-clip-parity-fixture --clip-kind=<kind>
```

The CLI reads the existing `snapshot.json` (validated against
`aggregationValueSchema` from `@stageflip/audience-contract`) plus
`manifest.json` (for composition + reference frames), drives the audience
runtime's static-fallback path, and writes the resulting `golden-frame-<n>.png`
into the fixture directory.

Without the parity-prime pipeline binding a real renderer (via
`bindProductionRenderer`), the CLI surfaces a clean "renderer unavailable"
error and exits non-zero. Tests pass a stub renderer through the
`runGenerate` DI parameter.

## Sign-off process

Per the CLAUDE.md memory `feedback_parity_signoff_doc_is_procedural.md`,
sign-off lives in the fixture's `manifest.auditTagged` field. Audience
fixtures land with `auditTagged: "T-476: Cluster I parity fixtures; unsigned
awaiting PO ratification"`. PO inspection signs them off post-merge.

Reference the existing `docs/ops/parity-fixture-signoff.md` for the
four-step posture (generate → inspect → sign → cluster merge); the audience
cluster reuses the same flow with the manifest `auditTagged` field standing
in for the per-preset frontmatter `signOff.parityFixture` marker.

## Why are these committed?

The goldens are part of the parity contract. CI (`pnpm parity`) reads them
at score time. `.gitignore` does not exclude this tree.

For T-476's initial PR the goldens are **NOT** committed — they are
generated on first CI render and PO-ratified post-merge.
