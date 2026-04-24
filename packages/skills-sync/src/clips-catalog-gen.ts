// packages/skills-sync/src/clips-catalog-gen.ts
// Generator for skills/stageflip/clips/catalog/SKILL.md (T-220).
// Walks every registered `ClipRuntime`'s clip map and emits a
// deterministic markdown catalogue grouped by runtime.
//
// Consumers pass a `ClipsCatalogPkg` — a structural digest of the
// live runtime registry (runtime id + tier + clip kinds) — rather
// than the registry itself, so tests stay hermetic and the
// generator has no import dependency on `@stageflip/runtimes-contract`.
// `scripts/sync-skills.ts` builds the digest from
// `LIVE_RUNTIME_MANIFEST`; the manifest is drift-gated by a test
// in `@stageflip/cdp-host-bundle`.

export interface ClipsCatalogRuntime {
  readonly id: string;
  readonly tier: 'live' | 'bake';
  /** Clip kinds this runtime registers. Unordered — the generator sorts. */
  readonly clips: readonly string[];
}

export interface ClipsCatalogPkg {
  readonly runtimes: readonly ClipsCatalogRuntime[];
}

export interface ClipsCatalogGroup {
  readonly runtimeId: string;
  readonly tier: 'live' | 'bake';
  readonly clips: readonly string[];
}

/**
 * Group clips by runtime for rendering. Clips are sorted alphabetically
 * within each group so the output stays stable even if the underlying
 * registry reorders (e.g. because a new clip was appended).
 */
export function buildClipsCatalogGroups(pkg: ClipsCatalogPkg): readonly ClipsCatalogGroup[] {
  return pkg.runtimes.map((r) => ({
    runtimeId: r.id,
    tier: r.tier,
    clips: [...r.clips].sort((a, b) => a.localeCompare(b)),
  }));
}

const LAST_UPDATED = '2026-04-24';

/** Render the full auto-generated SKILL.md for the clips catalogue. */
export function generateClipsCatalogSkill(pkg: ClipsCatalogPkg): string {
  const groups = buildClipsCatalogGroups(pkg);
  const totalClips = groups.reduce((n, g) => n + g.clips.length, 0);
  const runtimeCount = groups.length;

  const frontmatter = [
    '---',
    'title: Clips — Catalog',
    'id: skills/stageflip/clips/catalog',
    'tier: clip',
    'status: auto-generated',
    `last_updated: ${LAST_UPDATED}`,
    'owner_task: T-220',
    'related:',
    '  - skills/stageflip/clips/authoring',
    '  - skills/stageflip/runtimes/contract',
    '---',
    '',
  ].join('\n');

  const intro = [
    '# Clips — Catalog',
    '',
    '**Auto-generated from the live `ClipRuntime` registry.** Do NOT',
    'edit by hand — run `pnpm skills-sync` after adding or removing a',
    'clip; `pnpm skills-sync:check` fails in CI if the committed file',
    'drifts.',
    '',
    `Currently ${totalClips} clips across ${runtimeCount} runtimes.`,
    '',
    'The table below lists every clip `kind` the dispatcher can resolve',
    'via `findClip(kind)`. Per-clip detail (props schema, theme slots,',
    'authoring notes) lives in `clips/authoring/SKILL.md` and — where',
    'present — per-clip source headers.',
    '',
  ].join('\n');

  const catalogue = renderCatalogue(groups);

  const related = [
    '## Related',
    '',
    '- `clips/authoring/SKILL.md` — authoring guide for new clip kinds.',
    '- `runtimes/contract/SKILL.md` — the `ClipRuntime` + `ClipDefinition` contract.',
    '- `concepts/tool-bundles/SKILL.md` — how the `clip-animation` bundle discovers clips.',
    '',
  ].join('\n');

  return [frontmatter, intro, '## Catalogue', '', catalogue, related].join('\n');
}

function renderCatalogue(groups: readonly ClipsCatalogGroup[]): string {
  const out: string[] = [];
  for (const g of groups) {
    out.push(`### ${g.runtimeId} (${g.tier})`);
    out.push('');
    if (g.clips.length === 0) {
      out.push('_No clips registered in this runtime._');
      out.push('');
      continue;
    }
    for (const kind of g.clips) {
      out.push(`- \`${kind}\``);
    }
    out.push('');
  }
  return out.join('\n');
}
