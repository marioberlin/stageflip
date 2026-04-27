// packages/export-google-slides/src/renderer/types.ts
// Re-export of `RendererCdpProvider` for module-local consumers. The interface
// itself lives in `../types.ts`; this file exists to keep the renderer
// concept addressable as `@stageflip/export-google-slides/renderer/*` if we
// ever publish a sub-path export.

export type { RendererCdpProvider } from '../types.js';
