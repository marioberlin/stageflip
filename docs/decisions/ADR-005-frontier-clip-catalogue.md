# ADR-005: Frontier Clip Catalogue

**Date**: 2026-04-25
**Ratified**: pending
**Status**: **Proposed**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

ADR-003 establishes the interactive runtime tier and the two-path contract (`staticFallback` + `liveMount`). ADR-004 establishes the preset system. This ADR enumerates the specific frontier clip types that Phase 13 ships, their fallback contracts, permission manifests, and feature-flag posture.

"Frontier" is defined as clips that cannot be authored under §3 because their value comes from live, non-deterministic behavior: shaders with `uFrame` uniforms, 3D scenes with interactive cameras, voice input, live LLM chat, live data streams, sandboxed web embeds, and playback-time AI generation.

Strategic context: Claude Design, launched 2026-04-17, positions "frontier design" (3D, voice, video, shaders) as its differentiator. Shipping a frontier catalogue of our own is the core of strategic bet 2 (see session discussion 2026-04-24). Ours differs in that every frontier clip is parity-safe on the static path while delivering the frontier surface on the live path.

---

## Options Considered

### Catalogue scope

1. **Ship shaders + 3D only.** Low risk; lets us claim frontier without shipping network-dependent clips.
   - *Pros*: No security review needed.
   - *Cons*: Cedes voice / AI / live data to Claude Design.

2. **Ship the full seven.** Shaders, Three.js, voice, AI chat, live data, web embed, AI generative.
   - *Pros*: Strategic parity with Claude Design.
   - *Cons*: Security review is mandatory; larger implementation footprint.

3. **Ship full seven, flagged preview, GA after security review.**
   - *Pros*: Combines frontier coverage with security posture.
   - *Cons*: Flag mechanics add operational surface.

### Deployment targets

1. `renderer-cdp` only. Cuts display-interactive and on-device-player.
2. `renderer-cdp` + browser live-preview. Cuts display-interactive for v1.
3. `renderer-cdp` + browser live-preview + on-device display player. Full coverage, biggest lift.

---

## Decisions

### D1. Seven frontier clip types in v1

| Clip | `liveMount` | `staticFallback` | Permissions |
|---|---|---|---|
| `ShaderClip` | GLSL fragment shader with declared uniforms; mandatory `uFrame` | Deterministic raster at canonical frame | none |
| `ThreeSceneClip` | Three.js scene; seeded PRNG; `scene.tick(frame)` | Rendered still at canonical frame | none |
| `VoiceClip` | Web Audio + MediaRecorder; transcript stream | Waveform silhouette + "Tap to speak" poster | `mic` |
| `AiChatClip` | Scoped LLM chat with per-slide system prompt | Captured transcript rendered as text | `network` |
| `LiveDataClip` | Endpoint fetch + chart primitive | Last cached value rendered via chart | `network` |
| `WebEmbedClip` | Sandboxed iframe with allowlisted origin | Poster-frame screenshot | `network` |
| `AiGenerativeClip` | Playback-time prompt → generated content slot | Curated example output rendered statically | `network` |

All seven are declared `interactive: true` per ADR-003 §D2.

### D2. Shader and Three.js clips are frame-deterministic within the interactive tier

Although they live in `packages/runtimes/interactive/`, `ShaderClip` and `ThreeSceneClip` are frame-deterministic by construction:

- Shader uniforms must include `uFrame` as the sole time-like input. Reading `performance.now()` inside a uniform updater is a lint error (ADR-003 §D5).
- Three.js scene-clip wrappers receive a seeded PRNG and a frame-indexed `tick(frame)` call. The wrapper overrides `requestAnimationFrame` with a frame-driven scheduler.

This means their `liveMount` and `staticFallback` paths converge on the same frame output when the interactive tier is running in record mode (e.g., pre-rendering for display). Parity harness can optionally assert this convergence for shader and three-scene presets.

### D3. Feature flag and GA gate

The interactive tier ships **disabled by default** for all tenants. Enablement is a two-step process:

1. **Preview enablement** — tenant admin toggles `features.interactive` in admin settings. Flag-on permits authoring and preview of frontier clips in HTML / browser live-preview targets. Does not permit on-device display player execution.
2. **GA enablement** — requires completed security review sign-off recorded on this ADR's ratification block. Flag-on unlocks the full export matrix including on-device display player.

