---
title: Cluster D regression — multi-clip composition rendering bug (CLOSED 2026-05-08)
id: docs/handover-cluster-d-regression
phase: 13
size: S
owner_role: orchestrator
status: closed
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

## Remediation closeout

**All 5 phases shipped 2026-05-08.** Cluster D restored to 6/6 ELIGIBLE+RATIFIED.

### Phase 1 — Revert frontmatter ✅ landed (PR #444)

Reverted `signOff.parityFixture` of the 5 affected presets from `signed:2026-05-08` back to `pending-user-review`. Cluster D 6/6 → 1/6 ELIGIBLE.

### Phase 2 — Architectural fix (FIRST attempt; superseded) ⚠️ landed but ineffective (PR #445)

Shipped `mix-blend-mode: multiply` inline on `photographic-overlay`'s SVG + made `title-sequence` default-to-transparent when caller omits `background`. Passed unit tests + all CI gates. **But the regression was NOT fixed** — Phase 3 re-regeneration showed identical blank output. Diagnosis: each `RIRElement` per-element wrapper has `position: absolute` + `z-index`, forming its own stacking context, which isolates an inline mix-blend-mode on the SVG from sibling elements. The blend's backdrop becomes the (empty) per-element wrapper, NOT the Composition root's prior z-order siblings.

The Phase 2 PR is on main as architectural-pattern-deliverable (the title-sequence transparent default IS still useful for future overlay-context use of titleSequence; the inline SVG mix-blend-mode was removed in Phase 2.5).

### Phase 2.5 — Hoist mix-blend-mode to host wrapper ✅ landed (PR #448, with Phase 3)

Added optional `ClipDefinition.mixBlendMode?: string` field. Host renderer (`composition.tsx` ElementNode) reads it and applies on the **outer** per-element wrapper. Wrapper participates in the Composition root's stacking context, so the blend correctly composites against prior z-order siblings. `photographic-overlay` declares `mixBlendMode: 'multiply'` on its clip definition; inline SVG style removed.

This is the Option A architectural fix from the original recommendation, executed correctly. The original Option A description ("per-element transparent backgrounds") was over-prescriptive — only `photographic-overlay` was the visible mask; `grain` / `light-leak` / `particles` already render transparent. Option B (renderer-side compositing) was deferred — Phase 2.5 reaches the same outcome with a smaller diff scoped to a single new clip-definition field.

### Phase 3 — Re-generate + re-sign 5 goldens ✅ landed (PR #448, with Phase 2.5)

After Phase 2.5 fix, regenerated parity-fixtures for all 5 affected presets and visually ratified each:

- `stranger-things-benguiat` — black canvas + STRANGER THINGS letterforms in red neon glow + grain + light-leak + particles + fade overlay
- `true-detective-double-exposure` — muted dark canvas + CREATED BY NIC PIZZOLATTO credit-block typography + cinematic-LUT subtle tone shift
- `succession-home-video` — sepia-tinted canvas + SUCC... title + heavy film grain
- `severance-surreal-3d` — sterile dark green-black canvas + SEVERANCE title in mid-century corporate typography + low grain
- `got-trajan-clockwork` — sepia-tinted canvas + GAME OF THRONES Trajan-style metallic gold serif title

Frontmatter `signOff.parityFixture` promoted from `pending-user-review` → `signed:2026-05-08` for all 5. Cluster D back to 6/6 ELIGIBLE.

### Phase 4 — Non-blank CI gate ✅ landed (PR #446)

`scripts/check-preset-integrity.ts` invariant 15 (`parityFixture-non-blank`). Two-stage detection: fail when `(significantBuckets < 2)` AND `(maxBucketFraction > 99.95%)`. Empirically tuned against 35 on-disk signed goldens; passes all 5 newly-signed Cluster D goldens as positive verification.

### Phase 5 — F-30 process lesson ✅ landed (PR #447)

`CLAUDE.md` §13 — "Structural-extension specs require end-to-end render verification". §13 is prevention; the Phase 4 CI gate is recovery. The Phase 2-vs-2.5 split in this remediation is a concrete instance of the rule playing out: Phase 2's unit tests verified the wiring; Phase 3's pixel-level verification revealed the wiring failure that motivated Phase 2.5.

## Process lesson

Specs that introduce structural extensions (like T-348's `ClipKindBinding.overlays?`) need **end-to-end render verification**, not just unit-test verification. Future structural-extension specs should require a real-render integration test before the spec PR ships.

**F-30 documented**: the rule lives in `CLAUDE.md` §13 ("Structural-extension specs require end-to-end render verification") and a corresponding implementer-checklist item under §11. The T-348b `parityFixture-non-blank` CI gate (`scripts/check-preset-integrity.ts` invariant 15) is the recovery backstop — `CLAUDE.md` §13 is the prevention.

## Pointers

- `docs/handover-phase13-cluster-g-eligible.md` §6 / §7 / §8 — main handover doc.
- `docs/tasks/T-348.md` D-T348-1, D-T348-2 — multi-clip composition spec.
- `packages/parity-cli/src/generate-fixture.ts:3458-3540` — `buildPresetDocument` impl.
- `packages/runtimes/frame-runtime-bridge/src/clips/title-sequence.tsx` — likely candidate for Option A fix (deep black bg → transparent).
- This doc — comprehensive finding + remediation plan.
