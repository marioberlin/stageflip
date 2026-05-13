// packages/pack-signing/src/index.ts
// T-498 — Public surface of `@stageflip/pack-signing`. Primary use is
// the `stageflip-pack-sign` binary via the package's `bin` entry; the
// programmatic exports let CI / a future publish API drive the
// signing pipeline in-process with custom deps.

export {
  type CliSignDependencies,
  type SignFs,
  type SignLogger,
  createNodeDependencies,
} from './deps.js';

export { HELP_BANNER, runSignCli } from './cli.js';

export {
  type ArchiveFile,
  ARCHIVE_MAGIC,
  ArchiveParseError,
  ArchiveSynthesizeError,
  parseArchive,
  synthesizeArchive,
} from './archive.js';

export {
  type GenerateKeyPairOptions,
  type KeyPairPem,
  GenerateKeysRefusalError,
  PRIVATE_KEY_FILENAME,
  PUBLIC_KEY_FILENAME,
  generateKeyPair,
  runGenerateKeysCommand,
} from './commands/generate-keys.js';

export {
  type SignPackOptions,
  type SignedPackResult,
  SignPackError,
  runSignCommand,
  signPackDirectory,
} from './commands/sign.js';

export {
  type VerifyPackOptions,
  type VerifyResult,
  runVerifyCommand,
  verifySignedPack,
} from './commands/verify.js';
