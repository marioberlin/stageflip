// packages/engine/src/handlers/cluster-g-compose/handlers.ts
// `cluster-g-compose` bundle — 4 read-only composer tools that bind a
// semantic Cluster G (CTAs / social) brief to a ratified preset id +
// opaque props payload. Tools: compose_cta / compose_subscribe_prompt /
// compose_social_handle / compose_qr_bounce. Output is
// `(presetId, clipKind, props)` — the caller mounts the clip via a
// separate write-tier tool (e.g., `add_clip` from `create-mutate`).
//
// Per T-374 / D-T374-2: handlers declare `ToolContext` (NOT
// `MutationContext`); they neither read nor mutate the document and
// dispatch is a pure function of input. The determinism gate at
// `CLAUDE.md` §3 covers `packages/runtimes/**` /
// `packages/frame-runtime/**` / `packages/renderer-core/src/clips/**`
// only — composer paths are out of its globs. The handlers are still
// pure (no `Date.now()`, no `Math.random()`, no I/O) by code-review
// discipline.
//
// Cluster G is 5/5 substantive + signed + RATIFIED (T-371 closer
// 2026-05-07); this bundle is the first downstream consumer surface and
// the fifth + final cluster-compose bundle, closing Phase 13's
// cluster-compose-tools sweep after T-340 (cluster-b-compose) /
// T-368 (cluster-f-compose) / T-331 (cluster-a-compose) /
// T-361 (cluster-e-compose). Mixed-clipKind dispatch: 5 clipKinds across
// 5 presets — `subscribeButton` / `followPrompt` / `linkSticker` /
// `qrBounce` / `lowerThird`. Zero `not_yet_implemented` reserved
// surfaces — every Cluster G preset is reachable from at least one
// `(tool, input gate)` pair.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { ToolContext, ToolHandler } from '../../router/types.js';

export const CLUSTER_G_COMPOSE_BUNDLE_NAME = 'cluster-g-compose';

// ---------------------------------------------------------------------------
// Cluster G preset enum + intent / platform vocabularies
// ---------------------------------------------------------------------------

/** The 5 ratified Cluster G preset ids (T-369..T-373). */
export const CLUSTER_G_PRESET_IDS = [
  'youtube-subscribe-bounce',
  'tiktok-follow-pulse',
  'instagram-link-sticker',
  'coinbase-dvd-qr',
  'social-handle-lower-third',
] as const;
export type ClusterGPresetId = (typeof CLUSTER_G_PRESET_IDS)[number];

/** Sealed CTA intent vocabulary covering all Cluster G dispatch routes. */
export const CTA_INTENTS = ['subscribe', 'follow', 'link', 'qr', 'social-handle'] as const;
export type CtaIntent = (typeof CTA_INTENTS)[number];

/** Sealed platform vocabulary covering the 4 Cluster G platform-keyed presets. */
export const CTA_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'coinbase'] as const;
export type CtaPlatform = (typeof CTA_PLATFORMS)[number];

/** Sealed clipKind enum across all 5 Cluster G presets. */
const COMPOSE_CLIP_KINDS = [
  'subscribeButton',
  'followPrompt',
  'linkSticker',
  'qrBounce',
  'lowerThird',
] as const;
type ComposeClipKind = (typeof COMPOSE_CLIP_KINDS)[number];

/** Per-preset clipKind binding (canonical from each preset's frontmatter). */
const PRESET_CLIP_KIND: Record<ClusterGPresetId, ComposeClipKind> = {
  'youtube-subscribe-bounce': 'subscribeButton',
  'tiktok-follow-pulse': 'followPrompt',
  'instagram-link-sticker': 'linkSticker',
  'coinbase-dvd-qr': 'qrBounce',
  'social-handle-lower-third': 'lowerThird',
};

/**
 * Per-preset prop defaults forwarded into the `props` payload when the
 * caller omits the relevant fields. Sourced from each preset's snapshot
 * canon; documented inline so the dispatch is auditable next to its
 * defaults table.
 */
