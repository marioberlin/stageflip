// packages/parity-cli/src/index.ts
// Public surface of @stageflip/parity-cli. Primary use is the
// `stageflip-parity` binary via the package's `bin` entry; these
// programmatic exports let consumers (CI scripts, the future
// T-103 integration, visual-diff viewer at T-105) reuse the
// scoring + formatting pieces without re-shelling.

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
