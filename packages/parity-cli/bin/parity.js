#!/usr/bin/env node
// packages/parity-cli/bin/parity.js
// Shim that delegates to the compiled `runCli`. Kept separate from
// the ESM entry so the shebang survives tsup's dist pipeline.

import { runCli } from '../dist/index.js';

const exitCode = await runCli(process.argv.slice(2));
process.exit(exitCode);
