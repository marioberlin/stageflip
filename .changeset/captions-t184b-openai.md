---
"@stageflip/captions": minor
---

T-184b: real OpenAI Whisper provider behind the T-184a seam.

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
