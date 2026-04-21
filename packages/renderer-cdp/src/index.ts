// packages/renderer-cdp/src/index.ts
// Public surface of @stageflip/renderer-cdp. Layers, outermost first:
//
//   - exportDocument + PreflightBlockedError — the top-level orchestrator
//     (T-084) that ties preflight, adapter, and sink together.
//   - preflight + PreflightReport — pure sync analysis (T-084).
//   - resolveAssets + AssetResolver + InMemoryAssetResolver — async asset
//     preflight, URL rewrite to file:// (T-084a).
//   - collectAssetRefs + rewriteDocumentAssets — the pure traversal +
//     rewriter under the resolver (T-084a).
//   - LiveTierAdapter + CdpSession seam — the session abstraction (T-083).
//   - dispatchClips — the RIR→registry resolver under the adapter (T-083).
//   - InMemoryFrameSink + FrameSink — output seam for captured frames.
//   - vendor-core-helpers — reimpl of the two @hyperframes/core symbols
//     the vendored engine uses (T-083 B3 resolution).
//
// Real Puppeteer-backed CdpSession, disk / FFmpeg-pipe sinks, HTTP-backed
// asset resolver + Puppeteer-screenshot rasterization for embeds land in
// T-085+ / T-090. Tests inject fake sessions and in-memory resolvers.

export {
  MEDIA_VISUAL_STYLE_PROPERTIES,
  type MediaVisualStyleProperty,
  quantizeTimeToFrame,
} from './vendor-core-helpers';

export {
  type DispatchedClip,
  type DispatchPlan,
  dispatchClips,
  type UnresolvedClip,
  type UnresolvedReason,
} from './dispatch';

export {
  type CdpSession,
  type CompositionConfig,
  DispatchUnresolvedError,
  LiveTierAdapter,
  type MountedComposition,
  type SessionHandle,
} from './adapter';

export { type FrameSink, InMemoryFrameSink } from './frame-sink';

export {
  type AssetKind,
  type AssetRef,
  collectAssetRefs,
  rewriteDocumentAssets,
} from './asset-refs';

export {
  type AssetResolution,
  type AssetResolver,
  InMemoryAssetResolver,
  type LossFlag,
  resolveAssets,
  type ResolvedAssetEntry,
  type ResolveAssetsResult,
} from './asset-resolver';

export {
  preflight,
  type PreflightBlocker,
  type PreflightBlockerKind,
  type PreflightReport,
} from './preflight';

export {
  type ExportOptions,
  type ExportResult,
  exportDocument,
  PreflightBlockedError,
} from './export-dispatcher';

export {
  type ChildRunner,
  type ChildStdin,
  createNodeChildRunner,
  type SpawnedProcess,
} from './child-runner';

export {
  type EncoderProfile,
  type EncoderProfileId,
  ENCODER_PROFILES,
  getEncoderProfile,
  PROFILE_H264,
  PROFILE_H265,
  PROFILE_PRORES_4444,
  PROFILE_VP9,
} from './ffmpeg-profiles';

export {
  buildFfmpegArgs,
  FFmpegEncoder,
  FFmpegEncoderError,
  type FFmpegEncoderOptions,
} from './ffmpeg-encoder';

export {
  doctor,
  type DoctorCodecs,
  type DoctorOptions,
  type DoctorReport,
} from './ffmpeg-doctor';

export {
  buildExtractFramesArgs,
  ExtractVideoFramesError,
  type ExtractVideoFramesOptions,
  type ExtractVideoFramesResult,
  extractVideoFrames,
} from './video-frame-extractor';

export {
  type AudioTrack,
  buildMixAudioArgs,
  MixAudioError,
  type MixAudioOptions,
  type MixAudioResult,
  mixAudio,
} from './audio-mixer';
