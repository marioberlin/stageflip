// packages/schema/src/clips/interactive/index.ts
// Re-exports per-family `liveMount.props` schemas. T-383 lands the first
// (`shader`); future Phase γ tasks (T-384 three-scene, T-389 ai-chat,
// T-393 web-embed, etc.) co-locate their per-family schemas here.
//
// BROWSER-SAFE: pure Zod re-exports.

export {
  shaderClipPropsSchema,
  uniformValueSchema,
  type ShaderClipProps,
  type UniformValue,
} from './shader-props.js';
export {
  threeSceneClipPropsSchema,
  type ThreeSceneClipProps,
} from './three-scene-props.js';
export {
  voiceClipPropsSchema,
  type VoiceClipProps,
} from './voice-props.js';
export {
  aiChatClipPropsSchema,
  type AiChatClipProps,
} from './ai-chat-props.js';
