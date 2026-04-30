// scripts/gen-tool-skills.ts
// Auto-generate `skills/stageflip/tools/<bundle>/SKILL.md` per-bundle skill
// files from the engine's registry (T-169). The generator is the single
// source of truth for per-tool documentation: it iterates every canonical
// bundle, pulls tool names + descriptions + input-schema summaries straight
// from `LLMToolDefinition`, and renders a consistent Markdown body.
//
// Two modes:
//   `pnpm gen:tool-skills`        — overwrite skill files on disk.
//   `pnpm gen:tool-skills:check`  — diff generated output against the
//                                   committed skill files. Exits non-zero
//                                   on drift. CI invokes this.
//
// The generator deliberately does NOT re-export static one-liners like
// invariants / scope-boundary text — those live in the tool descriptions
// (the agent's actual source of truth) and in `concepts/tool-bundles`.

import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CANONICAL_BUNDLES,
  createCanonicalRegistry,
  registerArrangeVariantsBundle,
  registerReadBundle,
  registerCreateMutateBundle,
  registerTimingBundle,
  registerLayoutBundle,
  registerValidateBundle,
  registerClipAnimationBundle,
  registerElementCm1Bundle,
  registerSlideCm1Bundle,
  registerTableCm1Bundle,
  registerQcExportBulkBundle,
  registerFactCheckBundle,
  registerDomainBundle,
  registerDataSourceBindingsBundle,
  registerSemanticLayoutBundle,
  ToolRouter,
} from '../packages/engine/src/index.js';
import type { ExecutorContext } from '../packages/agent/src/index.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKILLS_DIR = path.join(ROOT, 'skills/stageflip/tools');
const TODAY = '2026-04-24';
const OWNER_TASK_MAP: Record<string, string> = {
  read: 'T-155',
  'create-mutate': 'T-156',
  timing: 'T-157',
  layout: 'T-158',
  validate: 'T-159',
  'clip-animation': 'T-160',
  'element-cm1': 'T-161',
  'slide-cm1': 'T-162',
  'table-cm1': 'T-163',
  'qc-export-bulk': 'T-164',
  'fact-check': 'T-165',
  'domain-finance-sales-okr': 'T-166',
  'data-source-bindings': 'T-167',
  'semantic-layout': 'T-168',
  'video-mode': 'T-185',
  'display-mode': 'T-206',
  'arrange-variants': 'T-386',
};

function populateRegistry() {
  const registry = createCanonicalRegistry();
  // Register everything against a shared router typed against
  // ExecutorContext — the widest shared context. Agent's context is
  // narrower than the router's but the generator only cares about
  // registry metadata.
  const router = new ToolRouter<ExecutorContext>();
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
  registerArrangeVariantsBundle(registry, router);
  return registry;
}

function renderTool(def: {
  name: string;
  description: string;
  input_schema: unknown;
}): string {
  const schema = def.input_schema as {
    required?: string[];
    properties?: Record<string, { description?: string; enum?: unknown[]; type?: string | string[] }>;
  };
  const required = new Set(schema?.required ?? []);
  const rows: string[] = [];
  const props = schema?.properties ?? {};
  for (const [name, meta] of Object.entries(props)) {
    const typeLabel = Array.isArray(meta.type)
      ? meta.type.join(' | ')
      : meta.type ?? 'object';
    const tag = required.has(name) ? '' : ' _(optional)_';
    const enumNote = meta.enum ? ` — enum: \`${meta.enum.map(String).join('` / `')}\`` : '';
    const desc = meta.description ? ` — ${meta.description.replace(/\n/g, ' ')}` : '';
    rows.push(`- \`${name}\` (\`${typeLabel}\`)${tag}${enumNote}${desc}`);
  }
  const signature = rows.length > 0 ? `\n\n${rows.join('\n')}\n` : '\n';
  return `### \`${def.name}\`\n\n${def.description}${signature}`;
}