const PRESET_DEFAULTS: Partial<Record<ClusterGPresetId, Record<string, unknown>>> = {
  // Coinbase canon: zero-branding curiosity gap (D-T374-10 / cluster SKILL line 46).
  'coinbase-dvd-qr': { theme: 'unbranded' },
  // Social-handle lower-third defaults per cluster SKILL line 49 ("4–8 seconds, repeated").
  'social-handle-lower-third': { repetition: 1, duration: 6 },
};

// ---------------------------------------------------------------------------
// Shared atom schemas
// ---------------------------------------------------------------------------

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const brandSchema = z
  .object({
    primary: hexColor,
    accent: hexColor.optional(),
    font: z.string().min(1).max(80).optional(),
  })
  .strict();

/** Brand schema without `font` — used by tools that don't accept a font override. */
const brandColorOnlySchema = z
  .object({
    primary: hexColor,
    accent: hexColor.optional(),
  })
  .strict();

const handleAtomSchema = z
  .object({
    platform: z.enum(['youtube', 'tiktok', 'instagram', 'twitter', 'linkedin', 'github']),
    handle: z.string().min(1).max(40),
  })
  .strict();

// ---------------------------------------------------------------------------
// 1 — compose_cta (umbrella; sealed `intent` discriminator)
// ---------------------------------------------------------------------------

const composeCtaInput = z
  .object({
    intent: z.enum(CTA_INTENTS),
    platform: z.enum(CTA_PLATFORMS).optional(),
    channelName: z.string().min(1).max(80).optional(),
    subscriberCount: z.string().min(1).max(20).optional(),
    handles: z.array(handleAtomSchema).min(1).max(6).optional(),
    url: z.string().url().optional(),
    qrMatrix: z.string().min(1).optional(),
    brand: brandSchema.optional(),
    theme: z.enum(['platform-native', 'branded', 'unbranded']).optional(),
    repetition: z.number().int().min(1).max(8).optional(),
  })
  .strict();

const composeCtaOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_G_PRESET_IDS),
      clipKind: z.enum(COMPOSE_CLIP_KINDS),
      props: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'platform_required',
        'invalid_platform_for_intent',
        'url_required',
        'qr_matrix_required',
        'handles_required',
        'no_preset_for_platform',
      ]),
      detail: z.string().optional(),
      candidatePresets: z.array(z.enum(CLUSTER_G_PRESET_IDS)).optional(),
    })
    .strict(),
]);

type ComposeCtaInput = z.infer<typeof composeCtaInput>;
type ComposeCtaOutput = z.infer<typeof composeCtaOutput>;

/**
 * `(intent, platform-or-'any')` → preset-id dispatch table for
 * `compose_cta`. Spans all 5 ratified Cluster G presets; D-T374-7.
 * `Readonly<Record<...>>` so TypeScript surfaces typos at compile time.
 */
const CTA_DISPATCH: Readonly<
  Partial<Record<`${CtaIntent}:${CtaPlatform | 'any'}`, ClusterGPresetId>>
> = {
  // Subscribe / follow — YouTube + TikTok only (subscribe-button mimicry presets)
  'subscribe:youtube': 'youtube-subscribe-bounce',
  'follow:youtube': 'youtube-subscribe-bounce',
  'subscribe:tiktok': 'tiktok-follow-pulse',
  'follow:tiktok': 'tiktok-follow-pulse',
  // Instagram link sticker (semantically distinct from subscribe — outbound URL register)
  'link:instagram': 'instagram-link-sticker',
  // QR bounce — Coinbase-register only (platform optional)
  'qr:coinbase': 'coinbase-dvd-qr',
  'qr:any': 'coinbase-dvd-qr',
  // Social-handle lower-third — platform-agnostic (handles array carries identity)
  'social-handle:any': 'social-handle-lower-third',
};

/**
 * `compose_cta` — umbrella composer that resolves a CTA brief by `intent` +
 * optional `platform` discriminator into a ratified Cluster G preset id +
 * clipKind + opaque props payload. See dispatch table for the full set of
 * supported `(intent, platform)` tuples.
 */
