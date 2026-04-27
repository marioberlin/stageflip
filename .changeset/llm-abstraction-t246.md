---
"@stageflip/llm-abstraction": minor
---

T-246: multimodal-image content block (additive). `LLMContentBlock` gains an
`image` variant carrying `{ mediaType: 'image/png' | 'image/jpeg' |
'image/webp', data: <base64> }`. `LLMErrorKind` gains an `'unsupported'`
variant. The Google provider translates image blocks to Gemini's
`inlineData: { mimeType, data }` shape; Anthropic and OpenAI providers
throw `LLMError({kind: 'unsupported'})` on image input until follow-on
tasks bind their image-input shapes.

Backward compatible: existing text-only callers see no behavior change.
Image blocks are request-side only — the streaming `LLMStreamEvent` union
is intentionally NOT extended (Gemini doesn't stream image inputs back).
