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
  registerArrangeVariantsBundle,
  registerClipAnimationBundle,
  registerClusterAComposeBundle,
  registerClusterBComposeBundle,
  registerClusterEComposeBundle,
  registerClusterFComposeBundle,
  registerClusterGComposeBundle,
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
import { AdapterRegistry } from '../packages/adapters-core/src/index.js';
import type { AdapterDescriptor } from '../packages/adapters-core/src/index.js';
import { meshyDescriptor } from '../packages/3d-meshy/src/index.js';
import { tripoDescriptor } from '../packages/3d-tripo/src/index.js';
import { aceStepDescriptor } from '../packages/music-acestep/src/index.js';
import { fishSpeechDescriptor } from '../packages/tts-fish-speech/src/index.js';
import { kokoroDescriptor } from '../packages/tts-kokoro/src/index.js';
import { runwayDescriptor } from '../packages/video-runway/src/index.js';
import { seedanceDescriptor } from '../packages/video-seedance/src/index.js';
import {
  LIVE_RUNTIME_MANIFEST,
  type ToolsIndexPkg,
  generateAssetProvidersSkill,
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
  registerArrangeVariantsBundle(registry, router as ToolRouter<never>);
  registerClusterAComposeBundle(registry, router);
  registerClusterBComposeBundle(registry, router);
  registerClusterEComposeBundle(registry, router);
  registerClusterFComposeBundle(registry, router);
  registerClusterGComposeBundle(registry, router);
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

/**
 * Build the asset-provider registry snapshot consumed by the
 * `reference/asset-providers` generator (T-424). The registry is
 * created empty here; reference adapters T-426..T-434 will register
 * themselves at this site as they land. With zero adapters today the
 * generator emits the empty-state SKILL.
 */
function buildAssetProvidersPkg(): { adapters: readonly AdapterDescriptor[] } {
  const registry = new AdapterRegistry();
  // T-426 — first reference adapter (Kokoro TTS, Apache 2.0).
  // T-427 — second reference adapter (Fish Speech TTS, Apache 2.0;
  // first voice-clone adapter — exercises ADR-008 §D4 consent path).
  // T-428 — third reference adapter (Tripo3D characters, proprietary-byo;
  // first 3D adapter; first proprietary-byo posture — exercises tenant-
  // BYO-credentials path per ADR-008 §D13 line 657).
  // T-429 — fourth reference adapter (Meshy props + environment,
  // proprietary-byo; second 3D adapter; triangle-soup topology +
  // supportsAutoRigging: false — exercises the no-rig branch of
  // ADR-008 §D6).
  // T-430 — fifth reference adapter (Seedance 2.0 video via fal.ai,
  // proprietary-byo; first video-gen adapter; 15s 1080p + native
  // audio + lip-sync — exercises the video-gen branch of ADR-008
  // §D6 + the third proprietary-byo posture).
  // T-431 — sixth reference adapter (Runway Gen-4 video, proprietary-byo;
  // second video-gen adapter; production-tier; 10s up-to-4K silent
  // video at cinematic 24fps; broad aspect-ratio set — exercises the
  // fourth proprietary-byo posture + the second video-gen branch with
  // emitsAudio=false / supportsLipSync=false differentiators).
  // T-432 — seventh reference adapter (ACE-Step music, MIT; FIRST
  // music-gen modality adapter; 5-minute track in <10s on RTX 3090;
  // edge-deployable in-process posture mirroring Kokoro; 44100Hz
  // mono PCM stub-WAV; outputLicense: 'permissive' — exercises the
  // music-gen branch of ADR-008 §D6 / §D13 with mit ∈ music-gen
  // whitelist; second MIT-licensed adapter overall but FIRST in
  // the music modality).
  // T-433..T-434 add the remaining two reference adapters here.
  registry.register(kokoroDescriptor);
  registry.register(fishSpeechDescriptor);
  registry.register(tripoDescriptor);
  registry.register(meshyDescriptor);
  registry.register(seedanceDescriptor);
  registry.register(runwayDescriptor);
  registry.register(aceStepDescriptor);
  return { adapters: registry.list() };
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
    {
      name: 'reference/asset-providers',
      target: resolve('skills/stageflip/reference/asset-providers/SKILL.md'),
      generate: () => generateAssetProvidersSkill(buildAssetProvidersPkg()),
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
