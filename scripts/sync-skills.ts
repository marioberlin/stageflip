// scripts/sync-skills.ts
// Runs every auto-gen skill generator and writes its output to disk.
// CI gate `check-skill-drift` (T-014) re-invokes generators and diffs against
// the committed files; failure means a generator input changed without the
// skill being regenerated.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BundleRegistry,
  CANONICAL_BUNDLES,
  ToolRouter,
  createCanonicalRegistry,
  registerClipAnimationBundle,
  registerCreateMutateBundle,
  registerDataSourceBindingsBundle,
  registerDisplayModeBundle,
  registerDomainBundle,
  registerElementCm1Bundle,
  registerFactCheckBundle,
  registerLayoutBundle,
  registerQcExportBulkBundle,
  registerReadBundle,
  registerSemanticLayoutBundle,
  registerSlideCm1Bundle,
  registerTableCm1Bundle,
  registerTimingBundle,
  registerValidateBundle,
  registerVideoModeBundle,
} from '../packages/engine/src/index.js';
import * as schema from '../packages/schema/src/index.js';
import {
  LIVE_RUNTIME_MANIFEST,
  type ToolsIndexPkg,
  generateClipsCatalogSkill,
  generateCliReferenceSkill,
  generateRuntimesIndexSkill,
  generateSchemaSkill,
  generateToolsIndexSkill,
  generateValidationRulesSkill,
} from '../packages/skills-sync/src/index.js';
import * as validation from '../packages/validation/src/index.js';
import { commandRegistryAsCliReferencePkg } from '../apps/cli/src/index.js';

interface SyncJob {
  name: string;
  target: string;
  generate(): string;
}

/**
 * Fully-populated bundle registry: canonical bundles seeded with their
 * handler tools. Pure node-safe — no browser-only runtime imports.
 */
function buildPopulatedBundleRegistry(): BundleRegistry {
  const registry = createCanonicalRegistry();
  const router = new ToolRouter<unknown>();
  registerReadBundle(registry, router);
  registerCreateMutateBundle(registry, router);
  registerTimingBundle(registry, router);
  registerLayoutBundle(registry, router);
  registerValidateBundle(registry, router);
  registerClipAnimationBundle(registry, router);
  registerElementCm1Bundle(registry, router);
  registerSlideCm1Bundle(registry, router);
  registerTableCm1Bundle(registry, router);
  registerQcExportBulkBundle(registry, router);
  registerFactCheckBundle(registry, router);
  registerDomainBundle(registry, router);
  registerDataSourceBindingsBundle(registry, router);
  registerSemanticLayoutBundle(registry, router);
  registerVideoModeBundle(registry, router);
  registerDisplayModeBundle(registry, router);
  return registry;
}

function toolsIndexPkg(registry: BundleRegistry): ToolsIndexPkg {
  const bundles = CANONICAL_BUNDLES.map(({ name }) => {
    const bundle = registry.get(name);
    if (!bundle) throw new Error(`sync-skills: bundle '${name}' missing from populated registry`);
    return {
      name: bundle.name,
      description: bundle.description,
      toolCount: bundle.tools.length,
    };
  });
  return { bundles };
}

function buildJobs(): SyncJob[] {
  const bundleRegistry = buildPopulatedBundleRegistry();
  const runtimesIndex = {
    runtimes: LIVE_RUNTIME_MANIFEST.runtimes.map((r) => ({
      id: r.id,
      tier: r.tier,
      clipCount: r.clips.length,
    })),
  };

  return [
    {
      name: 'reference/schema',
      target: resolve('skills/stageflip/reference/schema/SKILL.md'),
      generate: () => generateSchemaSkill(schema),
    },
    {
      name: 'reference/validation-rules',
      target: resolve('skills/stageflip/reference/validation-rules/SKILL.md'),
      generate: () => generateValidationRulesSkill(validation),
    },
    {
      name: 'clips/catalog',
      target: resolve('skills/stageflip/clips/catalog/SKILL.md'),
      generate: () => generateClipsCatalogSkill(LIVE_RUNTIME_MANIFEST),
    },
    {
      name: 'tools/index',
      target: resolve('skills/stageflip/tools/SKILL.md'),
      generate: () => generateToolsIndexSkill(toolsIndexPkg(bundleRegistry)),
    },
    {
      name: 'runtimes/index',
      target: resolve('skills/stageflip/runtimes/SKILL.md'),
      generate: () => generateRuntimesIndexSkill(runtimesIndex),
    },
    {
      name: 'reference/cli',
      target: resolve('skills/stageflip/reference/cli/SKILL.md'),
      generate: () => generateCliReferenceSkill(commandRegistryAsCliReferencePkg()),
    },
  ];
}

function main(): void {
  const check = process.argv.includes('--check');
  const jobs = buildJobs();
  let drift = 0;

  for (const job of jobs) {
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
