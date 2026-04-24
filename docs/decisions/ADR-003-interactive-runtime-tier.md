# ADR-003: Interactive Runtime Tier

**Date**: 2026-04-25
**Ratified**: pending
**Status**: **Proposed**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

CLAUDE.md §3 forbids `Date.now()`, `Math.random()`, `performance.now()`, `fetch()`, `requestAnimationFrame`, `setTimeout`, `setInterval`, `new Worker()`, and `SharedWorker` inside `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, and `packages/renderer-core/src/clips/**`. That rule is load-bearing: it makes the parity harness (PSNR + SSIM) meaningful and lets MP4 / PPTX / display renders be byte-reproducible across runs, devices, and CI.

Phase 13 introduces a class of clips that structurally cannot live under that rule:

- **Voice** — `MediaRecorder` + Web Audio API; mic permission; transcript streams.
- **AI chat** — live LLM round-trips over the network.
- **Live data** — polled or streamed telemetry from declared endpoints.
- **Web embed** — sandboxed third-party surfaces (iframe + allowlist).
- **AI generative** — playback-time prompt → generated content rendered into a slot.
- **Shaders + Three.js** — frame-deterministic in principle, but the browser's `requestAnimationFrame` drives rendering cadence; ad-hoc WebGL code typically reads `performance.now()`.

Two options exist:

1. Allow §3 exemptions per clip with `// determinism-safe:` comments. Scales poorly, creates per-clip review burden, and erodes the invariant over time.
2. Create a separate runtime tier where the rules deliberately do not apply, bounded by a contract that every interactive clip also ships a deterministic fallback.

The forces at play:
- **Determinism invariant (I-2)** must not regress. MP4, PPTX, display exports stay byte-reproducible.
- **Frontier differentiation** — competitive parity with Claude Design's frontier surface (voice / AI / shaders / 3D) is strategic. See session discussion 2026-04-24.
- **Security model** — live mounts with mic / network / camera access are a threat model we have not shipped before.
- **Export matrix** — every interactive clip must still produce *something* for exports that cannot execute live code.

---

## Options Considered

### Runtime boundary

1. **Per-clip §3 exemption via `// determinism-safe:` comments.**
   - *Pros*: No new package; no new CI rule; reviewer sees the exemption inline.
   - *Cons*: Surface sprawl; every new frontier clip re-opens the debate; `check-determinism` becomes a sieve.

2. **Dedicated interactive runtime tier** — new package with explicit scope exemption.
   - *Pros*: One boundary, documented once; `check-determinism` keeps its teeth elsewhere; security review targets one surface.
   - *Cons*: New package + new CI rule scope + new ADR commitments.

3. **Inline live code in the existing runtime** with a feature flag.
   - Rejected. A flag doesn't remove the determinism debt; it hides it.

### Fallback contract

1. **Live-only clips, no deterministic fallback.**
   - Rejected. Breaks the MP4 / PPTX export path; customers lose the asset when the tab closes.

2. **Static fallback per clip, declared in the schema.**
   - *Pros*: Every export target has a path; parity harness still asserts on the fallback; customers keep the frozen render.
   - *Cons*: Double implementation work per clip.

3. **Server-rendered snapshot as fallback.**
   - *Pros*: No author work to produce a fallback.
   - *Cons*: Not deterministic (server state, network, time); fails the invariant.

### Security model

1. **Permission envelope declared per clip**, enforced at mount time by the runtime tier.
2. **Host-level permissions** — tenant grants all permissions globally.
3. **Ad-hoc** — each clip handles its own permission prompt.

---

## Decisions

### D1. New package: `packages/runtimes/interactive/`

StageFlip ships a distinct runtime tier at `packages/runtimes/interactive/`. It is outside the scope of the §3 determinism ESLint rule. Clips executing in this tier may use network, mic, camera, `rAF`, timers, and `Math.random()`.

### D2. Every interactive clip ships two paths

The clip schema (`packages/schema/src/clips/interactive.ts`) declares both:

- `staticFallback: CanonicalElement[]` — rendered by frame-runtime for MP4 / PPTX / image-sequence / display-pre-rendered exports. Subject to parity harness.
- `liveMount: { component: ComponentRef, props: CanonicalProps, permissions: Permission[] }` — mounted by the interactive tier for HTML / display-interactive / on-device-player exports. Not subject to parity harness.
- Optional `posterFrame: number` — which frame of the static fallback represents the clip in single-image contexts.

A clip that declares only `liveMount` is rejected by `check-preset-integrity`.

### D3. Export matrix routes per-target

The export layer resolves each interactive clip according to the target:

| Export | Path |
|---|---|
| MP4 / image sequence | `staticFallback` |
| PPTX (flat) | `staticFallback` rasterized |
| HTML slides / live presentation | `liveMount` |
| Display (pre-rendered frames) | `staticFallback` |
| Display-interactive (SIMID / VPAID) | `liveMount` |
| On-device display player | `liveMount` |

### D4. Permission envelope

Every `liveMount` declares `permissions: Array<'mic' | 'network' | 'camera'>`. At mount time, the interactive tier:

1. Verifies tenant-level enablement of the clip category (feature flag per ADR-005).
2. Requests or renews browser permissions as declared.
3. Blocks the mount if any declared permission is denied; falls back to `staticFallback`.

### D5. CI and lint scope changes

- `scripts/check-determinism.ts` explicitly excludes `packages/runtimes/interactive/**` from its source walk. The exemption is documented inline in the script.
- `check-determinism` gains a shader sub-rule that does apply inside the interactive tier: uniform-updater functions for `ShaderClip` and `ThreeSceneClip` must accept `frame` as their sole time source and must not read `performance.now()` / `Date.now()`. This keeps frame-deterministic frontier clips deterministic within their tier.
- A new gate `check-preset-integrity` validates that every clip declared `interactive` has a non-empty `staticFallback`.

### D6. Security review gates GA

The interactive tier ships behind a feature flag (ADR-005 §D3). Flag-on is permitted for preview tenants; GA enablement requires a completed security review whose sign-off is recorded on the ratification block of ADR-005. The review covers: permission prompts, iframe sandboxing, network egress allowlists, credential scoping for AI chat, and telemetry for denied permissions.

---

## Consequences

### Immediate (Phase α of Phase 13)

- `packages/runtimes/interactive/` scaffolded with contract tests, permission shim, and mount harness.
- `scripts/check-determinism.ts` updated to exclude the new path.
- `scripts/check-preset-integrity.ts` lands alongside the preset schema (ADR-004).
- `check-determinism` shader sub-rule lands before any `ShaderClip` implementation.

### Ongoing

- Every new frontier clip → schema declaration with both paths; reviewer verifies `staticFallback` is meaningful, not a blank frame.
- Adding a new permission kind → amendment to this ADR.
- Parity harness remains authoritative for `staticFallback`. Live mounts are smoke-tested by the interactive tier's own test suite; they are not part of the parity harness.

### Risks

- **Drift** between `staticFallback` and `liveMount` — the fallback looks stale vs. the live render. Mitigation: the static fallback is not a "preview" of the live mount; it is the frozen-state rendering, documented per clip (e.g., VoiceClip's static is a waveform + "Tap to speak" poster, not a simulated conversation).
- **Security** — first time we ship runtime code that phones out at playback. Pre-GA security review is mandatory per D6.
- **Performance** — on-device display player must execute `liveMount` efficiently. Benchmarks land in Phase γ.

---

## References

- CLAUDE.md §3 (determinism invariants that this ADR scopes around)
- ADR-004 (Preset system) — defines `check-preset-integrity`
- ADR-005 (Frontier clip catalogue) — enumerates the interactive clip types and their permission manifests
- Phase 13 task block: T-301 (this ADR), T-305 (interactive-clip contract), T-306 (tier skeleton), T-309 (extended `check-determinism`), T-383–T-396 (interactive clip implementations), T-403 (security review)

---

## Ratification Signoff

- [ ] Product owner (Mario Tiedemann) — ADR decisions
- [ ] Engineering — tier scaffolded, `check-determinism` scope updated green
- [ ] Security review — deferred to pre-GA (D6); tracked on ADR-005 ratification block
