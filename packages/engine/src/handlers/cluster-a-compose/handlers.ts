// packages/engine/src/handlers/cluster-a-compose/handlers.ts
// `cluster-a-compose` bundle — 4 read-only composer tools that resolve a
// Cluster A (News & Broadcast) brief plus a brand register hint into a
// preset-id pick across the 8 ratified Cluster A presets. Tools:
// compose_breaking_news / compose_ongoing_update / compose_guest_intro /
// compose_documentary_title_card. Output is `(presetId, clipKind,
// rationale)` — the caller mounts the clip via a separate write-tier
// tool (e.g., `apply_preset` / `add_clip`).
//
// Per T-331 / D-T331-3: handlers declare `ToolContext` (mirrors
// cluster-b-compose / cluster-f-compose siblings); they neither read nor
// mutate the document and dispatch is a pure function of input.
// The determinism gate at `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Cluster A is 8/8 substantive + signed (T-323..T-330 ratified
// 2026-05-06); this bundle is the third cluster-compose surface after
// T-340 (cluster-b-compose) and T-368 (cluster-f-compose).
// Network → register coupling is canonical per
// `skills/stageflip/presets/news/SKILL.md` §"Cluster conventions": red =
// urgent (block-wipe register), flipper > scroll for ongoing coverage,
// streaming presets (Netflix / Apple TV+) are documentary-register only.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_A_COMPOSE_BUNDLE_NAME = 'cluster-a-compose';

// ---------------------------------------------------------------------------
// Cluster A preset enum + brand vocabularies
// ---------------------------------------------------------------------------

/** The 8 ratified Cluster A preset ids (T-323..T-330). */
export const CLUSTER_A_PRESET_IDS = [
  'cnn-classic',
  'cnn-breaking',
  'bbc-reith-dark',
  'al-jazeera-orange',
  'fox-news-alert',
  'msnbc-big-board',
  'netflix-doc-lt',
  'apple-tv-lt',
] as const;
export type ClusterAPresetId = (typeof CLUSTER_A_PRESET_IDS)[number];

/** Per-preset clipKind binding (canonical from each preset's frontmatter). */
const PRESET_CLIP_KIND: Record<ClusterAPresetId, 'lowerThird' | 'breakingBanner' | 'fullScreen'> = {
  'cnn-classic': 'lowerThird',
  'cnn-breaking': 'breakingBanner',
  'bbc-reith-dark': 'lowerThird',
  'al-jazeera-orange': 'lowerThird',
  'fox-news-alert': 'breakingBanner',
  'msnbc-big-board': 'fullScreen',
  'netflix-doc-lt': 'lowerThird',
  'apple-tv-lt': 'lowerThird',
};

const COMPOSE_CLIP_KINDS = ['lowerThird', 'breakingBanner', 'fullScreen'] as const;

/** Sealed reasons enum for `ok: false` responses across all 4 tools. */
const COMPOSE_FAILURE_REASONS = [
  'unsupported_network',
  'unsupported_severity',
  'register_unavailable',
] as const;

// ---------------------------------------------------------------------------
// Shared output schema — all 4 tools emit the same envelope
// ---------------------------------------------------------------------------

const composeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_A_PRESET_IDS),
      clipKind: z.enum(COMPOSE_CLIP_KINDS),
      rationale: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(COMPOSE_FAILURE_REASONS),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeOutput = z.infer<typeof composeOutput>;

// ---------------------------------------------------------------------------
// 1 — compose_breaking_news
// ---------------------------------------------------------------------------

const BREAKING_NETWORKS = ['cnn', 'fox', 'msnbc', 'bbc', 'ajazeera', 'aplus'] as const;
type BreakingNetwork = (typeof BREAKING_NETWORKS)[number];

const BREAKING_SEVERITIES = ['urgent', 'developing', 'standard'] as const;

const composeBreakingNewsInput = z
  .object({
    headline: z.string().min(1).max(200),
    severity: z.enum(BREAKING_SEVERITIES),
    network: z.enum(BREAKING_NETWORKS),
    timestamp: z.string().optional(),
  })
  .strict();

