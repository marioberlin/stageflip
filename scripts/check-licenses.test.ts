// scripts/check-licenses.test.ts
// AC #16, #17 (T-307): the font-license validation block must (a) PASS at
// HEAD with the real on-disk preset corpus, (b) FAIL with a clear violation
// list when an injected synthetic preset uses an unknown atom.
//
// Tests the registry/parser surface directly rather than spawning the script
// as a subprocess — keeps the test fast and gate-suitable per AC #17.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FONT_LICENSE_ATOMS } from '../packages/schema/src/presets/font-license.js';
import { FontLicenseRegistry } from '../packages/schema/src/presets/font-registry.js';
import { loadAllPresets, resetLoaderCache } from '../packages/schema/src/presets/loader.js';
import { PresetRegistry } from '../packages/schema/src/presets/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/ is at repo root.
const REPO_ROOT = resolve(__dirname, '..');
const PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

describe('check-licenses font-license block (T-307 AC #16, #17)', () => {
  it('every on-disk preset resolves to known atoms (AC #16, #18)', () => {
    resetLoaderCache();
    const presetRegistry = loadAllPresets(PRESETS_ROOT);
    const reg = FontLicenseRegistry.buildFromPresets(presetRegistry);
    const allowed = [...FONT_LICENSE_ATOMS];
    const result = reg.validateAgainstWhitelist(allowed);
    if (!result.valid) {
      // Surface the offending entries to make a regression diagnosable.
      const detail = result.violations
        .map((v) => `${v.family} -> ${v.license.atoms.join(',')}`)
        .join('\n  ');
      throw new Error(`Unexpected unwhitelisted entries:\n  ${detail}`);
    }
    expect(result.valid).toBe(true);
  });

  it('a synthetic preset with an unknown atom surfaces a violation (AC #17)', () => {
    // Build a synthetic preset registry with a poison atom.
    const reg = new PresetRegistry();
    reg.addCluster('news', {
      skill: {
        filePath: 'synthetic://news/SKILL.md',
        frontmatter: {
          title: 'Cluster news',
          id: 'skills/stageflip/presets/news',
          tier: 'cluster',
          status: 'stub',
          last_updated: '2026-04-27',
          owner_task: 'T-307',
          related: [],
        },
        body: '',
      },
      presets: [
        {
          filePath: 'synthetic://news/poison.md',
          frontmatter: {
            id: 'poison',
            cluster: 'news',
            clipKind: 'lowerThird',
            source: 'synthetic',
            status: 'stub',
            preferredFont: { family: 'Acme', license: 'gpl-3.0' }, // unknown atom
            permissions: [],
            signOff: { parityFixture: 'na', typeDesign: 'na' },
          },
          body: { sections: {}, unknown: [] },
        },
      ],
    });
    reg.freeze();

    expect(() => FontLicenseRegistry.buildFromPresets(reg)).toThrow(/unknown.*gpl/i);
  });
});
