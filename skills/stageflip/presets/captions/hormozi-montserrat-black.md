---
id: hormozi-montserrat-black
cluster: captions
clipKind: caption
source: docs/compass_artifact.md#alex-hormozi
status: substantive
preferredFont:
  family: Montserrat
  license: ofl
fallbackFont:
  family: Montserrat
  weight: 800
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# Hormozi-style — Montserrat 800 caption

Alex Hormozi's iconic short-form caption register: heavy black-stroked Montserrat 800 caps, high-contrast yellow highlight on the active word, fast word-by-word refresh. Common uses: short-form vertical voiceover captions (Reels / TikTok / Shorts), educational + sales / marketing lower-thirds, talking-head + course content. The style has become near-universal in modern social-video editing because it survives muted autoplay and thumbnail crops — every word stays readable against any background.

This preset is the **first Cluster F preset to land** AND the **first preset to exercise the `CaptionClip` primitive (T-316) end-to-end**. The `'hormozi'` style bundle on the primitive supplies the Montserrat 800 caps + black stroke (6 px) + yellow `#FFD60A` highlight + `rise` entrance with 80 ms stagger defaults; this preset's contract is the **shape** (word-by-word entrance + active-word highlight + black stroke), not any literal payload. Sister Cluster F presets (T-363+ mrbeast / tiktok / ali-abdaal / netflix / karaoke-progressive-wipe) bind to the same primitive with different style-bundle enum values; tenants supply their own `WordTiming[]` from an audio-derived transcript at compose time.

## Visual tokens

The active word IS the message. Layout (1280×720 default; 1080×1920 vertical preserves the lower-third anchor):

- **Caption block** sits in the lower third — `position: { x: 128, y: 432, width: 1024, alignment: 'center' }` on the parity composition (10% inset, 60% down, 80% width). On vertical compositions the same percentages anchor at the lower-third band above the platform UI overlay.
- **Base (rest) text** renders in `#FFFFFF` with `strokeWidth: 6` `strokeColor: #000000`. Stroke is rendered via SVG `<text>` with `paint-order: stroke fill` (T-316 D-T316-7) — the stroke wraps every glyph cleanly without halo artifacts.
- **Active word** renders in `#FFD60A` (the `'hormozi'` bundle's `highlightColor`). Single-color highlight; per-keyword color cycling (yellow / green / red) is the MrBeast register (T-363).
- **Background** is the canvas backdrop — captions overlay on video at compose time. The CaptionClip primitive's container is `transparent` and the `background` prop is honored only when `backdrop !== 'none'` (the Hormozi bundle's `backdrop` is `'none'`); the parity golden therefore renders against the host bundle's default white canvas. Stroke contrast carries the read at the parity frame: the 6 px black stroke around every glyph stays crisp on white, the yellow `#FFD60A` highlight on word 6 stays distinct, and the white foreground reads only via its stroke outline (the canonical Hormozi look on a video underlay; rest words on a white parity backdrop intentionally appear as outlined glyphs). Live compositions let the underlying video stream bleed through and the white-fill foreground recovers full visibility.
- **No drop shadow.** The original stub mentioned a subtle 0 / 4 / 4 px black shadow at 30% opacity; `captionPropsSchema` does not model shadow in v1. Achievable via a compose-layer SVG filter if a tenant demands it; absent from the parity contract.
- **No backdrop fill** (`backdrop: 'none'`). Pill / rect backdrops are the TikTok (T-364) and Netflix (T-366) registers respectively; Hormozi reads against the raw stroke + highlight contrast.

## Typography