function renderBundle(bundleName: string, bundle: { description: string; tools: ReadonlyArray<{ name: string; description: string; input_schema: unknown }> }): string {
  const owner = OWNER_TASK_MAP[bundleName] ?? 'unknown';
  const toolSections = bundle.tools.map(renderTool).join('\n');
  const titlePrefix = 'Tools — ';
  const titleSuffix = bundleNameToTitle(bundleName);
  const title = `${titlePrefix}${titleSuffix}`;

  return `---
title: ${title}
id: skills/stageflip/tools/${bundleName}
tier: tools
status: substantive
last_updated: ${TODAY}
owner_task: ${owner}
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# ${title}

${bundle.description}

> **This file is generated from the engine's registered tool
> definitions** (\`pnpm gen:tool-skills\`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's \`ToolHandler\` + matching
> \`LLMToolDefinition\` in \`packages/engine/src/handlers/${bundleName}/\`.

Registration: see \`@stageflip/engine\`'s \`register${bundleNameToCamel(bundleName)}Bundle\` (or equivalent) export.

## Tools

${toolSections}

## Invariants

- Every handler declares \`bundle: '${bundleName}'\`.
- Tool count ${bundle.tools.length} (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's \`LLMToolDefinition[]\`.

## Related

- \`concepts/tool-bundles/SKILL.md\` — bundle catalog + loading policy.
- \`concepts/tool-router/SKILL.md\` — Zod-validated dispatch.
- Task: ${owner}
`;
}

function bundleNameToTitle(name: string): string {
  const titled = name
    .split('-')
    .map((s) => {
      if (s === 'cm1') return 'CM1';
      if (s === 'okr') return 'OKR';
      if (s === 'qc') return 'QC';
      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join(' ');
  return `${titled} Bundle`;
}

function bundleNameToCamel(name: string): string {
  // read -> Read; create-mutate -> CreateMutate; clip-animation -> ClipAnimation
  return name
    .split('-')
    .map((s) => {
      if (s === 'cm1') return 'Cm1';
      if (s === 'okr') return 'Okr';
      if (s === 'qc') return 'Qc';
      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join('');
}

async function run(check: boolean): Promise<void> {
  const registry = populateRegistry();
  const expected = new Map<string, string>();
  for (const { name } of CANONICAL_BUNDLES) {
    const bundle = registry.get(name);
    if (!bundle) {
      throw new Error(`generator: bundle '${name}' not found in registry`);
    }
    expected.set(name, renderBundle(name, bundle));
  }

  if (check) {
    const mismatches: string[] = [];
    for (const [name, body] of expected.entries()) {
      const filePath = path.join(SKILLS_DIR, name, 'SKILL.md');
      let current = '';
      try {
        current = await fs.readFile(filePath, 'utf8');
      } catch {
        mismatches.push(`${name}: file missing`);
        continue;
      }
      if (current !== body) {
        mismatches.push(`${name}: out of sync with registry`);
      }
    }
    if (mismatches.length > 0) {
      process.stdout.write('gen-tool-skills [check]: FAIL\n');
      for (const m of mismatches) process.stdout.write(`  - ${m}\n`);
      process.stdout.write('Run `pnpm gen:tool-skills` to regenerate.\n');
      process.exit(1);
    }
    process.stdout.write(`gen-tool-skills [check]: PASS (${expected.size} bundles)\n`);
    return;
  }

  let written = 0;
  for (const [name, body] of expected.entries()) {
    const dir = path.join(SKILLS_DIR, name);
    const filePath = path.join(dir, 'SKILL.md');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, body, 'utf8');
    written += 1;
  }
  process.stdout.write(`gen-tool-skills: wrote ${written} SKILL.md files\n`);
}

const mode = process.argv.includes('--check') ? 'check' : 'write';
run(mode === 'check').catch((err) => {
  process.stderr.write(`${String(err instanceof Error ? err.stack ?? err.message : err)}\n`);
  process.exit(1);
});
