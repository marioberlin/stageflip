// packages/schema/src/clips/index.ts
// Public surface of the interactive-clip contract (T-305) — BROWSER-SAFE.
// Schemas + types + the export matrix only. No I/O. The runtime tier
// (T-306, `packages/runtimes/interactive/`) consumes this surface; per-family
// frontier clip implementations (T-383–T-396) extend `liveMount.props` with
// discriminated unions keyed by `family`.

export {
  componentRefSchema,
  INTERACTIVE_CLIP_FAMILIES,
  interactiveClipSchema,
  liveMountSchema,
  permissionSchema,
  type ComponentRef,
  type InteractiveClip,
  type InteractiveClipFamily,
  type LiveMount,
  type Permission,
} from './interactive.js';
export {
  EXPORT_MATRIX,
  exportTargetSchema,
  resolveClipPath,
  type ExportTarget,
  type ResolvedClipPath,
} from './export-targets.js';
export {
  shaderClipPropsSchema,
  threeSceneClipPropsSchema,
  uniformValueSchema,
  voiceClipPropsSchema,
  type ShaderClipProps,
  type ThreeSceneClipProps,
  type UniformValue,
  type VoiceClipProps,
} from './interactive/index.js';
