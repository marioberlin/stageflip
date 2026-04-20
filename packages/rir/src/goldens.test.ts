// packages/rir/src/goldens.test.ts
// T-032: RIR compiler golden fixtures. Each input in fixtures/inputs/ has a
// paired expected output in fixtures/goldens/. compileRIR is run and the
// output is compared byte-for-byte.
//
// Regenerating goldens when the compiler changes:
//   RIR_GOLDEN_UPDATE=1 pnpm --filter=@stageflip/rir test
// Review the resulting diff, commit both input and golden.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compileRIR } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = join(__dirname, '..', 'fixtures');
const INPUTS_DIR = join(FIXTURE_DIR, 'inputs');
const GOLDENS_DIR = join(FIXTURE_DIR, 'goldens');

const UPDATE = process.env.RIR_GOLDEN_UPDATE === '1';

/**
 * Deterministic JSON stringify: sorts object keys so reordered fields don't
 * produce spurious diffs. Arrays preserve order (meaningful in the schema).
 */
function stableStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) throw new Error('stableStringify: circular structure');
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v as object).sort()) {
      out[key] = walk((v as Record<string, unknown>)[key]);
    }
    return out;
  };
  return `${JSON.stringify(walk(value), null, indent)}\n`;
}

const inputFiles = readdirSync(INPUTS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

describe('RIR golden fixtures (T-032)', () => {
  if (inputFiles.length === 0) {
    it('has at least one input fixture', () => {
      expect(inputFiles.length).toBeGreaterThan(0);
    });
    return;
  }

  for (const input of inputFiles) {
    it(`${input} → golden`, () => {
      const doc = JSON.parse(readFileSync(join(INPUTS_DIR, input), 'utf8')) as unknown;
      const { rir, diagnostics } = compileRIR(doc, { compilerVersion: 'golden-v1' });

      // Include diagnostics in the golden so warnings are observable (and
      // changing them requires an intentional regeneration).
      const produced = stableStringify({ rir, diagnostics });
      const goldenPath = join(GOLDENS_DIR, input);

      if (UPDATE) {
        writeFileSync(goldenPath, produced);
        return;
      }

      let expected: string;
      try {
        expected = readFileSync(goldenPath, 'utf8');
      } catch {
        throw new Error(
          `No golden at ${goldenPath}. Run \`RIR_GOLDEN_UPDATE=1 pnpm --filter=@stageflip/rir test\` to generate it.`,
        );
      }
      expect(produced).toBe(expected);
    });
  }
});
