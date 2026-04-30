// packages/engine/src/bundles/catalog.ts
// Canonical bundle catalog — 14 entries per
// skills/stageflip/concepts/tool-bundles §"Catalog". Tool arrays are empty
// placeholders today; T-155–T-168 populate them via `mergeBundleTools`
// or by supplying a replacement `ToolBundle` to `BundleRegistry.register`.

import type { ToolBundle } from './types.js';

export const CANONICAL_BUNDLES: readonly ToolBundle[] = [
  {
    name: 'read',
    description:
      'Read-only inspection of the current document — get_document, get_slide, list_elements, describe_selection, get_theme.',
    tools: [],
  },
  {
    name: 'create-mutate',
    description: 'Add, update, duplicate, reorder, and delete slides + elements.',
    tools: [],
  },
  {
    name: 'timing',
    description: 'Adjust per-slide duration, sequence, and timeline timing hints.',
    tools: [],
  },
  {
    name: 'layout',
    description: 'Apply alignment, distribution, grids, and constraint-based layout.',
    tools: [],
  },
  {
    name: 'validate',
    description: 'Run the pre-render linter, schema validation, and fixable-rule checks.',
    tools: [],
  },
  {
    name: 'clip-animation',
    description: 'Pick and configure clips + animations across all registered runtimes.',
    tools: [],
  },
  {
    name: 'element-cm1',
    description: 'Element-level content-mutation tools (text, shape, image, table cells).',
    tools: [],
  },
  {
    name: 'slide-cm1',
    description: 'Slide-level content-mutation + accessibility (alt text, reading order).',
    tools: [],
  },
  {
    name: 'table-cm1',
    description: 'Table-specific content-mutation tools — rows, columns, cell merges.',
    tools: [],
  },
  {
    name: 'qc-export-bulk',
    description: 'Batch quality checks, bulk operations, and export-trigger tools.',
    tools: [],
  },
  {
    name: 'fact-check',
    description: 'Fact-verification tools using web search + citation.',
    tools: [],
  },
  {
    name: 'domain-finance-sales-okr',
    description: 'Domain composites for finance / sales / OKR clip authoring and KPI binding.',
    tools: [],
  },
  {
    name: 'data-source-bindings',
    description: 'Bind document values to external data sources (CSV, Sheets, GraphQL).',
    tools: [],
  },
  {
    name: 'semantic-layout',
    description: 'Semantic-role layout helpers — title blocks, KPI strips, two-column flows.',
    tools: [],
  },
  {
    name: 'video-mode',
    description:
      'StageFlip.Video profile tools — multi-aspect export planning, per-aspect layout helpers (T-185 and onward).',
    tools: [],
  },
  {
    name: 'display-mode',
    description:
      'StageFlip.Display profile tools — file-size optimization planning, multi-size preview resolution (T-206 and onward).',
    tools: [],
  },
  {
    name: 'arrange-variants',
    description:
      'Variant generation — turn one canonical Document into a message × locale matrix of variants (T-386).',
    tools: [],
  },
];

export const CANONICAL_BUNDLE_NAMES: readonly string[] = CANONICAL_BUNDLES.map((b) => b.name);
