---
"@stageflip/runtimes-interactive": minor
"@stageflip/schema": minor
---

T-390: ship `staticFallback` for `family: 'ai-chat'`. Closes the γ-live
`AiChatClip` family (T-389 + T-390); after T-390, both halves are
structurally complete.

`@stageflip/schema`:

- `aiChatClipPropsSchema` gains an optional `capturedTranscript?: Array<{
  role: 'user' | 'assistant'; text: string }>` field. Strict per-turn
  shape; `text` non-empty. Existing T-389 fixtures without the field
  continue to validate (T-390 AC #4). Browser-safe — pure Zod.
- New exported type `AiChatCapturedTranscriptTurn`.

`@stageflip/runtimes-interactive`:

- New `defaultAiChatStaticFallback` generator: deterministic Element[]
  layout — a TextElement summarising the truncated `systemPrompt` plus
  one TextElement per turn in `capturedTranscript` (alternating
  alignment by role). When `capturedTranscript` is absent or empty, a
  single placeholder TextElement (empty text, host-replaceable via
  app-level i18n) is appended.
- Byte-for-byte determinism across calls (T-390 AC #5). No
  `Math.random`, no `Date.now`. Same posture as
  `defaultVoiceStaticFallback`.
- New `aiChatStaticFallbackGenerator` registered against
  `staticFallbackGeneratorRegistry` for `family: 'ai-chat'` at subpath
  import time. The harness's family-agnostic dispatch (T-388a) picks
  up the registration; no harness modifications.
- Telemetry event `ai-chat-clip.static-fallback.rendered` carries
  integer-length attributes only — `transcriptTurnCount`,
  `systemPromptLength`. The systemPrompt body and per-turn bodies are
  NEVER attached to telemetry (D-T390-4 privacy posture; same as T-389
  D-T389-8).
- Authored-path telemetry preserved per T-388a D-T388a-3: the harness
  invokes the generator with `reason: 'authored'` even when authored
  fallbacks are non-empty so per-family telemetry continues to fire on
  the authored path.

After T-390, `family: 'ai-chat'` is structurally complete. T-391
(LiveDataClip) is the next γ-live dispatch.
