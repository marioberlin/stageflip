// packages/skills-sync/src/tools-index-gen.ts
// Generator for skills/stageflip/tools/SKILL.md — the top-level
// tools index (T-220). Complements `scripts/gen-tool-skills.ts`
// (T-169), which emits the per-bundle SKILL.md files. This index
// is the one-screen overview: every bundle, tool count, pointer
// to the per-bundle skill.
//
// Consumers pass a `ToolsIndexPkg` — a list of `BundleSummary`-
// shaped rows in catalog order — rather than the engine registry
// itself. `scripts/sync-skills.ts` builds the summary list from
// `registry.list()` after the canonical bundles are populated.

/** One row of the tools index. Maps directly to `BundleSummary`. */
export interface ToolsIndexBundle {
  readonly name: string;
  readonly description: string;
  readonly toolCount: number;
}

export interface ToolsIndexPkg {
  readonly bundles: readonly ToolsIndexBundle[];
}

const LAST_UPDATED = '2026-04-24';

/** Render the tools-index SKILL.md. */
export function generateToolsIndexSkill(pkg: ToolsIndexPkg): string {
  const bundles = pkg.bundles;
  const bundleCount = bundles.length;
  const toolCount = bundles.reduce((n, b) => n + b.toolCount, 0);

  const frontmatter = [
    '---',
    'title: Tools — Index',
    'id: skills/stageflip/tools',
    'tier: tools',
    'status: auto-generated',
    `last_updated: ${LAST_UPDATED}`,
    'owner_task: T-220',
    'related:',
    '  - skills/stageflip/concepts/tool-bundles',
    '  - skills/stageflip/concepts/tool-router',
    '---',
    '',
  ].join('\n');

  const intro = [
    '# Tools — Index',
    '',
    "**Auto-generated from `@stageflip/engine`'s bundle registry.** Do",
    'NOT edit by hand — run `pnpm skills-sync` after registering a',
    'new bundle; `pnpm skills-sync:check` fails in CI if this file',
    'drifts.',
    '',
    `${bundleCount} bundles, ${toolCount} tools total.`,
    '',
    'StageFlip ships tools grouped into bundles so an agent context',
    'rarely needs more than 30 tool definitions loaded at once',
    '(invariant I-9). The Planner picks bundles by name — see',
    '`concepts/tool-bundles/SKILL.md` for the loading policy and',
    '`concepts/tool-router/SKILL.md` for dispatch semantics.',
    '',
  ].join('\n');

  const table = renderTable(bundles);

  const perBundle = [
    '## Per-bundle reference',
    '',
    'Each bundle ships a SKILL.md listing every tool it registers,',
    'its input schema, and invariants. Those are auto-generated too,',
    'but by a separate script (`pnpm gen:tool-skills`, T-169) so the',
    'index + per-bundle surfaces stay independent.',
    '',
  ].join('\n');

  return [frontmatter, intro, '## Bundles', '', table, perBundle].join('\n');
}

function renderTable(bundles: readonly ToolsIndexBundle[]): string {
  if (bundles.length === 0) {
    return '_No bundles registered._\n';
  }
  const out: string[] = [];
  out.push('| Bundle | Tools | Description |');
  out.push('|---|---|---|');
  for (const b of bundles) {
    const link = `[\`${b.name}\`](./${b.name}/SKILL.md)`;
    const desc = b.description.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    out.push(`| ${link} | ${b.toolCount} | ${desc} |`);
  }
  out.push('');
  return out.join('\n');
}
