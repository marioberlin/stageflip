---
title: Captions
id: skills/stageflip/concepts/captions
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-184
related:
  - skills/stageflip/modes/stageflip-video/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Captions

StageFlip.Video ships auto-generated captions that stay synced to the audio
within **±100 ms** across every produced aspect ratio.

## Pipeline

1. Source audio is extracted to 16 kHz mono PCM.
2. Whisper API transcribes, returning word-level timestamps.
3. Words are grouped into "caption cells" sized for readability (max 2 lines,
   max ~40 chars per line at 16:9; tighter at 9:16).
4. Cells are attached to the timeline as `caption` elements with start/end
   frames aligned to the RIR timing grid.
5. The validator checks end-of-caption to end-of-spoken-phrase drift on a
   sample grid; drift > 100 ms fails the gate.

## Determinism and caching

- Transcription is cached by `sha256(audio-bytes || language-hint)`. Identical
  input bytes never re-hit Whisper.
- The cache is a content-addressed store; same hash across dev/CI/prod.
- Cell packing is deterministic: same transcript + same target aspect ratio
  → same cells byte-for-byte.

This means "re-render the same video" never re-incurs Whisper cost or drifts
captions.

## Aspect-bounce interaction

When a video is bounced to 9:16 / 1:1 / 16:9 (T-185), the caption packing
re-runs per aspect. Transcript text is identical; cell boundaries differ
because max-chars-per-line differs.

## Styling

Caption appearance comes from the theme's caption slot (`theme.captions.*`).
Burned-in vs. sidecar `.vtt` is an export-time choice. IAB banners don't
support captions (budget-forbidden); see `concepts/display-budget`.

## Current state (Phase 8, T-184a)

- **Schema shape** is live: `captionTrackSchema` + `captionSegmentSchema` in
  `packages/schema/src/content/video.ts`. `VideoContent.captions` is optional
  and carries pre-segmented Whisper output.
- **Package** `@stageflip/captions` ships the pipeline contract + a deterministic
  word→segment packer + a SHA-256 content-hash `TranscriptCache` + an in-memory
  default cache + a mock provider for tests. The public entry is
  `transcribeAndPack({ source, language?, pack, provider, cache? })`.
- **Real Whisper provider** (OpenAI SDK) lands in **T-184b** — the
  `TranscriptionProvider` seam is already in place.
- **Per-aspect bouncing** of packed segments is **T-185**; the packer
  already accepts the `maxCharsPerLine` that T-185 will vary per aspect.

## Usage

```ts
import {
  createOpenAIWhisperProvider,
  defaultPackWords,
  transcribeAndPack,
} from '@stageflip/captions';

const result = await transcribeAndPack({
  source: audioBytes,
  language: 'en',
  pack: (words) => defaultPackWords(words, { maxCharsPerLine: 40, maxLines: 2 }),
  provider: createOpenAIWhisperProvider({ apiKey: process.env.OPENAI_API_KEY }),
});

// result.segments: ReadonlyArray<CaptionSegment> — attach directly to
// `VideoContent.captions` without further transformation.
```

The cache key is `sha256(audio-bytes || language-hint)`. Re-running with the same inputs hits the cache and skips the provider entirely.

## TTS bypass path (T-436)

When the audio came from a known TTS adapter that already emits per-word
timestamps, the captions pipeline can **skip Whisper entirely** — the
adapter's own `TtsResult.wordTimestamps` flows straight into `packWords()`.
This eliminates the ~$0.006/min Whisper cost on AI-generated narration
(~30 % of the captions cost line on TTS-bearing decks).

### Whitelist

Initial trusted TTS adapter ids (T-436):

```
['kokoro', 'fish-speech']
```

Whitelist membership is the host-side trust signal. An adapter declaring
`TtsCapabilityDescriptor.emitsWordTimestamps: true` is **not** automatically
trusted — pair every whitelist addition with a SKILL update. The whitelist
is a static `as const` array in `packages/captions/src/tts-bypass.ts`;
add a third entry by editing the literal and the test in
`tts-bypass.test.ts` that asserts the whitelist length.

### Eligibility

The bypass fires when ALL hold:

- `provenance.kind === 'tts'`
- `provenance.provider` is on `TTS_BYPASS_WHITELIST`
- `wordTimestamps` is a non-empty array
- every entry has a non-empty `word`, `startS >= 0`, and `endS > startS`

Any failure silently falls through to the standard Whisper-backed
`transcribeAndPack()` call — the bypass never throws on data-shape
mismatch. This keeps live-recorded, imported, or generated-without-
timestamps audio behaving exactly as before.

### Result

The bypass uses `transcribeAndPackWithTtsBypass()` which returns
`CaptionPipelineResultWithBypass` — a superset of `CaptionPipelineResult`
that adds:

- `viaTtsBypass?: true` — set only when bypass fired
- `ttsBypassProvider?: 'kokoro' | 'fish-speech'` — the trusted provider

Consumers inspect these to render "Auto-generated from TTS provider X"
UX or to expose a "Re-run via Whisper" override. The `CaptionSegment`
schema itself is unchanged — provenance metadata lives on the wrapper.

### Determinism

Seconds → milliseconds conversion uses `Math.floor(seconds * 1000)`
(not `round`), so repeated calls with the same upstream `wordTimestamps`
produce byte-identical `CaptionSegment[]`. The bypass path does not touch
the SHA-256 transcript cache — the cache key is content-addressed to the
audio bytes; bypass output is already a deterministic function of the
upstream `TtsResult.wordTimestamps`, so caching adds no dedupe leverage.

### Usage

```ts
import { transcribeAndPackWithTtsBypass } from '@stageflip/captions';

const result = await transcribeAndPackWithTtsBypass({
  source: audioBytes,
  language: 'en',
  pack: { maxCharsPerLine: 40, maxLines: 2 },
  provider: createOpenAIWhisperProvider({ apiKey: process.env.OPENAI_API_KEY }),
  tts: {
    provenance: { kind: 'tts', provider: 'kokoro' },
    wordTimestamps: ttsResult.wordTimestamps, // straight off the TtsResult
  },
});

if (result.viaTtsBypass) {
  // Whisper was not called; segments came from Kokoro/Fish Speech.
}
```

The `tts` argument is optional: omitting it makes the wrapper behave
identically to plain `transcribeAndPack()`.

## Related

- Mode: `modes/stageflip-video/SKILL.md`
- Task: T-184 (impl), T-185 (aspect bounce), T-436 (TTS bypass)
- TTS adapters: T-426 (Kokoro), T-427 (Fish Speech)
- Provenance schema: T-421 (`MediaProvenance`)
- Whisper SDK: pinned in `docs/dependencies.md`
