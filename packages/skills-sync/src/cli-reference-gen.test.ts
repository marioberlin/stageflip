// packages/skills-sync/src/cli-reference-gen.test.ts
// T-220 — coverage for the cli-reference generator. The generator
// takes a structural `CliReferencePkg`; the real `apps/cli` command
// registry wires to it in T-225/T-226.

import { describe, expect, it } from 'vitest';

import { generateCliReferenceSkill } from './cli-reference-gen.js';
import type { CliReferencePkg } from './cli-reference-gen.js';

function pkg(): CliReferencePkg {
  return {
    binaryName: 'stageflip',
    commands: [
      {
        name: 'render',
        summary: 'Render a StageFlip document to a target format.',
        args: [
          { name: 'document', required: true, description: 'Path to the input .json document.' },
        ],
        flags: [
          {
            name: '--format',
            description: 'Target export format.',
            valueType: 'string',
            default: 'html5-zip',
          },
          { name: '--out', description: 'Output directory.', valueType: 'string' },
        ],
      },
      {
        name: 'doctor',
        summary: 'Verify the local environment.',
        args: [],
        flags: [],
      },
    ],
  };
}

describe('generateCliReferenceSkill', () => {
  it('emits stable frontmatter owned by T-226 with tier=reference', () => {
    const out = generateCliReferenceSkill(pkg());
    expect(out).toContain('id: skills/stageflip/reference/cli');
    // The SKILL file itself is owned by T-226 (wiring task); the
    // generator (T-220) produces content for T-226's consumption.
    expect(out).toContain('owner_task: T-226');
    expect(out).toContain('tier: reference');
    expect(out).toContain('status: auto-generated');
  });

  it('lists every command with its summary', () => {
    const out = generateCliReferenceSkill(pkg());
    expect(out).toContain('### `stageflip render`');
    expect(out).toContain('Render a StageFlip document');
    expect(out).toContain('### `stageflip doctor`');
  });

  it('documents required args and optional flags with defaults', () => {
    const out = generateCliReferenceSkill(pkg());
    expect(out).toContain('`<document>`');
    expect(out).toContain('`--format`');
    expect(out).toMatch(/default:.*html5-zip/);
    expect(out).toContain('`--out`');
  });

  it('reports command count in the intro', () => {
    const out = generateCliReferenceSkill(pkg());
    expect(out).toContain('2 commands');
  });

  it('is idempotent — same input → same output byte-for-byte', () => {
    const p = pkg();
    expect(generateCliReferenceSkill(p)).toBe(generateCliReferenceSkill(p));
  });

  it('handles an empty registry (pre-T-225 stub) without crashing', () => {
    const out = generateCliReferenceSkill({ binaryName: 'stageflip', commands: [] });
    expect(out).toContain('0 commands');
    expect(out).toContain('_No commands registered yet._');
  });
});
