// packages/pack-format/src/index.ts
// Public surface of `@stageflip/pack-format` (T-494). Ships the Zod
// schemas + types for the `.stageflip-pack` manifest per ADR-012 §D2,
// the Ed25519 sign/verify utilities per §D3, and the 5 LF-* loss
// flag codes per §D10.

export {
  type LicenseClaim,
  OPEN_LICENSE_SPDX,
  type OpenLicenseSpdx,
  type PackContributions,
  type PackManifest,
  PackManifestParseError,
  licenseClaimSchema,
  packContributionsSchema,
  packManifestSchema,
  parsePackManifest,
} from './manifest.js';

export {
  ED25519_SIGNATURE_LENGTH,
  signPackArchive,
  verifyPackArchive,
} from './signature.js';

export {
  PACK_FORMAT_LF_CODES,
  PACK_FORMAT_LF_SPECS,
  type PackFormatLossFlagCode,
  type PackFormatLossFlagSpec,
} from './loss-flags.js';

export {
  COMPATIBILITY_MATRIX,
  type CompatibilityRow,
  isCompatible,
  matchingRows,
  readableManifestVersions,
} from './compatibility.js';

export { satisfiesRange } from './semver-range.js';
