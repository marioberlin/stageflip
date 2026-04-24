// packages/skills-sync/src/runtimes-index-gen.ts
// Generator for skills/stageflip/runtimes/SKILL.md — the top-level
// runtimes index (T-220). Complements the per-runtime SKILL.md files
// (css/SKILL.md, gsap/SKILL.md, …). This index is a one-screen
// overview: every registered ClipRuntime, its tier, and its clip count.
//
// Consumers pass a `RuntimesIndexPkg` built from `listRuntimes()` in
// `scripts/sync-skills.ts` after `registerAllLiveRuntimes()` + any
// bake-tier registrations fire.

/** Shape of one runtime row. */
export interface RuntimesIndexRuntime {
  readonly id: string;
  readonly tier: 'live' | 'bake';
  readonly clipCount: number;
}

export interface RuntimesIndexPkg {
  readonly runtimes: readonly RuntimesIndexRuntime[];
}

const LAST_UPDATED = '2026-04-24';

/** Render the runtimes-index SKILL.md. */
export function generateRuntimesIndexSkill(pkg: RuntimesIndexPkg): string {
  const total = pkg.runtimes.length;
  const totalClips = pkg.runtimes.reduce((n, r) => n + r.clipCount, 0);
  const live = pkg.runtimes.filter((r) => r.tier === 'live');
  const bake = pkg.runtimes.filter((r) => r.tier === 'bake');

  const frontmatter = [
    '---',
    'title: Runtimes — Index',
    'id: skills/stageflip/runtimes',
    'tier: runtime',
    'status: auto-generated',
    `last_updated: ${LAST_UPDATED}`,
    'owner_task: T-220',
    'related:',
    '  - skills/stageflip/runtimes/contract',
    '  - skills/stageflip/clips/catalog',
    '---',
    '',
  ].join('\n');

  const intro = [
    '# Runtimes — Index',
    '',
    "**Auto-generated from `@stageflip/runtimes-contract`'s runtime",
    'registry.** Do NOT edit by hand — run `pnpm skills-sync` after',
    'adding or removing a runtime; `pnpm skills-sync:check` fails in',
    'CI if the committed file drifts.',
    '',
    `${total} runtimes (${live.length} live, ${bake.length} bake); ${totalClips} clips in total.`,
    '',
    'A `ClipRuntime` owns a set of clip kinds and renders them. The',
    'dispatcher resolves any clip via `findClip(kind)` — the first',
    'runtime that registered the kind wins. See',
    '`runtimes/contract/SKILL.md` for the interface.',
    '',
  ].join('\n');

  const tiers = [
    '## Tiers',
    '',
    '### Live-tier',
    '',
    renderTable(live),
    '### Bake-tier',
    '',
    renderTable(bake),
  ].join('\n');

  return [frontmatter, intro, tiers].join('\n');
}

function renderTable(runtimes: readonly RuntimesIndexRuntime[]): string {
  if (runtimes.length === 0) {
    return '_No runtimes in this tier._\n\n';
  }
  const out: string[] = [];
  out.push('| Runtime | Tier | Clips |');
  out.push('|---|---|---|');
  for (const r of runtimes) {
    out.push(`| [\`${r.id}\`](./${r.id}/SKILL.md) | ${r.tier} | ${r.clipCount} |`);
  }
  out.push('');
  return out.join('\n');
}
