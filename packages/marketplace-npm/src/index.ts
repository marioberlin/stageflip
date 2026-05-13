// packages/marketplace-npm/src/index.ts
// T-539 — Public surface of `@stageflip/marketplace-npm`. Exposes
// the `NpmTokenStore` interface + in-memory / file-backed
// implementations, the `verifyLicenseClaim` license-claim gate, and
// the `createSidecarClient` HTTP client for the marketplace
// entitlement verification sidecar. See ADR-014 §D2 + §D4.

export {
  type NpmTokenStore,
  InMemoryNpmTokenStore,
  assertValidScope,
  assertValidToken,
} from './tokens/token-store.js';

export {
  type FileBackedNpmTokenStoreOptions,
  FileBackedNpmTokenStore,
} from './tokens/file-backed.js';

export {
  type LicenseClaimInput,
  type LicenseVerificationInput,
  type LicenseVerificationResult,
  verifyLicenseClaim,
} from './verifier/license-verifier.js';

export {
  type SidecarClient,
  type SidecarClientDeps,
  type SidecarVerifyInput,
  type SidecarVerifyResult,
  createSidecarClient,
} from './sidecar/sidecar-client.js';
