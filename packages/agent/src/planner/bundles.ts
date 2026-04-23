// packages/agent/src/planner/bundles.ts
// Stub bundle registry seeded from skills/stageflip/concepts/tool-bundles
// §"Catalog". Replaced by a real registry in T-151a; the Planner only
// reads `listBundles()` output so it is insulated from the change.

import type { BundleSummary } from './types.js';

const BUNDLES: readonly BundleSummary[] = [
  {
    name: 'read',
    description:
      'Read-only inspection of the current document — get_document, get_slide, list_elements, describe_selection, get_theme.',
    toolCount: 5,
  },
  {
    name: 'create-mutate',
    description: 'Add, update, duplicate, reorder, and delete slides + elements.',
    toolCount: 8,
  },
  {
    name: 'timing',
    description: 'Adjust per-slide duration, sequence, and timeline timing hints.',
    toolCount: 4,
  },
  {
    name: 'layout',
    description: 'Apply alignment, distribution, grids, and constraint-based layout.',
    toolCount: 5,
  },
  {
    name: 'validate',
    description: 'Run the pre-render linter, schema validation, and fixable-rule checks.',
    toolCount: 4,
  },
  {
    name: 'clip-animation',
    description: 'Pick and configure clips + animations across all registered runtimes.',
    toolCount: 14,
  },
  {
    name: 'element-cm1',
    description: 'Element-level content-mutation tools (text, shape, image, table cells).',
    toolCount: 12,
  },
  {
    name: 'slide-cm1',
    description: 'Slide-level content-mutation + accessibility (alt text, reading order).',
    toolCount: 6,
  },
  {
    name: 'table-cm1',
    description: 'Table-specific content-mutation tools — rows, columns, cell merges.',
    toolCount: 6,
  },
  {
    name: 'qc-export-bulk',
    description: 'Batch quality checks, bulk operations, and export-trigger tools.',
    toolCount: 9,
  },
  {
    name: 'fact-check',
    description: 'Fact-verification tools using web search + citation.',
    toolCount: 2,
  },
  {
    name: 'domain-finance-sales-okr',
    description: 'Domain composites for finance / sales / OKR clip authoring and KPI binding.',
    toolCount: 27,
  },
  {
    name: 'data-source-bindings',
    description: 'Bind document values to external data sources (CSV, Sheets, GraphQL).',
    toolCount: 2,
  },
  {
    name: 'semantic-layout',
    description: 'Semantic-role layout helpers — title blocks, KPI strips, two-column flows.',
    toolCount: 4,
  },
];

/**
 * Mirror of the `list_bundles` meta-tool. Returns immutable metadata only —
 * no tool-definition array is materialised here (that is the Executor's
 * concern via `load_bundle` in T-151a).
 */
export function listBundles(): BundleSummary[] {
  return BUNDLES.map((b) => ({ ...b }));
}

export const BUNDLE_NAMES: readonly string[] = BUNDLES.map((b) => b.name);
