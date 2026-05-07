---
title: Phase 13 — Cluster G ELIGIBLE + RATIFIED — handover
id: docs/handover-phase13-cluster-g-eligible
owner: orchestrator
last_updated: 2026-05-07
supersedes: docs/handover-phase13-cluster-b.md
---

# Handover — Phase 13 Cluster G ELIGIBLE + RATIFIED (2026-05-07)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §"Phase 13".

**Phase 13 is still mid-flight, NOT complete.** This session shipped **28 PRs** advancing Cluster G from 0/5 → 5/5 ELIGIBLE + RATIFIED, adding 4 new bridge clip primitives (T-317 `subscribe-button`, T-318 `follow-prompt`, T-319 `qr-code-bounce`, T-371a `link-sticker`), 4 cluster-compose-tools surfaces (T-340 / T-368 / T-331 / T-361 — the 17 `compose_*` tools across 4 handler bundles for the 4 originally-ratified clusters A/B/E/F), the F-16 CI typecheck order fix, and Cluster B PO ratification. `main` at `0f1bd04d`. Working tree clean (`project_init/` untracked; pre-existing scaffolding NOT to be swept in).

**Mandatory first action**: read this handover top-to-bottom. Then run `pnpm typecheck && pnpm lint && pnpm test && pnpm check-skill-drift` to verify green-on-main independently. Then check cluster eligibility for A + B + E + F + G:

```bash
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=news       # → ELIGIBLE (8/8)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=sports     # → ELIGIBLE (9/9)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=data       # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=captions   # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ctas       # → ELIGIBLE (5/5)
```

---

## 1. Where we are

### Phase history

- Phases 0–12: ratified.
- **Phase 13 (Premium Motion Library & Frontier Runtime)**: mid-flight. Phase α primitives (T-301 → T-313) + Track C γ-live primitives (T-383 → T-396) all done before this session's start. Prior sessions closed Clusters E + F + A + B end-to-end. **This session closed Cluster G end-to-end (5/5 ELIGIBLE + RATIFIED) — first cluster expansion fully closed beyond the 4 originally-ratified clusters.**

### What this session shipped (28 PRs, chronological)