Feature-flag plumbing: `@stageflip/profiles-display` and the admin surface gain a `features.interactive: 'disabled' | 'preview' | 'ga'` field. The interactive runtime tier reads this at mount time and refuses mounts that exceed the tenant's posture.

### D4. Three deployment targets, all in v1

The `liveMount` path must work on:

- **`renderer-cdp` interactive hosting** — the headless-Chrome renderer used for pre-rendered display and video exports. Supports frame-deterministic frontier clips (shaders, Three.js) in record mode.
- **Browser live-preview** — the editor's preview pane and HTML-slide presentation mode. Supports all seven clip types. Subject to browser permission prompts.
- **On-device display player** — the player binary that runs on physical display hardware (DOOH, digital signage, in-venue screens). Supports the full seven, subject to device capability.

On-device display player is the largest lift (T-399 + T-400 + T-401). It is still v1; it blocks GA, not preview.

### D5. Permission envelope enforcement

At mount time, the interactive tier:

1. Reads `features.interactive` for the tenant; aborts to `staticFallback` if posture is insufficient for the target.
2. Requests declared permissions via the browser or device API.
3. On denial, logs a permission-denied event (observable telemetry) and falls back to `staticFallback`.
4. On grant, mounts the `liveMount` component.

Permissions are declared statically on the clip; they cannot be elevated at runtime. A clip wanting `camera` that does not declare it in its schema fails `check-preset-integrity`.

### D6. Fast variant generation is part of the frontier deliverable

The variant-generation mode (size × message × locale matrix) ships in this phase (T-386). It operates over RIR trees that may include interactive clips; the export matrix routes each variant according to D4 of ADR-003.

### D7. Security review scope

The pre-GA security review covers:

- Permission prompts and denial handling (D5)
- Iframe sandboxing for `WebEmbedClip` (sandbox attributes, allowlisted origins)
- Network egress scoping for `AiChatClip`, `LiveDataClip`, `AiGenerativeClip` (per-tenant allowlists, credential scoping)
- Mic data handling for `VoiceClip` (no persistence without explicit tenant opt-in; transcript storage policy)
- Telemetry (what is logged; what is not)
- Shader DoS protection (frame-budget kill switch)
- Three.js memory leak mitigation (teardown path)

The review is tracked as T-403; hardening responses as T-404; GA sign-off as T-405.

---

## Consequences

### Immediate (Phase γ of Phase 13)

- Seven clip implementations (T-383–T-396), each with `liveMount` + `staticFallback` pairs.
- Permission envelope scaffolding (T-385).
- Three deployment-target implementations (T-397–T-401).
- Feature-flag plumbing (T-402).
- Security review + hardening (T-403–T-405).

### Ongoing

- New frontier clip type → amendment to this ADR + updated permission matrix.
- New permission kind → ADR-003 amendment (permission enumeration) + this ADR's matrix.
- Security review cadence: annual, or whenever a new clip type or permission is introduced.

### Risks

- **Security review timeline.** If the review surfaces blocking issues, GA slips. Preview can still ship.
- **On-device player scope.** The on-device player is a new binary with its own supply chain and update mechanism. A security issue there is higher-blast-radius than a browser-only clip.
- **Claude Design drift.** They will ship v2 during our build. We may need to refresh the catalogue to stay competitive. Mitigation: the seven above are structural, not reactive — we are not chasing features, we are shipping a capability surface.

---

## References

- ADR-003 (Interactive runtime tier — the contract these clips satisfy)
- ADR-004 (Preset system — presets that compose these clips declare `permissions`)
- CLAUDE.md §3 (determinism rules the tier is scoped around)
- `skills/stageflip/runtimes/shader/SKILL.md`, `skills/stageflip/runtimes/three/SKILL.md` — existing runtime skills that this ADR extends
- Phase 13 task block: T-303 (this ADR), T-383–T-409 (Phase γ implementation)

---

## Ratification Signoff

- [ ] Product owner (Mario Tiedemann) — catalogue scope
- [ ] Product owner — feature-flag policy (D3)
- [ ] Engineering — seven clip implementations + three deployment targets green
- [ ] Security — pre-GA review complete (T-403); GA sign-off recorded here
- [ ] Security review signed: pending
