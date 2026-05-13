#!/usr/bin/env node
// packages/pack-signing/bin/stageflip-pack-sign.js
// Shim that delegates to the compiled `runSignCli`. Kept separate from
// the ESM entry so the shebang survives tsup's dist pipeline.
//
// Wires production dependencies (real fs, console) at the binary entry
// point. Tests import `runSignCli` directly and pass in-memory shims.

import { runSignCli, createNodeDependencies } from '../dist/index.js';

const deps = createNodeDependencies();
const exitCode = await runSignCli(process.argv.slice(2), deps);
process.exit(exitCode);
