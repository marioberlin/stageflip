// packages/on-device-player-packaging/src/index.ts
// @stageflip/on-device-player-packaging — binary packaging + distribution
// scaffold for the on-device display player (T-400). Wraps the runtime
// shim (`@stageflip/runtime-on-device-player`, T-399) into a deployable
// binary with its own manifest, update channel, code-signing posture,
// per-OS package descriptors, and health probe. The actual native binary
// compilation is downstream of this workspace.
//
// Per ADR-005 §D4 + L141, the on-device player is a separate binary
// with its own supply chain and update mechanism (security blast-
// radius is higher than browser-only clips). See
// `skills/stageflip/concepts/on-device-player/SKILL.md`.

export {
  ENABLED_CLIP_FAMILIES,
  OnDeviceBinaryManifestParseError,
  onDeviceBinaryManifestSchema,
  readManifest,
  writeManifest,
  type OnDeviceBinaryManifest,
} from './manifest.js';

export {
  resolveUpdate,
  updateChannelDescriptorSchema,
  type ResolveUpdateArgs,
  type UpdateAvailability,
  type UpdateChannelDescriptor,
} from './update-channel.js';

export {
  codeSigningPolicySchema,
  verifyBinarySignature,
  type CodeSigningPolicy,
  type PublisherPublicKey,
  type SignatureVerifyResult,
  type VerifyBinarySignatureArgs,
} from './code-signing.js';

export {
  FIRST_CLASS_TARGETS,
  isFirstClass,
  packageDescriptorSchema,
  packageOsTargetSchema,
  type PackageDescriptor,
  type PackageOsTarget,
} from './package-os.js';

export {
  buildHealthProbe,
  type BuildHealthProbeArgs,
  type HealthProbeReport,
} from './health-probe.js';

export {
  bootOnDevicePlayer,
  type BootOnDevicePlayerArgs,
  type EntrypointBootResult,
} from './entrypoint.js';