**F-16 CI fix + Cluster B PO ratification (PRs #395-#396):**

| PR | Task | Notes |
|---|---|---|
| #395 | F-16 | Declared `@stageflip/scripts` workspace deps so CI typechecks build them first; cleared cascading skill-sync drift exposed once typecheck went green. CI fully green for the first time in many merges. |
| #396 | Cluster B ratification | All 9 Cluster B preset goldens visually inspected against compass; all PASS. Cluster B 9/9 RATIFIED. |

**Cluster-compose-tools surface (PRs #397-#404):**

| PR | Task | Notes |
|---|---|---|
| #397 / #401 | T-340 spec / impl | `cluster-b-compose` bundle (4 tools; sports). 1088 LOC. First read-only `ToolContext` handler bundle pattern; sets template for sibling tasks. |
| #398 / #402 | T-368 spec / impl | `cluster-f-compose` bundle (4 tools; captions; mixed-clipKind dispatch caption + lyrics). |
| #399 / #403 | T-331 spec / impl | `cluster-a-compose` bundle (4 tools; news). |
| #400 / #404 | T-361 spec / impl | `cluster-e-compose` bundle (5 tools — one more than other clusters; data). |

**Cluster G primitives (PRs #405-#406, #411-#412, #415-#416, #419-#420):**

| PR | Task | Notes |
|---|---|---|
| #405 / #406 | T-317 spec / impl | `subscribe-button` primitive. 53rd bridge clip. Sealed `platform: 'youtube' \| 'tiktok' \| 'instagram' \| 'generic'` discriminatedUnion; 3 phases idle / pressing / subscribed. 612 LOC component + 433 LOC tests. |
| #411 / #412 | T-318 spec / impl | `follow-prompt` primitive. 54th bridge clip. Same sealed platform enum; phases idle / pulsing / followed; sustained 1500ms pulse 1.0→1.05→1.0; avatar-circle + corner-badge geometry. 552 LOC + 411 LOC tests. |
| #415 / #416 | T-319 spec / impl | `qr-code-bounce` primitive. 55th bridge clip. Single Zod object schema (NO discriminatedUnion); closed-form fold+mod bounce physics + uniform HSL hue cycle. 358 LOC + 350 LOC tests. |
| #419 / #420 | T-371a spec / impl | `link-sticker` primitive. 56th bridge clip. **Implementation-plan gap-fill task.** Sealed `variant: 'white-on-dark' \| 'dark-on-white' \| 'frosted-glass' \| 'brand-color'` flat enum; phases idle / shimmering; closed-form linear shimmer gradient sweep. |

**Cluster G presets (PRs #407-#408, #409-#410, #413-#414, #417-#418, #421-#422):**

| PR | Task | Notes |
|---|---|---|
| #407 / #408 | T-369 spec / impl | `youtube-subscribe-bounce` substantive. First subscribeButton consumer; first PRESET_ID_BINDINGS override of subscribeButton clipKind. **Cluster G 1/5.** Spec-vs-reality lesson captured: parity-CLI generator uses 1280×720 default canvas (NOT 1920×1080); spec called for `(1480, 920)` anchor → impl adjusted to `(1040, 640)`. |
| #409 / #410 | T-373 spec / impl | `social-handle-lower-third` substantive. Sister to T-330 apple-tv-lt; sixth lowerThird consumer; uses already-shipped lower-third primitive (no new clip work). **Cluster G 2/5.** |
| #413 / #414 | T-370 spec / impl | `tiktok-follow-pulse` substantive. First follow-prompt consumer. **Cluster G 3/5.** Notable departure: parity golden uses `--frame=30` (NOT cluster-norm 60) because frame 60 is past the bounded `pulseRepeat=1` cycle (totalFrames=45) and would render settled-baseline. |
| #417 / #418 | T-372 spec / impl | `coinbase-dvd-qr` substantive. First qr-code-bounce consumer. **Cluster G 4/5.** Notable departure: parity thresholds preset-pinned at PSNR=38 / SSIM=0.94 (NOT cluster-norm 42/0.98) due to motion blur + per-frame HSL hue cycling reducing precision below the steady-state-icon range. |
| #421 / #422 | T-371 spec / impl | `instagram-link-sticker` substantive. First link-sticker consumer. **Cluster G 5/5 — ELIGIBLE.** First `socialMedia` clipKind PRESET_ID_BINDINGS override; cluster-norm thresholds; 3 transient render-e2e flakes recovered via `gh run rerun`. |

### Cluster status snapshot

| Cluster | Domain | Total | Signed | Eligible? | Ratified? |
|---|---|---|---|---|---|
| **A** | broadcast / news | **8** | **8** | ✅ ELIGIBLE | ✅ RATIFIED 2026-05-06 |
| **B** | **sports** | **9** | **9** | ✅ ELIGIBLE | ✅ RATIFIED 2026-05-07 |
| C | weather | 4 | 0 | no | — |
| D | title sequences | 6 | 1 | no | — |
| **E** | data | **6** | **6** | ✅ ELIGIBLE | ✅ RATIFIED 2026-05-06 |
| **F** | captions | **6** | **6** | ✅ ELIGIBLE | ✅ RATIFIED 2026-05-06 |
| **G** | **CTA / social** | **5** | **5** | **✅ ELIGIBLE (this session)** | **✅ RATIFIED 2026-05-07 (this session)** |
| H | AR overlays | 5 | 0 | no | — |
| **TOTAL** | — | **50** | **35** | **5 of 8** | **5 fully ratified** |

### Bridge clip count: 56

Prior 52 + 4 new this session:

| Added in session | Source | Use cases |
|---|---|---|
| `subscribe-button` | T-317 | Cluster G presets (T-369; sealed platform enum: youtube / tiktok / instagram / generic) |
| `follow-prompt` | T-318 | Cluster G presets (T-370; same sealed platform enum; avatar-circle + corner-badge) |
| `qr-code-bounce` | T-319 | Cluster G presets (T-372; single-schema, no platformization; bounce physics + rainbow hue cycle) |
| `link-sticker` | T-371a | Cluster G presets (T-371; gap-fill primitive; sealed `variant` flat enum; shimmer animation) |

---

## 2. Architectural patterns established / extended this session

### Pattern C — clipKind-default vs presetId-override resolver (extended to 11 clipKinds total this session)

Now exercised across **11 clipKinds**:

| clipKind | First-consumer (DEFAULT_CLIP_KIND_RESOLVER) | PRESET_ID_BINDINGS overrides |
|---|---|---|
| `caption` | T-362 hormozi-montserrat-black | T-363, T-364, T-365, T-366 |
| `lyrics` | T-367 karaoke-progressive-wipe | (none) |
| `fullScreen` | T-355 magic-wall-drilldown | T-328 msnbc-big-board, T-339 uefa-starball |
| `lowerThird` | T-323 cnn-classic | T-325, T-326, T-329, T-330, **T-373 social-handle-lower-third (this session)** |
| `breakingBanner` | T-324 cnn-breaking | T-327 fox-news-alert |
| `titleSequence` | T-350 squid-game-geometric | (none) |
| `scoreBug` | T-358 cricket-ball-by-ball-dots (uses `outcome-row` primitive) | T-332..T-337 |
| `newsTicker` | T-356 bloomberg-ticker | T-339a espn-bottomline-flipper |
| `standings` | T-357 olympic-medal-tracker | T-338 masters-red-under-par |
| `subscribeButton` | (none yet) | **T-369 youtube-subscribe-bounce (this session — first consumer; PRESET_ID_BINDINGS override)** |
| `followPrompt` | (none yet) | **T-370 tiktok-follow-pulse (this session — first consumer; PRESET_ID_BINDINGS override)** |
| `qrCodeBounce` | (none yet) | **T-372 coinbase-dvd-qr (this session — first consumer; PRESET_ID_BINDINGS override)** |
| `socialMedia` | (none yet) | **T-371 instagram-link-sticker (this session — first consumer; PRESET_ID_BINDINGS override)** |

**Key observation**: All 4 Cluster G clipKinds (`subscribeButton`, `followPrompt`, `qrCodeBounce`, `socialMedia`) shipped with PRESET_ID_BINDINGS-only consumers — no clipKind-default arm. This is a departure from prior clusters (A/B/E/F all had at least one clipKind-default consumer). The reason: each Cluster G primitive has very specific brand canon dominating its render; there's no "neutral" / brand-agnostic default register that fits the clipKind-default slot.

### Pattern — agent-callable composer-tools (NEW this session)

The 4 cluster-compose handler bundles (T-340 / T-368 / T-331 / T-361) introduce an **agent-layer wrapping** pattern over preset bindings:

- **Bundle naming**: `cluster-{a|b|e|f}-compose` (canonical entry in `packages/engine/src/bundles/catalog.ts`).
- **Handler signature**: `ToolHandler<TInput, TOutput, ToolContext>` — **read-only** posture (NOT `MutationContext`); no JSON-Patch ops; the tool returns `{ presetId, props }` opaque payload that a separate write-tier tool (e.g., `add_clip` from create-mutate) consumes at the next plan step.
- **Schema discipline**: each tool ships explicit Zod input + output schemas; outputs are discriminated unions like `{ status: 'ok', presetId, props } | { status: 'not_yet_implemented', reason }`.
- **Sealed enums**: each cluster's preset id list is exported as `CLUSTER_X_PRESET_IDS` (sealed const-array; literal-union type derived from it).
- **Reserved surfaces**: tools that don't yet have a backing preset (e.g., `compose_var_call` for T-320 VARBanner not yet shipped, `compose_player_intro` for an unfilled Cluster B preset) return `not_yet_implemented` with a documented reason — additive when the backing preset eventually lands.
- **Tool-skill regen**: `pnpm gen:tool-skills` auto-generates `skills/stageflip/tools/cluster-{a,b,e,f}-compose/SKILL.md` per bundle. The CI gate `pnpm gen:tool-skills:check` enforces freshness.

T-374 (Cluster G composer-tools) is **NOT YET shipped** — it's the natural next dispatch task to bring Cluster G's agent surface up to parity with A/B/E/F.

### Implementation-plan gap-fill: T-371a `LinkSticker` (NEW this session)

Discovered 2026-05-07: T-371 instagram-link-sticker declares `clipKind: socialMedia` in its stub frontmatter. `'socialMedia'` is in `VALID_CLIP_KINDS` (allowlist line 73). However, **no implementation-plan task ships a primitive for this clipKind**:

- β-gap-clips list (T-316..T-322) covers Caption / SubscribeButton / FollowPrompt / QRCodeBounce / VARBanner / TitleSequenceClip / LyricsClip — none is `SocialMedia`.
- T-374 is composer-tools (Cluster-G skill + `compose_cta` / `compose_subscribe_prompt` / `compose_social_handle` / `compose_qr_bounce`), NOT a primitive.
- No existing primitive can be repurposed: subscribe-button's `'instagram'` branch is "Follow Account" CTA (semantically distinct from "Open URL" link sticker); follow-prompt is avatar-circle (wrong shape); lower-third is horizontal bar (wrong register).

Solution: T-371a — primitive carve-out matching the established suffix-`a` pattern (T-356a / T-357a / T-358a / T-355a / T-332a / T-324a). T-371a ships a `link-sticker` clip with sealed `variant` flat enum and a new shimmer-animation lexicon.

**This is the first instance in Phase 13 where a missing primitive was discovered AT preset-time and patched mid-cluster via a carve-out.** The pattern is documented for future reference: when a stub frontmatter declares a clipKind not covered by β-gap-clips, the primitive becomes T-{consumer-id}a.

### Pattern E — F-4 generator flags retire the manual hand-pin (universal Cluster G adherence)

Confirmed across all 5 Cluster G presets this session: every preset PR ran F-4-style flags. T-369/T-370/T-373/T-371 used cluster-norm `--psnr=42 --ssim=0.98 --mark-signed`; T-372 used preset-pinned `--psnr=38 --ssim=0.94 --mark-signed` (motion blur divergence). No manual `thresholds.json` edits. The hand-pin step stays fully retired.

### Sibling-test ALL_BRIDGE_CLIPS bumps (each new primitive)

Each new bridge clip causes +2/-2 edits to existing sibling tests (`breaking-banner.test.tsx`, `lyrics.test.tsx`, `score-bug.test.tsx`, `title-sequence.test.tsx`, plus prior new clips' tests) bumping the asserted `ALL_BRIDGE_CLIPS.length` constant. Every primitive PR this session followed the pattern:

- T-317 (53rd): bumped 5 sibling tests 52→53.
- T-318 (54th): bumped 5 sibling tests 53→54.
- T-319 (55th): bumped 6 sibling tests 54→55 (plus subscribe-button + follow-prompt now in the mix).
- T-371a (56th): bumped 7 sibling tests 55→56 (plus qr-code-bounce now in the mix).

Future primitive PRs MUST `git add` the touched sibling test files. The implementer agent script in this session caught this organically (failing test runs forced the bumps); the brief should still call this out explicitly.

---

## 3. Documented primitive-side follow-ups (non-blocking)

Updated from prior session's list. **New items in bold.**

| ID | Issue | Origin | Severity |
|---|---|---|---|
| F-1 | CaptionClip `background` prop ignored when `backdrop: 'none'` | T-362 | low |
| F-2 | Host bundle doesn't preload Google Fonts OFL families | T-362/T-365/T-367 | low |
| F-3 | `magic-wall-panel` placeholder rectangular tiles | T-355a | medium |
| ~~F-4~~ | ~~`thresholds.json` hand-pin~~ — RESOLVED | — | done |
| F-5 | `KNOWN_KINDS` allowlist one-off-per-preset | T-358a + T-355 | low |
| ~~F-6 (T-316b)~~ | ~~`caption.tsx` rect + muteOpacity:0 layout~~ — RESOLVED | — | done |
| F-7 | `breaking-banner` sliver mode does NOT clip / ellipsize / shrink-to-fit long headlines | T-327 | low |
| F-8 (T-332b) | scoreBug `'racing'` branch lacks tower slide-in entrance + position-change row-slide animations | T-332 | low |
| F-9 (T-332c) | scoreBug `'racing'` sector-record purple pulse animation deferred | T-332 | low |
| F-10 (T-332d) | scoreBug `'racing'` "Smart glass" highlightIndex prop missing | T-332 | low |
| F-11 (T-334a) | scoreBug `'football'` touchdown comic-book celebration deferred | T-334 | low |
| F-12 (T-335a) | scoreBug `'football'` possession-illuminated glow pulse + penalty-flag indicator | T-335 | low |
| F-13 (T-336a/b) | scoreBug `'cricket'` ball-pulse / wicket-flash / boundary-flash / milestone / between-overs expand all deferred | T-336 | low |
| F-14 (T-337a/b) | scoreBug `'tennis'` score-change pulse + server-dot smooth transition + set-complete flash deferred | T-337 | low |
| F-15 (T-339a/b/c) | uefa-starball Starball 3D + refracted-typography + light-wave + Ultimate Stage CGI all deferred | T-339 | medium |
| ~~F-16~~ | ~~CI workflow's `@stageflip/scripts#typecheck` order issue~~ — RESOLVED via PR #395 (this session) | — | done |
| F-17 | CI workflow's `^\.changeset/[a-z0-9-]+\.md$` regex rejects uppercase silently | T-332 | low — process |
| **F-18** | **CI render-e2e Puppeteer `Page.captureScreenshot timed out` flake.** Observed 4× this session: PR #410 (T-373; transient flake; recovered via `gh run rerun --failed`); PR #418 (T-372; ffmpeg-install hang for 12 min on the runner; recovered via cancel + rerun); PR #422 (T-371; 3 consecutive `protocolTimeout` failures on the same screenshot capture step). **Local render of identical fixtures completes in <90s.** Pattern: Puppeteer's default `protocolTimeout` (180000ms = 3 min) is exceeded on slow CI runners, especially when font loading + complex SVG/gradient rendering compounds. Future session should investigate bumping `protocolTimeout` in `packages/renderer-cdp/` or `packages/cdp-host-bundle/`'s puppeteer launch options. Workaround: `gh run rerun <run-id> --failed` (succeeds eventually as different runner picks up). | — (this session) | medium — CI infrastructure |
| **F-19** | **T-317c subscribeButton bell-wiggle animation deferred** | T-317 | low |
| **F-20** | **T-317d subscribeButton cursor slide-in animation deferred** | T-317 | low |
| **F-21** | **T-318a follow-prompt algorithmic toast text "Follow [Creator]" deferred** | T-318 | low |
| **F-22** | **T-318b follow-prompt continuous breathing pulse mode (`pulseRepeat: -1`) deferred** | T-318 | low |
| **F-23** | **T-318c follow-prompt Instagram story-ring v2 fallback deferred** | T-318 | low |
| **F-24** | **T-319a qr-code-bounce live URL→matrix encoding deferred** (v1 ships pre-rendered matrix as prop) | T-319 | medium — limits production usability without external encoding step |
| **F-25** | **T-319b qr-code-bounce branded variant (logo overlay; corner-rounded modules) deferred** | T-319 | low |
| **F-26** | **T-319c qr-code-bounce custom palettes (mono / theme; non-rainbow) deferred** | T-319 | low |
| **F-27** | **T-371a-followup link-sticker tap-depress + link-preview card animation deferred** (v1 ships only `'idle'` + `'shimmering'` phases) | T-371a | low |
| **F-28** | **T-371a-blur link-sticker frosted-glass `backdrop-filter: blur()` deferred** (CDP determinism hazard) | T-371a | medium |
| **F-29** | **T-371a-extend link-sticker Mention/Poll/GIF sticker variants deferred** (v1 link-sticker only) | T-371a | low |

---

## 4. Open quirks worth knowing (updated)

- **`project_init/`** is untracked. NEVER `git add -A`. Every PR this session used specific paths.
- **`docs/compass.md`** does NOT exist on disk. `check-preset-integrity.ts`'s invariant 7 globally SKIPped. Pre-existing; out of scope.
- **Type-design batch sign-off** for Clusters A/B/D/F/G is owned by **T-382**. Cluster G now fully signed → T-382 can now include all 22 Cluster A + B + G presets in its batch review (Cluster D + F still only partially eligible).
- **`signOff.typeDesign: na`** for Cluster E presets + Cluster G's `coinbase-dvd-qr` (no typography). Other Cluster G presets at `pending-cluster-batch`.
- **`docs/ops/parity-fixture-signoff.md`** is procedural-only (per memory `feedback_parity_signoff_doc_is_procedural.md`). Spec briefs MUST NOT instruct Implementers to append entries there.
- **Auto-merge disabled** — use `gh pr merge <pr-number> --squash --delete-branch` (no `--auto`).
- **Lowercase changeset filenames** mandatory (`.changeset/t-XXX-...md`).
- **1280×720 canvas constraint** — parity-CLI generator uses 1280×720 default canvas (NOT 1920×1080). Anchor coords in snapshot props MUST be relative to that. Lesson captured during T-369 (initial spec called for `(1480, 920)` → impl adjusted to `(1040, 640)`); explicitly documented in T-370/T-371/T-372/T-373 specs.
- **F-18 render-e2e CI flake** — sometimes recovers on `gh run rerun --failed`; if ffmpeg install hangs >5 min, cancel the run and rerun via `gh run cancel <run-id>` then `gh run rerun <run-id> --failed`. Local render is the source-of-truth — fixtures generated locally are byte-identical to what CI eventually produces.
- **NO L-sized impl agent timeouts this session** — all 12 implementer dispatches completed under 12 min. M-sized (≤700 LOC) is the timeout-safe zone.

---

## 5. Skills + plan changes this session

- `skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md` — clip catalog 52 → 56 (T-317/T-318/T-319/T-371a rows added). Tranche-ledger entries for each new primitive.
- `packages/skills-sync/src/live-runtime-manifest.ts` — clip list 52 → 56.
- `packages/cdp-host-bundle/src/runtimes.test.ts` — clip count test 52 → 56 + expectedKinds.
- `packages/runtimes/frame-runtime-bridge/src/clips/subscribe-button.tsx` — NEW (612 LOC; 4 platform branches).
- `packages/runtimes/frame-runtime-bridge/src/clips/follow-prompt.tsx` — NEW (552 LOC; 4 platform branches).
- `packages/runtimes/frame-runtime-bridge/src/clips/qr-code-bounce.tsx` — NEW (358 LOC; single-schema posture).
- `packages/runtimes/frame-runtime-bridge/src/clips/link-sticker.tsx` — NEW (~400-500 LOC; 4 variants; gap-fill primitive).
- `packages/engine/src/handlers/cluster-{a,b,e,f}-compose/` — NEW (4 handler bundles, ~3000+ LOC total; 17 `compose_*` tools).
- `packages/engine/src/bundles/catalog.ts` — appended 4 cluster-compose bundle names.
- `scripts/gen-tool-skills.ts` — registered 4 new bundles.
- `packages/engine/src/index.ts` — re-exported 4 new `registerClusterXComposeBundle` entries.
- `skills/stageflip/tools/cluster-{a,b,e,f}-compose/SKILL.md` — auto-gen tool-skills (4 new files).
- `packages/parity-cli/src/generate-fixture.ts` — added 5 new preset bindings (T-369/T-373/T-370/T-372/T-371); `PRESET_ID_BINDINGS` map grew 20 → 25 entries.
- All 5 Cluster G preset stubs promoted `stub → substantive`.
- `scripts/package.json` — added 7 workspace deps (F-16 fix).
- `docs/tasks/T-340.md` / `T-368.md` / `T-331.md` / `T-361.md` / `T-317.md` / `T-369.md` / `T-373.md` / `T-318.md` / `T-370.md` / `T-319.md` / `T-372.md` / `T-371a.md` / `T-371.md` — 13 new spec docs.

`pnpm check-skill-drift`: PASS as of `0f1bd04d`.

---

## 6. Recommended next dispatch (priority-ordered)

### Highest leverage (closes more clusters / advances product-owner ratification)

1. **T-374 Cluster G composer-tools** — M; mirrors T-340/T-368/T-331/T-361 pattern. Brings Cluster G's agent surface up to parity with the 4 originally-ratified clusters. Per `docs/implementation-plan.md:702` ships `compose_cta` / `compose_subscribe_prompt` / `compose_social_handle` / `compose_qr_bounce`. The natural follow-on now that Cluster G is closed.
2. **F-18 CI render-e2e Puppeteer protocolTimeout fix** — bump `protocolTimeout` in renderer-cdp/cdp-host-bundle puppeteer launch options. Affects every future preset PR's CI signal-to-noise.

### Cluster expansion (substantial primitive work)

3. **T-321a (grain) / T-321b (lightLeak) / T-321c (particles) primitive carve-outs** — needed for T-348 stranger-things-benguiat. M-sized each. **5 Cluster D presets blocked.**
4. **T-321d photographic-overlay sister clip** — needed for T-351 true-detective-double-exposure.
5. **ThreeSceneClip integration into T-321** — needed for T-349 got-trajan-clockwork + T-353 severance-surreal-3d.
6. **Video-shot kind on T-321** — needed for T-352 succession-home-video.

### New cluster opening

7. **Cluster C weather presets** — `weatherMap` / `stormTracker` clipKinds; new primitives needed (T-341 → T-346). 6 presets.
8. **Cluster H AR overlays** — frontier track per ADR-005; depends on T-384 ThreeSceneClip; substantial work. 5 presets.

### Larger structural

9. **Track A finale** (T-397–T-405): 9 tasks; renderer-cdp interactive hosting + on-device player + 3-stage security review.
10. **GA closeout** (T-407–T-414): 8 tasks.

### Recommendation for fresh agent

The session is at a natural inflection point. Cluster G's 5/5 ELIGIBLE+RATIFIED state mirrors Clusters A/B/E/F. The next leverage choices split:

- **Operational track**: T-374 Cluster G composer-tools (mirrors prior 4) → closes the agent-surface gap on the newest cluster.
- **CI infra cleanup**: F-18 protocolTimeout fix improves every future preset PR's CI reliability.
- **Cluster expansion**: pick D / C / H. Cluster D has the most predecessors (5 carve-outs needed) but unlocks 5 presets at once. Cluster C requires brand-new clipKinds. Cluster H requires ThreeSceneClip integration (frontier track).

A pragmatic ordering: **T-374 Cluster G composer-tools → F-18 CI protocolTimeout fix → first Cluster D primitive (T-321a grain)**.

---

## 7. Ratification log (continued from handover-phase13-cluster-b §7)

### Prior sessions (2026-05-06)

- **Cluster E (data)**: 6/6 RATIFIED ✓
- **Cluster A (news)**: 8/8 RATIFIED ✓ (after fox-news-alert headline shortening)
- **Cluster F (captions)**: 6/6 RATIFIED ✓ (after netflix-invisible re-signed via T-316b)

### Prior session (2026-05-07)

- **Cluster B (sports)**: 9/9 RATIFIED ✓

### This session (2026-05-07)

#### Cluster G (CTAs / social) — RATIFIED 2026-05-07

All 5 preset goldens visually inspected against compass. PASS:

- `youtube-subscribe-bounce` (1st `subscribeButton` PRESET_ID_BINDINGS consumer; bottom-right anchored YouTube SUBSCRIBE pill; YouTube red `#FF0000` + white sans uppercase; settled `'idle'` phase at frame 60 past entrance bounce)
- `social-handle-lower-third` (6th lowerThird PRESET_ID_BINDINGS consumer; bottom-left canvas-safe `insetLeftPx: 96, insetBottomPx: 96`; black rounded panel with `@yourbrand` + `Follow us everywhere`; Inter Bold OFL fallback)
- `tiktok-follow-pulse` (1st `followPrompt` PRESET_ID_BINDINGS consumer; right-thumb-zone; faint pink pulse-ring expanding around avatar circle at frame 30 mid-pulse-decay; TikTok pink `#FE2C55` "+" badge)
- `coinbase-dvd-qr` (1st `qrCodeBounce` PRESET_ID_BINDINGS consumer; pure black background + bright pure-green synthetic 21×21 QR matrix mid-flight at frame 60; HSL hue at hue ≈ 51° green band; ZERO branding per Coinbase Super Bowl canon; PSNR=38/SSIM=0.94 motion-blur thresholds)
- `instagram-link-sticker` (1st `socialMedia` PRESET_ID_BINDINGS consumer; rounded pill at canvas center; black surface + white `instagram.com/yourhandle` text + Inter Medium fallback; mid-shimmer band visible at frame 60 right-of-center per closed-form math `computeShimmerX(60, 90, 200, 40) ≈ 120`)

Ratification authority: product owner (mario.tiedemann@showheroes.com).

Cluster G is **5/5 ELIGIBLE + RATIFIED**.

### Pending PO inspection

_(none — all 5 batch-eligible clusters now fully ratified)_

---

## 8. Verification checklist for next agent

Run these before dispatching any P13 task:

```bash
git checkout main && git pull --ff-only

git status   # project_init/ untracked is expected

# Confirm gates green
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-determinism
pnpm check-skill-drift
pnpm gen:tool-skills:check
pnpm skills-sync:check

# Confirm cluster eligibility claims
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=news        # → ELIGIBLE (8/8)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=sports      # → ELIGIBLE (9/9)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=data        # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=captions    # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ctas        # → ELIGIBLE (5/5)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=titles      # → 1/6 NOT ELIGIBLE
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=weather     # → 0/4 NOT ELIGIBLE
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ar          # → 0/5 NOT ELIGIBLE

# Confirm clip count
grep -E "toBe\(56\)" packages/cdp-host-bundle/src/runtimes.test.ts | head -2
```

Expected `main` HEAD: **`0f1bd04d`** (or descendant if `changeset-release` automation has fired).

---

## 9. Pointers for unfamiliar surfaces

- **CLAUDE.md** — hard rules (§3 determinism, §4 workflow, §10 where things go, §11 implementer's checklist).
- **`docs/implementation-plan.md` §"Phase 13"** — task list lines 567–800 + dependency gates.
- **`docs/decisions/ADR-003.md`** — Interactive Runtime Tier.
- **`docs/decisions/ADR-004.md`** — Preset System (frontmatter shape; sign-off ladder; type-design batch process).
- **`docs/decisions/ADR-005.md`** — Frontier Clip Catalogue.
- **`packages/parity-cli/src/generate-fixture.ts`** — `DEFAULT_CLIP_KIND_RESOLVER` switch + `PRESET_ID_BINDINGS` override map. **25 PRESET_ID_BINDINGS entries** post-this-session.
- **`packages/runtimes/frame-runtime-bridge/src/clips/{subscribe-button,follow-prompt,qr-code-bounce,link-sticker}.tsx`** — 4 new primitives shipped this session.
- **`packages/engine/src/handlers/cluster-{a,b,e,f}-compose/`** — 4 new handler bundles shipped this session (17 `compose_*` tools).
- **`MEMORY.md`** — `feedback_git_add_specific_paths.md`, `feedback_biome_format_before_commit.md`, `feedback_parity_signoff_doc_is_procedural.md`. Read before any commit.

---

## 10. PR cycle times observed (this session)

For calibration:
- **Spec PR**: ~5–10 minutes (Orchestrator agent draft + commit + push + open + manual squash-merge).
- **Implementer PR (clean S/M)**: ~5–10 minutes; **M with primitive scope**: ~10–13 minutes.
- **Manual squash-merge** (auto-merge disabled): adds ~10s after `gh pr create` returns.
- **render-e2e flake recovery** (F-18): adds 3-15 minutes per occurrence; mitigation = `gh run rerun --failed` or `gh run cancel <id> + gh run rerun --failed` if ffmpeg install hangs.

---

**Phase 13 progress: 35/50 presets signed (was 33/50 at start of session — ratified Cluster B + closed Cluster G end-to-end). 5 clusters batch-eligible (was 4 at session start). 5 fully ratified. 56 bridge clips (was 52). 4 new primitives. 4 new composer-tool bundles. Forward.**
