#!/usr/bin/env node
// packages/parity-cli/bin/parity.js
// Shim that delegates to the compiled `runCli`. Kept separate from
// the ESM entry so the shebang survives tsup's dist pipeline.
//
// Wires the real Puppeteer-backed primer for the `prime` subcommand.
// Score-mode invocations ignore primeDeps; the real primer stays lazy
// (createPrimer is only called when runPrime actually needs it), so
// `stageflip-parity a.json` still never launches Chrome.

import { createPrimeInputResolver, createPuppeteerPrimer, runCli } from '../dist/index.js';

const primeDeps = {
  resolver: createPrimeInputResolver(),
  createPrimer: () => createPuppeteerPrimer(),
};

const exitCode = await runCli(process.argv.slice(2), undefined, primeDeps);
process.exit(exitCode);