const composeCta: ToolHandler<ComposeCtaInput, ComposeCtaOutput, ToolContext> = {
  name: 'compose_cta',
  bundle: CLUSTER_G_COMPOSE_BUNDLE_NAME,
  description:
    "Pick a Cluster G (CTAs / social) preset by `intent` + optional `platform` and emit a ratified preset id + clipKind + opaque props payload. Sealed intent enum: `subscribe` / `follow` (require `platform: 'youtube' | 'tiktok'`; route to youtube-subscribe-bounce / tiktok-follow-pulse — Instagram is intentionally not in this branch, use `intent: 'link'` for Instagram link-sticker register), `link` (requires `platform: 'instagram'` + `url`; routes to instagram-link-sticker), `qr` (requires `qrMatrix`; routes to coinbase-dvd-qr; default theme 'unbranded' per Coinbase canon), `social-handle` (requires `handles[]`; routes to social-handle-lower-third). Read-only: caller mounts the clip via a separate write-tier tool.",
  inputSchema: composeCtaInput as unknown as z.ZodType<ComposeCtaInput>,
  outputSchema: composeCtaOutput,
  handle: (input, _ctx) => {
    // Per-intent payload validation (Zod accepts all optional fields at the
    // root; intent-specific required fields are enforced in handler body).
    if (input.intent === 'subscribe' || input.intent === 'follow') {
      if (!input.platform) {
        return {
          ok: false,
          reason: 'platform_required',
          detail: `intent='${input.intent}' requires platform: 'youtube' | 'tiktok'`,
        };
      }
      const key = `${input.intent}:${input.platform}` as const;
      const presetId = CTA_DISPATCH[key];
      if (!presetId) {
        return {
          ok: false,
          reason: 'invalid_platform_for_intent',
          detail:
            input.platform === 'instagram'
              ? 'Instagram has no subscribe-button mimicry preset; use compose_cta with intent: "link" for the link-sticker register'
              : `intent='${input.intent}' has no Cluster G preset for platform='${input.platform}'`,
        };
      }
      return buildOkOutput(presetId, {
        platform: input.platform,
        ...(input.channelName !== undefined ? { channelName: input.channelName } : {}),
        ...(input.subscriberCount !== undefined ? { subscriberCount: input.subscriberCount } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
      });
    }

    if (input.intent === 'link') {
      if (!input.url) {
        return {
          ok: false,
          reason: 'url_required',
          detail: "intent='link' requires url",
        };
      }
      const platform = input.platform ?? 'instagram';
      const key = `link:${platform}` as const;
      const presetId = CTA_DISPATCH[key];
      if (!presetId) {
        return {
          ok: false,
          reason: 'invalid_platform_for_intent',
          detail: `intent='link' has no Cluster G preset for platform='${platform}'`,
        };
      }
      return buildOkOutput(presetId, {
        platform,
        url: input.url,
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
      });
    }

    if (input.intent === 'qr') {
      if (!input.qrMatrix) {
        return {
          ok: false,
          reason: 'qr_matrix_required',
          detail: "intent='qr' requires qrMatrix (opaque base64 / asset id)",
        };
      }
      const presetId = CTA_DISPATCH['qr:any'] as ClusterGPresetId;
      return buildOkOutput(presetId, {
        qrMatrix: input.qrMatrix,
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
      });
    }

    // intent === 'social-handle'
    if (!input.handles || input.handles.length === 0) {
      return {
        ok: false,
        reason: 'handles_required',
        detail: "intent='social-handle' requires handles[] (length 1–6)",
      };
    }
    const presetId = CTA_DISPATCH['social-handle:any'] as ClusterGPresetId;
    return buildOkOutput(presetId, {
      handles: input.handles,
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.repetition !== undefined ? { repetition: input.repetition } : {}),
    });
  },
};

/**
 * Helper: build the `ok: true` envelope by deep-merging `PRESET_DEFAULTS`
 * (preset canon) with the caller-supplied payload. Caller payload always
 * wins over defaults.
 */
