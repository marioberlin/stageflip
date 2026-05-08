---
title: Cluster D regression — multi-clip composition rendering bug discovered during PO ratification 2026-05-08
id: docs/handover-cluster-d-regression
phase: 13
size: S
owner_role: orchestrator
status: open
last_updated: 2026-05-08
adr: docs/decisions/ADR-004-preset-system.md
---

# Cluster D regression — multi-clip composition rendering bug

## TL;DR

During PO ratification of Cluster D's 6 signed goldens 2026-05-08, **5 of 6 multi-clip presets were found to be rendering blank or near-blank frames** despite having passed parity-fixture-scoring CI gates with PSNR ≥ 36 / SSIM ≥ 0.92. Only the pre-existing single-clip `squid-game-geometric` (signed 2026-05-05; pre-T-348 multi-clip mechanism) renders correctly.

The parity scoring passes because **both expected and actual goldens are equally blank** — the parity test compares the rendered frame against itself, so identical-blank frames score as identical. This is a silent CI bypass.

`Cluster D: ELIGIBLE — all 6 preset(s) signed.` is **misleading**: the eligibility check only validates `signOff` frontmatter, not visual correctness. The PO ratification step (visual inspection) is the safety net — and it caught this.

## Affected presets (5 of 6)

| Preset | Visible result | Expected (per stub) |
|---|---|---|
| `stranger-things-benguiat` (T-348) | Near-white blank | Black bg + STRANGER THINGS letterforms in red neon glow + grain + light-leak + particles + fade overlay |
| `true-detective-double-exposure` (T-351) | Pure white blank | Muted earth-tones photographic register + grain + cinematic-LUT |
| `succession-home-video` (T-352) | Pale yellow tint (sepia overlay only) | Sepia home-video tint + SUCCESSION title + heavy grain |
| `severance-surreal-3d` (T-353) | Pure white blank | Sterile cinematic-LUT register + SEVERANCE title + low grain |
| `got-trajan-clockwork` (T-349) | Pale yellow tint (sepia overlay only) | Sepia metallic register + GAME OF THRONES title + grain |

`squid-game-geometric` (T-350; pre-multi-clip): **renders correctly** — confirms the regression is specific to the multi-clip composition mechanism introduced in T-348.

## Root cause hypothesis (high confidence)

