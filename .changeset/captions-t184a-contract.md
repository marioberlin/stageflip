---
"@stageflip/captions": minor
---

T-184a: captions pipeline contract + packing + SHA-256 cache + mock provider.

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