function buildOkOutput(
  presetId: ClusterGPresetId,
  payload: Record<string, unknown>,
): ComposeCtaOutput {
  const defaults = PRESET_DEFAULTS[presetId] ?? {};
  return {
    ok: true,
    presetId,
    clipKind: PRESET_CLIP_KIND[presetId],
    props: { ...defaults, ...payload },
  };
}

// ---------------------------------------------------------------------------
// 2 — compose_subscribe_prompt
// ---------------------------------------------------------------------------

const composeSubscribePromptInput = z
  .object({
    platform: z.enum(['youtube', 'tiktok']),
    channelName: z.string().min(1).max(80),
    subscriberCount: z.string().min(1).max(20).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    brand: brandColorOnlySchema.optional(),
  })
  .strict();

const composeSubscribePromptOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.enum(CLUSTER_G_PRESET_IDS),
      clipKind: z.enum(COMPOSE_CLIP_KINDS),
      props: z.record(z.unknown()),
      rationale: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['no_preset_for_platform']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeSubscribePromptInput = z.infer<typeof composeSubscribePromptInput>;
type ComposeSubscribePromptOutput = z.infer<typeof composeSubscribePromptOutput>;

const SUBSCRIBE_DISPATCH: Record<'youtube' | 'tiktok', ClusterGPresetId> = {
  youtube: 'youtube-subscribe-bounce',
  tiktok: 'tiktok-follow-pulse',
};

/**
 * `compose_subscribe_prompt` — narrow composer for the subscribe-button
 * mimicry register: YouTube + TikTok only. Instagram intentionally
 * excluded (Zod parse rejects); use `compose_cta(intent: 'link')` for
 * Instagram CTAs.
 */
const composeSubscribePrompt: ToolHandler<
  ComposeSubscribePromptInput,
  ComposeSubscribePromptOutput,
  ToolContext
