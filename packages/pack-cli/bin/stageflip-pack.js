#!/usr/bin/env node
// packages/pack-cli/bin/stageflip-pack.js
// Shim that delegates to the compiled `runCli`. Kept separate from
// the ESM entry so the shebang survives tsup's dist pipeline.
//
// Wires production dependencies (real fs, console, stdin prompt) at
// the binary entry point. Tests import `runCli` directly and pass
// in-memory shims.

import { runCli, createNodeDependencies } from '../dist/index.js';

const deps = createNodeDependencies();
const exitCode = await runCli(process.argv.slice(2), deps);
process.exit(exitCode);