The `ClipKindBinding.overlays?` extension introduced in T-348 (PR #435) wires elements correctly into `RIRDocument.elements` (verified — `buildPresetDocument` produces a valid N+1 element document with strictly-increasing zIndex). However, the parity-CLI renderer **treats each `RIRDocument.elements` entry as an isolated rendering surface with an opaque white background**, NOT as compositing layers in a shared canvas.

Symptom analysis:
- Modes that filter white into white-ish (cinematic-LUT, fade) → blank/near-white frames (T-348 / T-351 / T-353)
- Modes that filter white into a tinted color (sepia) → pale yellow frames (T-352 / T-349)
- The TOPMOST z-indexed overlay (photographic-overlay) is the only thing visible because it's on top of opaque white layers below
- The base `titleSequence` (zIndex 0) and middle overlays (grain at zIndex 1, etc.) are completely covered by the layers above them

This was reproduced LOCALLY (not just CI) — running `pnpm tsx scripts/generate-preset-parity-fixture-prod.ts --preset=stranger-things-benguiat --frame=30 --psnr=36 --ssim=0.92` produces the same near-white blank.

In contrast, the single-clip `youtube-subscribe-bounce` (T-369) renders correctly — confirming that single-clip rendering works and the regression is specific to multi-clip composition.

## Why CI didn't catch it

1. **`parity (fixture scoring)` job** runs `score-fixture` against the existing checked-in golden — same blank-vs-blank match → PSNR/SSIM → infinity.
2. **`render-e2e` job** primes goldens but doesn't visually compare against any reference; it only verifies the render pipeline produces SOME output. A blank PNG is valid output.
3. **No human-in-the-loop visual gate** in CI — that's deliberate; PO ratification is the visual gate.

## Affected PRs (chronological)

| PR | Task | Notes |
|---|---|---|
| #435 | T-348 stranger-things-benguiat | Introduced `ClipKindBinding.overlays?` extension. Backward-compat for single-clip bindings preserved. Multi-clip composition tested via unit tests (overlays array wired, zIndex ordering verified) but NOT via real-render integration test. |
| #437 | T-351 true-detective-double-exposure | Reused mechanism. |
| #439 | T-352 succession-home-video | Reused mechanism. |
| #441 | T-353 severance-surreal-3d | Reused mechanism. |
| #443 | T-349 got-trajan-clockwork | Reused mechanism. Closed Cluster D to 6/6. |

## Recommended remediation

### Phase 1: Revert frontmatter (this session, immediate)

Revert `signOff.parityFixture` of the 5 affected presets from `signed:2026-05-08` back to `pending-user-review`. This is the truthful state — the parity goldens are not visually correct, even if they pass byte-comparison parity scoring.

After revert: Cluster D goes 6/6 → 1/6 ELIGIBLE (only squid-game-geometric remains signed).

The 5 spec docs + 5 impl PRs stay on main as architectural-pattern-deliverables (ClipKindBinding.overlays mechanism, multi-clip-composition pattern, sibling impl agents' code) — they're correct in intent; only the rendering output is broken.

### Phase 2: Architectural fix (separate task — F-31 / T-455)

Two architectural options:

**Option A — Per-element transparent backgrounds**: Modify each affected primitive's render output to emit transparent background by default (so layers composite). Touches `title-sequence.tsx` (deep black bg → transparent), `grain.tsx` (already transparent), `light-leak.tsx` (already transparent), `particles.tsx` (already transparent), `photographic-overlay.tsx` (verify). Lowest-risk; minimal code change. Each primitive consumer (single-clip use cases) needs to verify it still works without the assumed white-canvas backstop.

**Option B — Canvas-blending composition in the renderer**: Modify `host-html-builder` or the renderer-cdp's mount path to composite multiple clip-element layers via canvas blending instead of opaque DOM stacking. Architectural change; higher risk; broader scope. Pro: works for any future multi-clip preset without touching primitives.

**Recommendation: Option A** — narrower scope; can be unit-tested per-primitive; matches the multi-clip composition spec D-T348-2 ("z-stack via N+1 elements with strictly-increasing zIndex") which assumed transparent compositing.

### Phase 3: Re-sign goldens (after fix)

Re-run parity-fixture generation for the 5 affected presets after the architectural fix lands. Re-ratify visually with PO. Restore Cluster D to 6/6 ELIGIBLE.

### Phase 4: CI gate (preventive)

Add a CI gate that asserts at least N% of pixels in a parity golden are non-uniform (catches blank frames). Existing `pnpm tsx scripts/check-preset-integrity.ts` could grow this rule.

## Process lesson

Specs that introduce structural extensions (like T-348's `ClipKindBinding.overlays?`) need **end-to-end render verification**, not just unit-test verification. Future structural-extension specs should require a real-render integration test before the spec PR ships.

**F-30 documented**: the rule lives in `CLAUDE.md` §13 ("Structural-extension specs require end-to-end render verification") and a corresponding implementer-checklist item under §11. The T-348b `parityFixture-non-blank` CI gate (`scripts/check-preset-integrity.ts` invariant 15) is the recovery backstop — `CLAUDE.md` §13 is the prevention.

## Pointers

- `docs/handover-phase13-cluster-g-eligible.md` §6 / §7 / §8 — main handover doc.
- `docs/tasks/T-348.md` D-T348-1, D-T348-2 — multi-clip composition spec.
- `packages/parity-cli/src/generate-fixture.ts:3458-3540` — `buildPresetDocument` impl.
- `packages/runtimes/frame-runtime-bridge/src/clips/title-sequence.tsx` — likely candidate for Option A fix (deep black bg → transparent).
- This doc — comprehensive finding + remediation plan.
