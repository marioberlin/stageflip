// packages/pack-cli/src/index.ts
// T-497 — Public surface of `@stageflip/pack-cli`. Primary use is the
// `stageflip-pack` binary via the package's `bin` entry; the
// programmatic exports let downstream wiring (auto-install jobs,
// integration tests) drive the CLI in-process with custom deps.

export {
  type CliDependencies,
  type CliFs,
  type CliLogger,
  type CliPrompter,
  createNodeDependencies,
  defaultRootPath,
} from './deps.js';

export { HELP_BANNER, runCli } from './cli.js';

export { formatRow, runList } from './commands/list.js';
export { formatDetail, runInfo } from './commands/info.js';
export { runVerify } from './commands/verify.js';
export { runInstall } from './commands/install.js';
export { runRemove } from './commands/remove.js';

export { type PackRef, parsePackRef } from './pack-ref.js';
