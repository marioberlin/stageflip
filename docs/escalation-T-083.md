# Escalation — T-083 scope refinement

**From**: Implementer (fresh context, 2026-04-21)
**To**: Orchestrator
**Task**: `T-083 — ClipRuntime ↔ CDP bridge adapter (one mapping per runtime kind; two-pass for bake)` — Phase 4, Size L
**Trigger** (CLAUDE.md §6): _"You discover an architectural question not covered by existing skills"_ — three, actually.
**Status**: blocked pending decisions below. Working tree on `main` is clean; no work-in-progress.

---

## What's blocking

Three ambiguities in the T-083 spec that would each expand scope in a direction the plan doesn't cover. Answering them collapses L back to genuinely L.

### B1. Two-pass bake is speculative today

The plan table reads "one mapping per runtime kind; **two-pass for bake**". But:

- All 6 registered runtimes are `tier: 'live'`: css, gsap, lottie, shader, three, frame-runtime-bridge.
- T-089 (same phase) is explicitly _"Bake-runtime scaffolding — queue/cache interfaces; no implementation (Phase 12 fills)"_.
- There is nothing bake-tier to mount into a two-pass adapter.

Designing a two-pass flow here with nothing to exercise it violates CLAUDE.md §3: _"Don't add features, refactor, or introduce abstractions beyond what the task requires."_

### B2. "One mapping per runtime kind" overstates kind-specificity

All 6 live runtimes share the same externally-observable shape:

- React tree mounted inside a browser context.
- Driven by `FrameContext` + `useCurrentFrame()` (or ClipRuntime's seek equivalent — see Phase 3 handover §3.4).
- Rendered via CDP's `BeginFrame` screenshot at deterministic frame timestamps.

There is no per-kind branching in the dispatcher itself — `findClip(kind)` from T-060 already resolves `kind → (runtime, clipDefinition)`. The only per-kind divergence the CDP adapter could care about is:

- Viewport / DPR setup — shared, not per-kind.
- Font preflight — that's T-084a.
- WebGL context acquisition for shader — actually just a browser-capability concern, not an adapter-shape concern.

"One mapping per runtime kind" reads like it wants six separate adapter classes; in practice one live-tier adapter covers all six through the registry.

### B3. Vendored engine has an unresolved transitive dep (T-082 Reviewer finding)

`packages/renderer-cdp/vendor/engine/src/index.ts` re-exports
`quantizeTimeToFrame` and `MEDIA_VISUAL_STYLE_PROPERTIES` from
`@hyperframes/core`. T-080 vendored only `@hyperframes/engine`, not
`@hyperframes/core`. So the moment T-083 imports anything from
`vendor/engine/`, the TypeScript build fails on an unresolved
module specifier.

This wasn't decided in T-080, T-081, or T-082 — correctly, because
those were provenance tasks, not integration tasks. T-083 is where
the decision comes due.

---

## Proposals

### P1. Narrow T-083 to a single live-tier dispatcher; defer bake to T-089

**Accept**: T-083 produces one adapter module that:

- Consumes `@stageflip/runtimes-contract` `findClip(kind)` to resolve clips.
- Wraps a CDP-controlled browser session (vendored or fresh — see P3).
- Exposes `renderFrame(compositionId, frame) → Buffer` using `BeginFrame`.
- Tests exercise all 6 registered runtimes through a single code path.

**Defer**: the two-pass bake mechanism folds into T-089's scope. Per the plan, T-089 is already _"queue/cache interfaces; no implementation"_ — it's the natural home for two-pass bake interfaces, which is the other half of what bake actually needs.

**Update**: `docs/implementation-plan.md` T-083 row drops the `; two-pass for bake` clause and gets a `[rev]` marker. T-089 row grows to cover two-pass orchestration interfaces explicitly.

**Size effect**: T-083 stays **L** because CDP wiring + preflight + tests is legitimately large; T-089 stays **M** because interfaces-only is small either way.

### P2. Drop "one mapping per runtime kind" in favor of "single live-tier adapter backed by the registry"

Same practical outcome, honest phrasing. Plan row gets re-worded.

### P3. Resolve vendored engine's `@hyperframes/core` transitive dep — pick one

| Option | What it is | Cost | Risk |
|---|---|---|---|
| **(a) Reimplement the two helpers in `renderer-cdp/src/`** | `quantizeTimeToFrame(ms, fps)` is ~5 LOC (`Math.round(ms * fps / 1000) * 1000 / fps`). `MEDIA_VISUAL_STYLE_PROPERTIES` is a constant array. Patch `vendor/engine/src/index.ts` (Modified-by-StageFlip header) to re-export from our module instead of `@hyperframes/core`. | ~50 LOC + one `// Modified by StageFlip` header + `NOTICE` append. | Lowest. |
| **(b) Vendor `@hyperframes/core` as a second payload** | Full second vendor drop paralleling T-080/T-081/T-082 shape. | ~500-2000 LOC of unrelated code; new PIN.json; NOTICE section; re-audit; ADR. | Largest blast radius; pulls in code we don't need. |
| **(c) Write a fresh CDP adapter — don't use vendored engine at all** | `puppeteer-core` directly; T-080 becomes reference-only. | Weeks of work; redundant with T-080's Apache-2.0 vendoring commitment. | Contradicts `THIRD_PARTY.md` §2 which explicitly commits to vendoring. |

**Recommendation: (a).** Smallest diff, preserves the vendoring commitment, validates the "Modified by StageFlip" protocol for real. The modification would be the first entry in `vendor/NOTICE`'s "Modifications by StageFlip" section — exercising the policy we wrote in T-081.

---

## Decisions needed from you

1. **B1 / P1**: Drop bake two-pass from T-083; fold into T-089? (Y/N)
2. **B2 / P2**: Re-word "one mapping per runtime kind" to "single live-tier adapter via registry"? (Y/N)
3. **B3 / P3**: Which option — (a), (b), or (c)?
4. **(procedural)** `docs/implementation-plan.md` T-083 and T-089 rows get `[rev]` markers with a one-line "rev note"; I make those edits as part of T-083's PR, or separately first?

---

## What I'll do once decided

- If P1+P2 accepted and P3=(a): plan ~L-sized work — dispatcher skeleton + helpers re-impl + one Modified-by-StageFlip patch + integration test that round-trips one clip from each of the 6 runtimes through the adapter + 9 gates + Reviewer.
- If P3=(b): add ~4-6 hours for the second vendor drop before T-083 proper begins.
- If P3=(c): this becomes a multi-week effort and probably warrants its own ADR first.

No files touched until you decide.