- **`preferredFont: Montserrat`** (OFL via Google Fonts), weight `800`. Reconciled from the original stub's "Montserrat Black" + weight 900 nomenclature per D-T362-7: the `'hormozi'` STYLE_BUNDLES bundle (T-316 D-T316-2, `packages/runtimes/frame-runtime-bridge/src/clips/caption.tsx` line 134) ships `font.weight: 800` — the bundle is the source of truth and this preset follows it. "Black" is an Adobe / Photoshop weight-naming convention; Google Fonts ships Montserrat as a single OFL family with weights 100–900, and weight 800 is a single-step lighter than the 900 "Black" cut. Visual difference at 96 px is small; license-clean across every rendering medium (no BYO posture).
- **`fallbackFont: Montserrat`** (OFL), weight `800`. Identical to the preferred face — the OFL face IS the canonical pick. Mirrors the cluster-E "no fallback escape hatch" posture; the tighter the register, the less room for fallback drift.
- **`fontSize: 96`** (the bundle's default). At 1280 px composition width, six words at 96 px Montserrat 800 fill the 1024 px position width without wrapping for the canonical six-word phrase; longer transcripts flex-wrap automatically via the inner `flex-wrap: wrap` container (`caption.tsx` line 570).
- **`casing: 'uppercase'`** (the bundle's default; "ALL UPPERCASE for emphasis is the signature"). Applied at render time via `applyCasing` (`caption.tsx` line 226–231); the underlying `WordTiming.text` payload preserves authored case for transcript editing.
- **4–6 words per line** is the canonical word count at this position width and font size. Tenants supplying transcripts longer than ~6 words per visual segment should split at the WordTiming layer (one CaptionClip mount per segment) — multi-line caption wrapping is out of CaptionClip's v1 envelope (T-316 D-T316-6) and the primitive's auto-wrap, while functional, blunts the "one beat per phrase" reading rhythm.
- **Tabular numerals are not relevant** — the Hormozi register is text-heavy; numeric content uses the bigNumber preset family (Cluster E).

## Animation

- **Word entrance** uses the `'rise'` mode with `staggerMs: 80`. The CaptionClip primitive's entrance window is 12 frames (`ENTRANCE_FRAMES`, `caption.tsx` line 105) ≈ 400 ms at 30 fps. Each word's entrance starts `i * staggerMs` ms BEFORE its `startMs` (`computeEntrance` line 268–270) so by the time the word is "active" the entrance has fully settled; the visible behavior is opacity 0 → 1 + translateY +40 px → 0 across the entrance window.
- **Active-word highlight.** A word becomes "active" when `currentTimeMs >= word.startMs && currentTimeMs < word.endMs` — the strict-less-than upper bound ensures exactly one word is active at any frame on the boundary. Active words swap from `foreground: #FFFFFF` to `highlightColor: #FFD60A`; the swap is a snap (no fade) — the per-frame deterministic visibility rule is the contract.
- **No active-word scale pulse.** The original stub mentioned 1.0 → 1.1 → 1.0 emphasis on key words; CaptionClip's v1 `'hormozi'` bundle does not expose a scale-pulse knob and the entrance `'rise'` carries the visual accent. A future emphasis-pulse axis is a flagged follow-up.
- **No word-exit animation.** Past words remain visible at rest state (`foreground` color) until the entire CaptionClip mount unmounts. Future-word visibility is gated by the entrance opacity (`entrance !== 'none'` allows pre-`startMs` rendering at opacity 0); past-word visibility is unconditional.
- **Snap-cut between caption events.** No fade-out; the host pipeline mounts a fresh CaptionClip per phrase, and the unmount is instantaneous.
- **Synced precisely to audio word-level timestamps** in production. The host pipeline (or tool agent) emits the `WordTiming[]` from a transcript-with-timings source (Whisper word-level, ElevenLabs alignment, etc.); the primitive consumes the array as data per T-316 D-T316-4 — no audio decoding inside the primitive.

## Rules

- **Bound primitive**: `caption` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/caption.tsx`, exported as `Caption` + `captionClip`). The `caption` `clipKind` is in `VALID_CLIP_KINDS` (per T-316 D-T316-13, `scripts/check-preset-integrity.ts` line 70); the v1 resolver in `packages/parity-cli/src/generate-fixture.ts` maps `clipKind: 'caption' → caption` via the clipKind-default branch added by T-362. Composing tools should mount `Caption` with `style: 'hormozi'`, a `WordTiming[]` payload, and a `position` — the bundle supplies font / casing / foreground / highlight / stroke / entrance / stagger defaults.
- **Word-level timing is mandatory.** The primitive consumes `WordTiming[]` (`{ text, startMs, endMs, emphasis? }`); sentence-level captions are wrong for this register because the active-word highlight depends on per-word boundaries. Tenants without word-level timestamps must split sentences upstream (Whisper word-level alignment is the standard input).
- **`style: 'hormozi'` is the canonical enum value.** Per-prop overrides (custom `font`, `highlightColor`, `strokeWidth`) win over the bundle defaults but break the visual register; document any override in the composition's authoring metadata. The bundle's defaults are the contract.
- **Single-color highlight only.** `highlightColor` is `#FFD60A` (yellow); per-keyword color cycling (yellow / green / red on selected emphasis words) is the MrBeast register (T-363) and uses the bundle's `highlightColor` array form. Hormozi is single-color; the original stub's prose mentioning yellow / green / red conflated the two registers and is corrected here.
- **No background prop on the CaptionClip.** The `background` field is documented for the parity golden's solid backdrop only; live compositions render the caption as a transparent overlay on a video stream. The bundle's `background: '#000000'` is a fallback used only if `backdrop !== 'none'` (which it isn't — `'none'`).
- **Theme slot mapping**: `background`, `foreground`, `highlightColor`, `muteColor`, `strokeColor` map to palette roles (background / foreground / accent / foreground / background respectively per `captionClip.themeSlots`). Tenant theme overrides flow through these slots at composition time without touching the preset.
- **Reference frame for parity is mid-hold (frame 45)** — `currentTimeMs = 1500 ms` at 30 fps. By the primitive's word-visibility rule all six words are visible; by the active rule word 6 (`"forever"`, `startMs: 1500, endMs: 1800`) is active. Frame 45 sits well past the entrance window for every word (last entrance settled by frame ≈ 33). The PSNR / SSIM thresholds are stricter than the script default — see Acceptance below.
- **No live data.** The `permissions` array is empty; no network call, no telemetry source. Audio sync / live transcription is a host concern.

## Acceptance (parity)

One reference-frame fixture at `frame: 45` (mid-hold steady-state per ADR-004 §D5; D-T362-6):

- `golden-frame-45.png` — `THIS WILL CHANGE YOUR LIFE FOREVER` rendered at Montserrat 800 96 px caps (the system Montserrat fallback resolves through the `Montserrat, system-ui, ...` stack baked into the `'hormozi'` bundle; the host bundle does not preload Google Fonts' OFL Montserrat in v1, a primitive-side concern flagged for follow-up), `#000000` stroke at 6 px wrapping every glyph, word 6 (`FOREVER`) in `#FFD60A` highlight with the prior five words in white-stroked rest state. Entrance has fully settled — all words at full opacity, translateY 0. Background is the host bundle's default white canvas (the `background: '#0E0E12'` declared in the resolver's `buildProps` is unreachable per the primitive's `backdrop: 'none'` rule on this bundle); stroke contrast carries the read.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (stricter than the generator default `35 / 0.95`; mirrors the cluster-E sister presets per D-T362-9). The preset-driven-thresholds follow-up flagged during T-359b is the formal mechanism for per-preset deviation; for now the threshold values are hand-pinned in `parity-fixtures/captions/hormozi-montserrat-black/thresholds.json` post-generation. A heavy-stroke caption with crisp glyph-stroke boundaries on a dark background is more antialiasing-sensitive than a pure-text bigNumber but less sensitive than a moving scroll band — the captions are static at the parity frame (entrance settled).

**Sign-off (T-362 D-T362-8, in-PR):** the canonical mid-hold golden is committed at `parity-fixtures/captions/hormozi-montserrat-black/` with the single-variant manifest shape (no `variants` key, per T-359a backward compat). Frontmatter `signOff.parityFixture` flips to `signed:<today UTC>` via `pnpm tsx scripts/generate-preset-parity-fixture-prod.ts --preset=hormozi-montserrat-black --frame=45 --mark-signed`. Frontmatter `signOff.typeDesign` STAYS `pending-cluster-batch` — Cluster F is in `TYPE_DESIGN_REQUIRED_CLUSTERS` (`scripts/check-preset-integrity.ts` line 124); T-368 batch type-design review (paired with `reviews/type-design-consultant-cluster-f.md`) flips this to `signed:<date>` for every Cluster F preset in one batch, NOT in this PR. Re-render + re-sign with `--force` is the operator's path if the FontManager preload list updates the rendered Montserrat weight or the canonical phrase changes.

## References

- `docs/compass_artifact.md` § Alex Hormozi — canonical visual source (note: on-disk path mismatch flagged for resolution; integrity invariant 7 SKIPped globally).
- `packages/runtimes/frame-runtime-bridge/src/clips/caption.tsx` — the bound primitive (`Caption`, `captionClip`); the `'hormozi'` STYLE_BUNDLES bundle (lines 134–148) is the source of truth for font / casing / foreground / highlight / stroke / entrance / stagger defaults.
- `packages/parity-cli/src/generate-fixture.ts` — v1 resolver mapping `caption → caption` plus the exported `HORMOZI_CANONICAL_WORDS` six-word snapshot (T-362 D-T362-4 / D-T362-6).
- `skills/stageflip/presets/captions/SKILL.md` — Cluster F conventions (owned by T-368).
- `skills/stageflip/concepts/captions/SKILL.md` — caption concept (transcription, packing, word-level timing).
- `docs/tasks/T-316.md` — CaptionClip primitive spec (the central dep).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- "Most widely imitated caption style in short-form video since 2022."
