// scripts/generate-preset-parity-fixture-prod.ts
// Production-bound entrypoint for the parity-fixture generator (T-359a).
//
// The standalone script `scripts/generate-preset-parity-fixture.ts` keeps
// `productionRenderer` UNbound by default and surfaces a clean
// `RenderUnavailableError` when invoked directly (T-359a AC #9). This
// wrapper:
//
//   1. Builds a real `FixtureRenderer` using the v1 clipKind resolver from
//      `@stageflip/parity-cli` (`bigNumber → animated-value` per
//      D-T359a-4) + a puppeteer-backed `PrimeRenderFn` (the same one the
//      `stageflip-parity prime` subcommand already uses).
//   2. Calls `bindProductionRenderer(...)` to swap that impl into the
//      script's module-scoped slot.
//   3. Defers to the script's existing `runGenerate(...)` orchestrator.
//
// Operators invoke this wrapper instead of the standalone script when they
// want a real golden PNG render. Tests continue to invoke the script
// directly with a stub renderer (no Chrome required).
//
// Imports use relative paths so the file works without scripts/ taking a
// workspace dep on parity-cli — mirrors the pattern used by the other
// gates in this directory.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_CLIP_KIND_RESOLVER,
  GenerateFixtureUnavailableError,
  createGenerateFixtureRenderer,
} from '../packages/parity-cli/src/generate-fixture.js';
import { createPuppeteerPrimer } from '../packages/parity-cli/src/puppeteer-primer.js';
import {
  RenderUnavailableError,
  bindProductionRenderer,
  productionRenderer,
  runGenerate,
} from './generate-preset-parity-fixture.js';

/**
 * Bind the production renderer + run the generator. The puppeteer primer is
 * created lazily (first `render()` call) so `--help` / argv-error paths
 * never launch Chrome. The wrapper-side adapter:
 *
 *   - Translates `GenerateFixtureUnavailableError` (parity-cli marker for
 *     unknown clipKind) into the script's `RenderUnavailableError` so the
 *     CLI's exit-1 message stays consistent with T-313 AC #4 / T-359a AC #9.
 *   - Closes the puppeteer session in a `finally` so the process exits
 *     cleanly even on error.
 */
interface ActivePrimer {
  render: (doc: unknown, frame: number) => Promise<Uint8Array>;
  close: () => Promise<void>;
}

async function main(): Promise<void> {
  // Box the primer reference in an object so TS doesn't constant-narrow the
  // `null` initial value across the closure assignments below.
  const primerBox: { current: ActivePrimer | null } = { current: null };
  const ensurePrimer = async (): Promise<ActivePrimer> => {
    if (primerBox.current === null) {
      // The Awaited<ReturnType<typeof createPuppeteerPrimer>> type doesn't
      // re-narrow cleanly through the parity-cli .d.ts boundary; we cast to
      // ActivePrimer (structurally identical to the puppeteer primer's
      // return shape) so the close() call typechecks here in scripts/.
      primerBox.current = (await createPuppeteerPrimer()) as unknown as ActivePrimer;
    }
    return primerBox.current;
  };

  const innerRenderer = createGenerateFixtureRenderer({
    resolver: DEFAULT_CLIP_KIND_RESOLVER,
    render: async (doc, frame) => {
      const p = await ensurePrimer();
      return p.render(doc as unknown, frame);
    },
  });

  bindProductionRenderer({
    async render(args) {
      try {
        return await innerRenderer.render(args);
      } catch (err) {
        if (err instanceof GenerateFixtureUnavailableError) {
          throw new RenderUnavailableError(err.message);
        }
        throw err;
      }
    },
  });

  let exitCode = 0;
  try {
    const result = await runGenerate(process.argv.slice(2), {
      renderer: productionRenderer,
    });
    for (const line of result.stdout) process.stdout.write(`${line}\n`);
    for (const line of result.stderr) process.stderr.write(`${line}\n`);
    exitCode = result.exitCode;
  } finally {
    const captured = primerBox.current;
    if (captured !== null) {
      try {
        await captured.close();
      } catch {
        // best-effort cleanup; the operator-facing exit code already reflects
        // the underlying generator outcome.
      }
    }
  }
  process.exit(exitCode);
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'generate-preset-parity-fixture-prod.ts')
) {
  main().catch((err) => {
    process.stderr.write(
      `generate-preset-parity-fixture-prod: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  });
}
