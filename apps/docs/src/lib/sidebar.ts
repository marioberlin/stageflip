// apps/docs/src/lib/sidebar.ts
// T-228 — build the Starlight sidebar config from the
// skills/stageflip/** tree. Pure TS; `astro.config.mjs` imports
// this + calls it with the list of skills the prebuild script
// emitted.

export interface SkillEntry {
  /** Canonical id (e.g. `skills/stageflip/concepts/rir`). */
  readonly id: string;
  /** Display title from frontmatter. */
  readonly title: string;
  readonly tier: string;
}

export interface SidebarItem {
  readonly label: string;
  /** Starlight slug — relative to `src/content/docs/` without extension. */
  readonly slug: string;
}

export interface SidebarGroup {
  readonly label: string;
  readonly items: SidebarItem[];
}

/**
 * Ordered map tier → group label. The order here is the sidebar
 * order: concepts first (the user's mental-model-entry), then
 * runtimes + modes + profiles (what exists), then tools + workflows
 * (how to do things), then reference + clips (lookup).
 */
const TIER_LABELS: ReadonlyArray<{ tier: string; label: string }> = [
  { tier: 'concept', label: 'Concepts' },
  { tier: 'runtime', label: 'Runtimes' },
  { tier: 'mode', label: 'Modes' },
  { tier: 'profile', label: 'Profiles' },
  { tier: 'tools', label: 'Tools' },
  { tier: 'workflow', label: 'Workflows' },
  { tier: 'reference', label: 'Reference' },
  { tier: 'clip', label: 'Clips' },
];

const KNOWN_TIERS = new Set(TIER_LABELS.map((t) => t.tier));

/** Build a sorted, grouped sidebar from a flat list of skill entries. */
export function buildSkillsSidebar(skills: readonly SkillEntry[]): SidebarGroup[] {
  for (const s of skills) {
    if (!KNOWN_TIERS.has(s.tier)) {
      throw new Error(`sidebar: unknown tier "${s.tier}" on skill ${s.id}`);
    }
  }

  const groups: SidebarGroup[] = [];
  for (const { tier, label } of TIER_LABELS) {
    const inTier = skills.filter((s) => s.tier === tier);
    if (inTier.length === 0) continue;
    const items: SidebarItem[] = inTier
      .map((s) => ({
        label: s.title,
        slug: s.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    groups.push({ label, items });
  }
  return groups;
}
