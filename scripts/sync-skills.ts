// scripts/sync-skills.ts
// Runs every auto-gen skill generator and writes its output to disk.
// CI gate `check-skill-drift` (T-014) re-invokes generators and diffs against
// the committed files; failure means a generator input changed without the
// skill being regenerated.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as schema from '../packages/schema/src/index.js';
import { generateSchemaSkill } from '../packages/skills-sync/src/index.js';

interface SyncJob {
  name: string;
  target: string;
  generate(): string;
}

const JOBS: SyncJob[] = [
  {
    name: 'reference/schema',
    target: resolve('skills/stageflip/reference/schema/SKILL.md'),
    generate: () => generateSchemaSkill(schema),
  },
];

function main(): void {
  const check = process.argv.includes('--check');
  let drift = 0;

  for (const job of JOBS) {
    const produced = job.generate();
    if (check) {
      let existing: string;
      try {
        existing = readFileSync(job.target, 'utf8');
      } catch {
        drift += 1;
        process.stderr.write(`sync-skills [${job.name}]: target missing — ${job.target}\n`);
        continue;
      }
      if (existing !== produced) {
        drift += 1;
        process.stderr.write(
          `sync-skills [${job.name}]: drift detected — regenerate with \`pnpm skills-sync\`\n`,
        );
      } else {
        process.stdout.write(`sync-skills [${job.name}]: in sync\n`);
      }
    } else {
      writeFileSync(job.target, produced);
      process.stdout.write(`sync-skills [${job.name}]: wrote ${job.target}\n`);
    }
  }

  if (check && drift > 0) {
    process.stderr.write(`\nsync-skills: FAIL (${drift} generator(s) out of sync)\n`);
    process.exit(1);
  }
  process.stdout.write(check ? '\nsync-skills: PASS\n' : '\nsync-skills: done\n');
}

main();
