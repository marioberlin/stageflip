// packages/parity-cli/src/index.ts
// Public surface of @stageflip/parity-cli. Primary use is the
// `stageflip-parity` binary via the package's `bin` entry; these
// programmatic exports let consumers (CI scripts, the future
// T-103 integration, visual-diff viewer at T-105) reuse the
// scoring + priming pieces without re-shelling.

export {
  outcomeIsFailure,
  scoreFixture,
  type FixtureScoreOutcome,
  type MissingFrame,
  type ScoreFixtureOptions,
} from './score-fixture.js';

export {
  formatOutcome,
  formatSummary,
  parseArgs,
  runCli,
  type CliIo,
  type CliOptions,
} from './cli.js';

// T-119b — golden priming.
export {
  DEFAULT_PRIME_PATTERN,
  primeFixture,
  type PrimeFixtureInput,
  type PrimeFsOps,
  type PrimeOptions,
  type PrimeOutcome,
  type PrimeRenderFn,
} from './prime.js';
export {
  PRIME_HELP_TEXT,
  defaultReferenceFrames,
  parsePrimeArgs,
  runPrime,
  type PrimeCliOptions,
  type PrimeInputResolver,
  type PrimeRunDeps,
  type PrimeRuntimeFs,
  type PrimerFactory,
} from './prime-cli.js';
export {
  createPrimeInputResolver,
  createPuppeteerPrimer,
  type PuppeteerPrimerOptions,
} from './puppeteer-primer.js';
