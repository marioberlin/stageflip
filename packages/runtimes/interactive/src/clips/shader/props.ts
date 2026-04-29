// packages/runtimes/interactive/src/clips/shader/props.ts
// Local re-export of the shader-clip props type from `@stageflip/schema`.
// Keeps the dependency direction `runtimes-interactive → schema` (correct)
// and lets the factory + uniform updater consume a single source of truth
// for the prop shape. The schema package owns the Zod definition; this file
// is a typed pass-through.

export type { ShaderClipProps, UniformValue } from '@stageflip/schema';
