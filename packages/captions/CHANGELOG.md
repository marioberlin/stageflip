# @stageflip/captions

## 0.1.0

### Minor Changes

- ea91bf8: T-184a: captions pipeline contract + packing + SHA-256 cache + mock provider.

  New package `@stageflip/captions` — the authoring-time caption pipeline for
  StageFlip.Video. Ships everything except the real OpenAI Whisper provider,
  which lands in T-184b behind the same `TranscriptionProvider` seam.

  Public API:
  - **`TranscriptionProvider`** — interface for any Whisper-compatible backend.
    Must be pure-in-inputs so the content-hash cache is safe.
  - **`createMockProvider({ words, msPerWord, gapMs, language })`** —
    deterministic test provider.
  - **`packWords(words, { maxCharsPerLine, maxLines, minSegmentMs? })`** —
    greedy word-level → multi-line `CaptionSegment[]` packer. Enforces a
    minimum segment duration (default 400 ms) so brief words don't flash.
    Over-long single words overflow rather than mid-word-breaking.
  - **`deriveCacheKey(source, language?)`** — content-hashes `bytes` payloads
    with SHA-256 via Web Crypto; URL sources hash the URL string.
    `language` (or literal `'auto'`) is part of the key so English vs German
    transcriptions of the same bytes don't collide.
  - **`createMemoryCache()`** — default in-memory `TranscriptCache`. Swap in a
    disk/Redis backend behind the same contract.
  - **`transcribeAndPack({ source, language?, pack, provider, cache? })`** —
    end-to-end: cache lookup → provider → cache store → pack. Re-running
    with identical inputs is zero-provider-cost; pack options can change
    between calls without invalidating the cached transcript.

  Skill updated: `skills/stageflip/concepts/captions/SKILL.md` current-state
  section now names T-184a's contract and flags T-184b as the real-provider
  follow-up.

  Tests: 31 total across 5 files (pack, hash, cache, mock provider, pipeline).
  Zero opinionated runtime deps — uses Web Crypto via `crypto.subtle`, so the
  package runs in Node 20+ and every modern browser.

- 41c4960: T-184b: real OpenAI Whisper provider behind the T-184a seam.

  New `createOpenAIProvider` wraps `openai.audio.transcriptions.create` with
  `response_format: 'verbose_json'` + `timestamp_granularities: ['word']`.
  Responses are normalised to the internal `Transcript` shape (seconds →
  milliseconds, `word` → `text`).
  - **SDK seam**: exposes an `OpenAILike` interface; unit tests inject a
    fake, production wiring calls `new OpenAI({ apiKey })`. No network
    in tests.
  - **Source**: accepts `bytes` audio only. URL sources must be fetched
    into a `Uint8Array` by the caller (determinism + rate-limit concerns
    belong at that boundary).
  - **Options**: `apiKey`, `model` (default `'whisper-1'`), `filename`
    (default `'audio.wav'`), `signal` (abort), `client` (DI).
  - **Caching**: plays cleanly with `transcribeAndPack` — same bytes +
    same language hit the SHA-256 cache and never re-call OpenAI.

  9 new tests. Captions 40/40 green. `openai@6.34.0` added as a direct
  dependency (already pinned by `@stageflip/llm-abstraction`).

### Patch Changes

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0
