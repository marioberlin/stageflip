// scripts/sentry-upload-sourcemaps.ts
// CI build-step helper per D-T264-5: upload sourcemaps for a given release to
// Sentry. Thin shim around `@stageflip/observability`'s `sourcemap-upload`
// module so the implementation lives next to the rest of the package and
// runs under vitest coverage.

import { run } from '../packages/observability/src/sourcemap-upload.js';

const code = run(process.argv.slice(2), { out: process.stdout, err: process.stderr });
process.exit(code);
