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
  {
    name: 'cluster-a-compose',
    description:
      'Cluster A (News & Broadcast) composer tools — preset-binding factories for breaking-news / ongoing-update / guest-intro / documentary-title-card briefs across the 8 ratified Cluster A presets (T-331).',
    tools: [],
  },
  {
    name: 'cluster-b-compose',
    description:
      'Cluster B (Sports) composer tools — preset-binding factories for live-sports score / standings / VAR / player-intro briefs (T-340).',
    tools: [],
  },
  {
    name: 'cluster-c-compose',
    description:
      'Cluster C (Weather) composer tools — preset-binding factories for weather alerts / forecast maps / storm tracks / temperature maps across the 6 ratified Cluster C presets (T-347).',
    tools: [],
  },
  {
    name: 'cluster-e-compose',
    description:
      'Cluster E (Data) composer tools — preset-binding factories for live-data / market-ticker / election-board / big-number / stat-callout briefs across the 6 ratified Cluster E presets (T-361).',
    tools: [],
  },
  {
    name: 'cluster-f-compose',
    description:
      'Cluster F (Captions / Lyrics) composer tools — preset-binding factories for creator-caption / subtitle / lyric-video / keyword-highlight briefs (T-368).',
    tools: [],
  },
  {
    name: 'cluster-g-compose',
    description:
      'Cluster G (CTAs / social) composer tools — preset-binding factories for subscribe / follow / link-sticker / QR-bounce / social-handle briefs across the 5 ratified Cluster G presets (T-374).',
    tools: [],
  },
  {
    name: 'cluster-h-compose',
    description:
      'Cluster H (AR overlays) composer tools — preset-binding factories for AR overlay / VAR skeletal / swim-lane track briefs across the 4 ratified Cluster H presets (T-379).',
    tools: [],
  },
  {
    name: 'asset-generation',
    description:
      'Asset-generation tools — wraps the Phase 14 α Provider Seam (AdapterRegistry / LicenseGate / FallbackChainExecutor + AssetCache + MediaProvenance) so agents can generate audio / image / video assets with provenance + content-addressed cache keys (T-423).',
    tools: [],
  },
  {
    name: 'audience-engagement',
    description:
      '11 compose_audience_* tools for authoring Live Audience clips per ADR-009 / ADR-010 — one composer per AudienceClipKind discriminant (live-poll-multiple-choice / live-poll-open-text / live-poll-rating / live-qa / live-quiz / leaderboard / word-cloud / survey / heatmap / reaction-stream / audience-ai-prompt). Each tool emits a (presetId?, clipKind, props) triple; the caller mounts via add_clip from create-mutate. Cluster I (T-486) ratifies presets later — until then presetId is undefined and the runtime dispatches by clipKind (T-457).',
    tools: [],
  },
  {
    name: 'cluster-i-compose',
    description:
      '3 read-only composer tools that bind a semantic Cluster I (Live audience) brief to a ratified preset id + audience clipKind + opaque props payload. compose_live_poll → slido-classic-poll | mentimeter-bar-vote; compose_audience_qa → bbc-question-time | conference-qa-upvote; compose_quiz_round → kahoot-competitive | classroom-quiz. Cluster I = 6 audience presets ratified in T-486 (T-487).',
    tools: [],
  },
];

export const CANONICAL_BUNDLE_NAMES: readonly string[] = CANONICAL_BUNDLES.map((b) => b.name);
