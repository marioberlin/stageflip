---
'@stageflip/captions': patch
---

T-436 — TTS→captions bypass-Whisper integration. Synthesized audio from
whitelisted TTS adapters (Kokoro, Fish Speech) can now skip the Whisper
transcription call: `transcribeAndPackWithTtsBypass()` consumes the
adapter's own `wordTimestamps` and builds `CaptionSegment[]` directly.
Falls through to the existing `transcribeAndPack()` Whisper path for
non-whitelist providers, missing timestamps, or malformed shapes. Pure
addition — existing Whisper code path unchanged.
