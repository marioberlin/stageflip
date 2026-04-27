// packages/import-google-slides/src/aiqc/index.ts
// Public surface for the AI-QC convergence pass (T-246). Composes after
// `parseGoogleSlides` and before `resolveAssets`:
//
//   const tree = await parseGoogleSlides({ presentationId, auth, cv });
//   const aiqc = await runAiQcConvergence(tree, { llm: geminiProvider });
//   const resolved = await resolveAssets(aiqc.tree, fetcher, storage);

export { runAiQcConvergence, collectResiduals } from './runAiQcConvergence.js';
export type {
  AiQcErrorCode,
  AiQcOutcome,
  AiQcResolution,
  GeminiResolutionResponse,
  RunAiQcConvergenceOptions,
  RunAiQcConvergenceResult,
} from './types.js';
export {
  AIQC_RESPONSE_SCHEMA_DESCRIPTION,
  AIQC_SYSTEM_PROMPT,
  buildLlmRequest,
  buildUserMessage,
  buildUserText,
} from './prompt.js';
export {
  geminiResolutionSchema,
  parseGeminiResolution,
  stripMarkdownFences,
} from './response-validator.js';
export { applyResolutionToElement, mapShapeKind, replaceElementInSlide } from './writeback.js';
export { createStubGeminiProvider } from './stub-provider.js';
export type { StubGeminiProvider, StubResponseFactory, StubResponseSpec } from './stub-provider.js';
export { cropPageImagePngBase64 } from './crop.js';
export type { CropBboxPx, PageImagePng } from './crop.js';
