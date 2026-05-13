// packages/pack-publish-cli/src/index.ts
// T-500 — Public surface of `@stageflip/pack-publish-cli`. Primary use
// is the `stageflip-pack-publish` binary via the package's `bin` entry;
// the programmatic exports let CI / a future publish API drive the
// publish pipeline in-process with custom deps.

export {
  type CliPublishDependencies,
  type PublishEnv,
  type PublishFs,
  type PublishHttp,
  type PublishLogger,
  createNodeDependencies,
} from './deps.js';

export { HELP_BANNER, runPublishCli } from './cli.js';

export { type ValidateIssue, type ValidateResult, runValidate } from './commands/validate.js';

export { type SignResult, runSign } from './commands/sign.js';

export { type PublishResult, runPublish } from './commands/publish.js';