type ComposeBreakingNewsInput = z.infer<typeof composeBreakingNewsInput>;

/** Severity=urgent × network → preset-id dispatch table. */
const BREAKING_DISPATCH: Record<BreakingNetwork, ClusterAPresetId> = {
  cnn: 'cnn-breaking',
  fox: 'fox-news-alert',
  msnbc: 'msnbc-big-board',
  bbc: 'bbc-reith-dark',
  ajazeera: 'al-jazeera-orange',
  aplus: 'apple-tv-lt',
};

const composeBreakingNews: ToolHandler<ComposeBreakingNewsInput, ComposeOutput, ToolContext> = {
  name: 'compose_breaking_news',
  bundle: CLUSTER_A_COMPOSE_BUNDLE_NAME,
  description:
    "Pick a Cluster A (News) breaking-register preset by `severity` + `network` and emit a ratified preset id + clipKind + rationale. `severity='urgent'` × six accepted networks dispatches to the urgent register: `cnn` → cnn-breaking (breakingBanner), `fox` → fox-news-alert (breakingBanner), `msnbc` → msnbc-big-board (fullScreen), `bbc` → bbc-reith-dark (lowerThird), `ajazeera` → al-jazeera-orange (lowerThird), `aplus` → apple-tv-lt (lowerThird). `severity='developing'` / `'standard'` are rejected (`ok: false`, `reason: 'unsupported_severity'`) — Cluster A canon forbids painting non-urgent material in breaking register; route those to `compose_ongoing_update` instead. Read-only: caller mounts the clip via a separate write-tier tool.",
  inputSchema: composeBreakingNewsInput as unknown as z.ZodType<ComposeBreakingNewsInput>,
  outputSchema: composeOutput,
  handle: (input, _ctx) => {
    if (input.severity !== 'urgent') {
      return {
        ok: false,
        reason: 'unsupported_severity',
        detail: 'use compose_ongoing_update for developing/non-urgent register',
      };
    }
    const presetId = BREAKING_DISPATCH[input.network];
    return {
      ok: true,
      presetId,
      clipKind: PRESET_CLIP_KIND[presetId],
      rationale: `severity=urgent + network=${input.network} → ${presetId}`,
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — compose_ongoing_update
// ---------------------------------------------------------------------------

const ONGOING_NETWORKS = ['cnn', 'bbc', 'ajazeera'] as const;
type OngoingNetwork = (typeof ONGOING_NETWORKS)[number];

const composeOngoingUpdateInput = z
  .object({
    network: z.enum(ONGOING_NETWORKS),
    mainline: z.string().min(1).max(160),
    kicker: z.string().min(1).max(40).optional(),
    talent: z.string().min(1).max(40).optional(),
    timestamp: z.string().optional(),
  })
  .strict();

type ComposeOngoingUpdateInput = z.infer<typeof composeOngoingUpdateInput>;

/** Network → preset-id dispatch (lowerThird, non-urgent register). */
const ONGOING_DISPATCH: Record<OngoingNetwork, ClusterAPresetId> = {
  cnn: 'cnn-classic',
  bbc: 'bbc-reith-dark',
  ajazeera: 'al-jazeera-orange',
};

const composeOngoingUpdate: ToolHandler<ComposeOngoingUpdateInput, ComposeOutput, ToolContext> = {
  name: 'compose_ongoing_update',
  bundle: CLUSTER_A_COMPOSE_BUNDLE_NAME,
  description:
    'Pick a Cluster A (News) lowerThird preset for ongoing / non-urgent coverage by `network`. `cnn` → cnn-classic (white card + red flag, flipper register), `bbc` → bbc-reith-dark (dark Reith register), `ajazeera` → al-jazeera-orange (warm orange-on-light register). Networks without an ongoing register (`fox` / `msnbc` / `aplus`) are not in the input enum — Zod parse rejects them, forcing the caller to pick a different register tool. Cluster A canon: ticker format = flipper > scroll (BBC 2019 rebrand); the lowerThird presets in this dispatch are flipper-style or static, never wipe-register.',
  inputSchema: composeOngoingUpdateInput as unknown as z.ZodType<ComposeOngoingUpdateInput>,
  outputSchema: composeOutput,
  handle: (input, _ctx) => {
    const presetId = ONGOING_DISPATCH[input.network];
    return {
      ok: true,
      presetId,
      clipKind: PRESET_CLIP_KIND[presetId],
      rationale: `network=${input.network} → ${presetId} (lowerThird; non-urgent register)`,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_guest_intro
// ---------------------------------------------------------------------------

const GUEST_NETWORKS = ['cnn', 'fox', 'msnbc', 'bbc', 'ajazeera', 'aplus', 'netflix'] as const;
type GuestNetwork = (typeof GUEST_NETWORKS)[number];

const GUEST_THEMES = ['broadcast', 'streaming'] as const;

const composeGuestIntroInput = z
  .object({
    person: z.string().min(1).max(80),
    role: z.string().min(1).max(120),
    network: z.enum(GUEST_NETWORKS),
    theme: z.enum(GUEST_THEMES),
  })
  .strict();

type ComposeGuestIntroInput = z.infer<typeof composeGuestIntroInput>;

/** Broadcast-theme dispatch — fox / msnbc fall back to cnn-classic per the
 * Cluster A SKILL "fall back to documentary register" rule, but for live
 * talent intros the most-neutral broadcast equivalent is cnn-classic. */
const GUEST_BROADCAST_DISPATCH: Partial<Record<GuestNetwork, ClusterAPresetId>> = {
  cnn: 'cnn-classic',
  fox: 'cnn-classic',
  msnbc: 'cnn-classic',
  bbc: 'bbc-reith-dark',
  ajazeera: 'al-jazeera-orange',
};

const GUEST_STREAMING_DISPATCH: Partial<Record<GuestNetwork, ClusterAPresetId>> = {
  netflix: 'netflix-doc-lt',
  aplus: 'apple-tv-lt',
};

const composeGuestIntro: ToolHandler<ComposeGuestIntroInput, ComposeOutput, ToolContext> = {
  name: 'compose_guest_intro',
  bundle: CLUSTER_A_COMPOSE_BUNDLE_NAME,
  description:
    "Pick a Cluster A (News) lowerThird preset for a guest / talent intro by `theme` + `network`. `theme='broadcast'`: cnn / fox / msnbc → cnn-classic (most-neutral broadcast register; fox + msnbc fall back here per Cluster A SKILL fallback rule); bbc → bbc-reith-dark; ajazeera → al-jazeera-orange. `theme='streaming'`: netflix → netflix-doc-lt; aplus → apple-tv-lt. Cross-theme combinations (broadcast network + streaming theme, or streaming network + broadcast theme) return `ok: false, reason: 'register_unavailable'` — register coupling is canonical and the caller must pick a coherent (theme, network) pair.",
  inputSchema: composeGuestIntroInput as unknown as z.ZodType<ComposeGuestIntroInput>,
  outputSchema: composeOutput,
  handle: (input, _ctx) => {
    if (input.theme === 'broadcast') {
      const presetId = GUEST_BROADCAST_DISPATCH[input.network];
      if (!presetId) {
        return {
          ok: false,
          reason: 'register_unavailable',
          detail: `${input.network} has no broadcast register; pick theme=streaming`,
        };
      }
      return {
        ok: true,
        presetId,
        clipKind: PRESET_CLIP_KIND[presetId],
        rationale: `theme=broadcast + network=${input.network} → ${presetId}`,
      };
    }
    // theme === 'streaming'
    const presetId = GUEST_STREAMING_DISPATCH[input.network];
    if (!presetId) {
      return {
        ok: false,
        reason: 'register_unavailable',
        detail: `${input.network} has no streaming register; pick theme=broadcast`,
      };
    }
    return {
      ok: true,
      presetId,
      clipKind: PRESET_CLIP_KIND[presetId],
      rationale: `theme=streaming + network=${input.network} → ${presetId}`,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — compose_documentary_title_card
// ---------------------------------------------------------------------------

const DOC_NETWORKS = ['netflix', 'appletv'] as const;
type DocNetwork = (typeof DOC_NETWORKS)[number];

const composeDocumentaryTitleCardInput = z
  .object({
    title: z.string().min(1).max(120),
    network: z.enum(DOC_NETWORKS),
    subtitle: z.string().min(1).max(200).optional(),
  })
  .strict();

type ComposeDocumentaryTitleCardInput = z.infer<typeof composeDocumentaryTitleCardInput>;

const DOC_DISPATCH: Record<DocNetwork, ClusterAPresetId> = {
  netflix: 'netflix-doc-lt',
  appletv: 'apple-tv-lt',
};

const composeDocumentaryTitleCard: ToolHandler<
  ComposeDocumentaryTitleCardInput,
  ComposeOutput,
  ToolContext
> = {
  name: 'compose_documentary_title_card',
  bundle: CLUSTER_A_COMPOSE_BUNDLE_NAME,
  description:
    "Pick a Cluster A (News) documentary-register lowerThird preset by `network`. `netflix` → netflix-doc-lt (text-only register, no chrome, bottom-left float); `appletv` → apple-tv-lt (thin-weight uppercase, wide tracking). The Zod input enum is sealed at exactly two networks; out-of-range values are rejected by parse. Returns `clipKind: 'lowerThird'` for both branches.",
  inputSchema:
    composeDocumentaryTitleCardInput as unknown as z.ZodType<ComposeDocumentaryTitleCardInput>,
  outputSchema: composeOutput,
  handle: (input, _ctx) => {
    const presetId = DOC_DISPATCH[input.network];
    return {
      ok: true,
      presetId,
      clipKind: PRESET_CLIP_KIND[presetId],
      rationale: `network=${input.network} → ${presetId} (documentary register)`,
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_A_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeBreakingNews,
  composeOngoingUpdate,
  composeGuestIntro,
  composeDocumentaryTitleCard,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

export const CLUSTER_A_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_breaking_news',
    description: composeBreakingNews.description,
    input_schema: {
      type: 'object',
      required: ['headline', 'severity', 'network'],
      additionalProperties: false,
      properties: {
        headline: { type: 'string', minLength: 1, maxLength: 200 },
        severity: { type: 'string', enum: [...BREAKING_SEVERITIES] },
        network: { type: 'string', enum: [...BREAKING_NETWORKS] },
        timestamp: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_ongoing_update',
    description: composeOngoingUpdate.description,
    input_schema: {
      type: 'object',
      required: ['network', 'mainline'],
      additionalProperties: false,
      properties: {
        network: { type: 'string', enum: [...ONGOING_NETWORKS] },
        mainline: { type: 'string', minLength: 1, maxLength: 160 },
        kicker: { type: 'string', minLength: 1, maxLength: 40 },
        talent: { type: 'string', minLength: 1, maxLength: 40 },
        timestamp: { type: 'string' },
      },
    },
  },
  {
    name: 'compose_guest_intro',
    description: composeGuestIntro.description,
    input_schema: {
      type: 'object',
      required: ['person', 'role', 'network', 'theme'],
      additionalProperties: false,
      properties: {
        person: { type: 'string', minLength: 1, maxLength: 80 },
        role: { type: 'string', minLength: 1, maxLength: 120 },
        network: { type: 'string', enum: [...GUEST_NETWORKS] },
        theme: { type: 'string', enum: [...GUEST_THEMES] },
      },
    },
  },
  {
    name: 'compose_documentary_title_card',
    description: composeDocumentaryTitleCard.description,
    input_schema: {
      type: 'object',
      required: ['title', 'network'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 120 },
        network: { type: 'string', enum: [...DOC_NETWORKS] },
        subtitle: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },
];
