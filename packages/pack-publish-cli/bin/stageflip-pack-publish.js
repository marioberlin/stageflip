#!/usr/bin/env node
// packages/pack-publish-cli/bin/stageflip-pack-publish.js
// Shim that delegates to the compiled `runPublishCli`. Kept separate
// from the ESM entry so the shebang survives tsup's dist pipeline.
//
// Wires production dependencies (real fs, real fetch, process.env,
// console) at the binary entry point. Tests import `runPublishCli`
// directly and pass in-memory shims.

import { runPublishCli, createNodeDependencies } from '../dist/index.js';

const deps = createNodeDependencies();
const exitCode = await runPublishCli(process.argv.slice(2), deps);
process.exit(exitCode);