> = {
  name: 'compose_subscribe_prompt',
  bundle: CLUSTER_G_COMPOSE_BUNDLE_NAME,
  description:
    "Pick a Cluster G subscribe-button mimicry preset by `platform`. `youtube` → youtube-subscribe-bounce (subscribeButton; cursor-click animation, YouTube red), `tiktok` → tiktok-follow-pulse (followPrompt; pink-red pulse, right-thumb zone). Sealed 2-value enum; Instagram is intentionally excluded — for Instagram CTAs use compose_cta with intent: 'link' (link-sticker register).",
  inputSchema: composeSubscribePromptInput as unknown as z.ZodType<ComposeSubscribePromptInput>,
  outputSchema: composeSubscribePromptOutput,
  handle: (input, _ctx) => {
    const presetId = SUBSCRIBE_DISPATCH[input.platform];
    const defaults = PRESET_DEFAULTS[presetId] ?? {};
    const payload: Record<string, unknown> = {
      platform: input.platform,
      channelName: input.channelName,
      ...(input.subscriberCount !== undefined ? { subscriberCount: input.subscriberCount } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
    };
    return {
      ok: true,
      presetId,
      clipKind: PRESET_CLIP_KIND[presetId],
      props: { ...defaults, ...payload },
      rationale: `platform=${input.platform} + channel=${input.channelName} → ${presetId}`,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — compose_social_handle
// ---------------------------------------------------------------------------

const composeSocialHandleInput = z
  .object({
    handles: z.array(handleAtomSchema).min(1).max(6),
    brand: brandSchema.optional(),
    repetition: z.number().int().min(1).max(8).optional(),
    duration: z.number().int().min(1).max(15).optional(),
  })
  .strict();

const composeSocialHandleOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal('social-handle-lower-third'),
      clipKind: z.literal('lowerThird'),
      props: z.record(z.unknown()),
      rationale: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['handles_required']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeSocialHandleInput = z.infer<typeof composeSocialHandleInput>;
type ComposeSocialHandleOutput = z.infer<typeof composeSocialHandleOutput>;

/**
 * `compose_social_handle` — single-target composer for the cross-platform
 * handle passport (`social-handle-lower-third`). Always returns ok: true
 * for Zod-validated input; the `handles` array (1–6 entries) carries
 * per-platform identity.
 */
const composeSocialHandle: ToolHandler<
  ComposeSocialHandleInput,
  ComposeSocialHandleOutput,
  ToolContext
> = {
  name: 'compose_social_handle',
  bundle: CLUSTER_G_COMPOSE_BUNDLE_NAME,
  description:
    'Emit the Cluster G social-handle lower-third preset (social-handle-lower-third; lowerThird) for a cross-platform handle passport. Accepts 1–6 platform-keyed handle entries; defaults `repetition: 1` and `duration: 6` per cluster canon (4–8s repeated, not single long hold). The preset prepends platform-icon + `@` to each handle; pass the bare handle string without leading `@`.',
  inputSchema: composeSocialHandleInput as unknown as z.ZodType<ComposeSocialHandleInput>,
  outputSchema: composeSocialHandleOutput,
  handle: (input, _ctx) => {
    const presetId = 'social-handle-lower-third' as const;
    const defaults = PRESET_DEFAULTS[presetId] ?? {};
    const payload: Record<string, unknown> = {
      handles: input.handles,
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.repetition !== undefined ? { repetition: input.repetition } : {}),
      ...(input.duration !== undefined ? { duration: input.duration } : {}),
    };
    return {
      ok: true,
      presetId,
      clipKind: 'lowerThird',
      props: { ...defaults, ...payload },
      rationale: `handles=${input.handles.length}x platforms → ${presetId} (lowerThird; cross-platform passport)`,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — compose_qr_bounce
// ---------------------------------------------------------------------------

const composeQrBounceInput = z
  .object({
    qrMatrix: z.string().min(1),
    url: z.string().url().optional(),
    brand: brandColorOnlySchema.optional(),
    theme: z.enum(['unbranded', 'branded']).optional(),
    bounceSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
  })
  .strict();

const composeQrBounceOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      presetId: z.literal('coinbase-dvd-qr'),
      clipKind: z.literal('qrBounce'),
      props: z.record(z.unknown()),
      rationale: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['qr_matrix_required']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ComposeQrBounceInput = z.infer<typeof composeQrBounceInput>;
type ComposeQrBounceOutput = z.infer<typeof composeQrBounceOutput>;

/**
 * `compose_qr_bounce` — single-target composer for the Coinbase-register
 * bouncing QR (`coinbase-dvd-qr`; qrBounce). Accepts an opaque
 * pre-computed `qrMatrix` (the encoder runs upstream of the executor
 * loop). Default theme is `'unbranded'` per Coinbase canon (zero-context
 * curiosity gap; cluster SKILL line 46).
 */
const composeQrBounce: ToolHandler<ComposeQrBounceInput, ComposeQrBounceOutput, ToolContext> = {
  name: 'compose_qr_bounce',
  bundle: CLUSTER_G_COMPOSE_BUNDLE_NAME,
  description:
    "Emit the Cluster G coinbase-dvd-qr preset (qrBounce) for a bouncing QR-code overlay. Accepts an opaque pre-computed `qrMatrix` (base64 PNG asset id or 2D bit array — the QR encoder runs upstream of this composer); optional `url` (informational pass-through), `brand` overrides, `theme` ('unbranded' default per Coinbase canon — the zero-context curiosity gap that drove 20M scans in 60 seconds; 'branded' for in-house registers), and `bounceSpeed`. Single Cluster G consumer of the `qrBounce` clipKind.",
  inputSchema: composeQrBounceInput as unknown as z.ZodType<ComposeQrBounceInput>,
  outputSchema: composeQrBounceOutput,
  handle: (input, _ctx) => {
    const presetId = 'coinbase-dvd-qr' as const;
    const defaults = PRESET_DEFAULTS[presetId] ?? {};
    const payload: Record<string, unknown> = {
      qrMatrix: input.qrMatrix,
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.bounceSpeed !== undefined ? { bounceSpeed: input.bounceSpeed } : {}),
    };
    const merged = { ...defaults, ...payload };
    const themeLabel = (merged.theme as string | undefined) ?? 'unbranded';
    return {
      ok: true,
      presetId,
      clipKind: 'qrBounce',
      props: merged,
      rationale: `qr-matrix → ${presetId} (qrBounce; ${themeLabel} register)`,
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const CLUSTER_G_COMPOSE_HANDLERS: readonly ToolHandler<unknown, unknown, ToolContext>[] = [
  composeCta,
  composeSubscribePrompt,
  composeSocialHandle,
  composeQrBounce,
] as unknown as readonly ToolHandler<unknown, unknown, ToolContext>[];

const brandObject = {
  type: 'object' as const,
  description:
    'Brand atom: `{ primary (#RRGGBB), accent (#RRGGBB)?, font? }`. All hex colors validated server-side against `^#[0-9a-fA-F]{6}$`.',
};
const brandColorOnlyObject = {
  type: 'object' as const,
  description: 'Brand atom (color-only): `{ primary (#RRGGBB), accent (#RRGGBB)? }`.',
};
const handleAtomObject = {
  type: 'object' as const,
  description:
    'Handle atom: `{ platform (youtube|tiktok|instagram|twitter|linkedin|github), handle (1–40 chars; no leading `@`) }`.',
};

export const CLUSTER_G_COMPOSE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'compose_cta',
    description: composeCta.description,
    input_schema: {
      type: 'object',
      required: ['intent'],
      additionalProperties: false,
      properties: {
        intent: { type: 'string', enum: [...CTA_INTENTS] },
        platform: { type: 'string', enum: [...CTA_PLATFORMS] },
        channelName: { type: 'string', minLength: 1, maxLength: 80 },
        subscriberCount: { type: 'string', minLength: 1, maxLength: 20 },
        handles: {
          type: 'array',
          items: handleAtomObject,
          minItems: 1,
          maxItems: 6,
        },
        url: { type: 'string', format: 'uri' },
        qrMatrix: { type: 'string', minLength: 1 },
        brand: brandObject,
        theme: {
          type: 'string',
          enum: ['platform-native', 'branded', 'unbranded'],
        },
        repetition: { type: 'integer', minimum: 1, maximum: 8 },
      },
    },
  },
  {
    name: 'compose_subscribe_prompt',
    description: composeSubscribePrompt.description,
    input_schema: {
      type: 'object',
      required: ['platform', 'channelName'],
      additionalProperties: false,
      properties: {
        platform: { type: 'string', enum: ['youtube', 'tiktok'] },
        channelName: { type: 'string', minLength: 1, maxLength: 80 },
        subscriberCount: { type: 'string', minLength: 1, maxLength: 20 },
        theme: { type: 'string', enum: ['light', 'dark'] },
        brand: brandColorOnlyObject,
      },
    },
  },
  {
    name: 'compose_social_handle',
    description: composeSocialHandle.description,
    input_schema: {
      type: 'object',
      required: ['handles'],
      additionalProperties: false,
      properties: {
        handles: {
          type: 'array',
          items: handleAtomObject,
          minItems: 1,
          maxItems: 6,
        },
        brand: brandObject,
        repetition: { type: 'integer', minimum: 1, maximum: 8 },
        duration: { type: 'integer', minimum: 1, maximum: 15 },
      },
    },
  },
  {
    name: 'compose_qr_bounce',
    description: composeQrBounce.description,
    input_schema: {
      type: 'object',
      required: ['qrMatrix'],
      additionalProperties: false,
      properties: {
        qrMatrix: { type: 'string', minLength: 1 },
        url: { type: 'string', format: 'uri' },
        brand: brandColorOnlyObject,
        theme: { type: 'string', enum: ['unbranded', 'branded'] },
        bounceSpeed: { type: 'string', enum: ['slow', 'normal', 'fast'] },
      },
    },
  },
];
