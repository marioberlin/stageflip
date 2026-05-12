// packages/runtimes/audience/src/clips/audience-ai-prompt/static-fallback.ts
// T-471 — Static-fallback renderer for the `audience-ai-prompt` clip.
// Three-state dispatcher (per ADR-010 §D8 + the T-471 spec):
//
//   1. **Voting phase** (`winnerPromptId === null`): render the prompt
//      feed as a vertical list of `{ text, upvotes }` rows. No upvote
//      buttons — static-fallback is read-only.
//      → `data-testid="aip-state"` text content "voting".
//
//   2. **Generation phase** (`winnerPromptId !== null` AND
//      `generatedAssetCacheKey === null`): render a "🪄 Generating with
//      AI…" placeholder showing the winning prompt text.
//      → `data-testid="aip-state"` text content "generating".
//
//   3. **Final phase** (both set): render the winner prominently + the
//      generated asset element per `targetModality`:
//        - `video-gen` → `<video data-cache-key=… data-modality=…
//          src=… controls />`
//        - `music-gen` → `<audio data-cache-key=… src=… controls />`
//        - `image-gen` → `<img data-cache-key=… src=… alt=… />`
//        - `tts`       → `<audio data-cache-key=… src=… controls />`
//      Below the asset, render the full prompt feed (read-only). Total
//      label reads `${prompts.length} prompts`.
//      → `data-testid="aip-state"` text content "final".
//
// **Cache-key URL resolution**: emitted directly as the `src` attribute
// (and as a separate `data-cache-key` attribute for test introspection).
// The actual `cache://…` → `http(s)://…` URL resolution is a future
// task; browsers will fail to load the asset, but tests assert on the
// attribute presence + value. This is the structural-extension §13
// "render-e2e" anchor.
//
// Browser-safe — pure JSX (createElement). No Date.now / Math.random —
// pure function of (snapshot, context, props).

import type { AudienceAiPromptAggregation } from '@stageflip/audience-contract';
import type { AudienceAiPromptClipProps, AudienceAiPromptTargetModality } from '@stageflip/schema';
import { type ReactElement, createElement } from 'react';

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. `prompt` propagates to the prompt label.
 */
export interface AudienceAiPromptStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Question text shown at the top of the panel. */
  readonly prompt: string;
  /** Asset modality — drives the rendered asset element in the final phase. */
  readonly targetModality: AudienceAiPromptTargetModality;
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Secondary text colour. */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Accent / winner highlight colour. */
const ACCENT_COLOR = '#7c3aed';

/**
 * Format the total-prompts label. Singular for 1, plural otherwise —
 * matches the precedent established by prior audience clip families.
 */
export function formatTotalPromptsLabel(totalPrompts: number): string {
  return `${totalPrompts} ${totalPrompts === 1 ? 'prompt' : 'prompts'}`;
}

/**
 * Render the generated-asset element for the final phase. Branches on
 * `targetModality` to emit the correct HTML element (`<video>` /
 * `<audio>` / `<img>`). The `cacheKey` is forwarded as both the `src`
 * attribute and a `data-cache-key` attribute for test introspection;
 * URL resolution is a future task — browsers will fail to load the
 * asset until the cache-key URL builder lands.
 */
function renderAsset(
  targetModality: AudienceAiPromptTargetModality,
  cacheKey: string,
  winnerText: string,
): ReactElement {
  const commonAttrs = {
    'data-testid': 'aip-asset',
    'data-cache-key': cacheKey,
    'data-modality': targetModality,
    src: cacheKey,
  } as const;
  switch (targetModality) {
    case 'video-gen':
      return createElement('video', {
        key: 'asset',
        ...commonAttrs,
        controls: true,
        style: { maxWidth: '100%', display: 'block' },
      });
    case 'music-gen':
    case 'tts':
      return createElement('audio', {
        key: 'asset',
        ...commonAttrs,
        controls: true,
        style: { width: '100%', display: 'block' },
      });
    case 'image-gen':
      return createElement('img', {
        key: 'asset',
        ...commonAttrs,
        alt: winnerText,
        style: { maxWidth: '100%', display: 'block' },
      });
    default: {
      // Exhaustiveness — never reached when the schema enum is in sync.
      const _exhaustive: never = targetModality;
      return _exhaustive;
    }
  }
}

/**
 * Render the full prompt feed as a read-only `<ul>`. Each row carries
 * `data-testid="aip-prompt-{index}"` and `data-prompt-id` for test
 * introspection.
 */
function renderPromptFeed(
  prompts: AudienceAiPromptAggregation['prompts'],
  winnerPromptId: string | null,
): ReactElement {
  return createElement(
    'ul',
    {
      key: 'feed',
      'data-role': 'prompt-feed',
      'data-testid': 'aip-prompt-feed',
      style: {
        listStyle: 'none',
        margin: '0',
        padding: '0',
      },
    },
    prompts.map((p, index) =>
      createElement(
        'li',
        {
          key: p.id,
          'data-testid': `aip-prompt-${index}`,
          'data-prompt-id': p.id,
          'data-is-winner': p.id === winnerPromptId,
          style: {
            padding: '6px 8px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            marginBottom: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            color: p.id === winnerPromptId ? ACCENT_COLOR : TEXT_COLOR,
          },
        },
        [
          createElement(
            'span',
            { key: 'text', 'data-role': 'prompt-text', style: { flex: '1 1 auto' } },
            p.text,
          ),
          createElement(
            'span',
            {
              key: 'count',
              'data-role': 'prompt-upvotes',
              style: { color: SECONDARY_TEXT_COLOR, fontSize: '13px' },
            },
            String(p.upvotes),
          ),
        ],
      ),
    ),
  );
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context + clip props. Three-state dispatcher
 * (voting / generating / final) per the T-471 spec.
 *
 * Pure function — given identical inputs, returns structurally-equal
 * trees. Within the determinism perimeter.
 */
export function renderAudienceAiPromptStaticFallback(input: {
  readonly snapshot: AudienceAiPromptAggregation;
  readonly context: AudienceAiPromptStaticFallbackContext;
  readonly props: Pick<AudienceAiPromptClipProps, 'targetModality'>;
}): ReactElement {
  const { snapshot, context } = input;
  const { width, height, prompt, targetModality } = context;

  // Resolve phase up-front so DOM assertions can switch on a single
  // marker attribute (`data-state` on the root + `data-testid="aip-state"`).
  let phase: 'voting' | 'generating' | 'final';
  if (snapshot.winnerPromptId === null) {
    phase = 'voting';
  } else if (snapshot.generatedAssetCacheKey === null) {
    phase = 'generating';
  } else {
    phase = 'final';
  }

  const winner =
    snapshot.winnerPromptId === null
      ? undefined
      : snapshot.prompts.find((p) => p.id === snapshot.winnerPromptId);

  const promptLabel = createElement(
    'h4',
    {
      key: 'prompt',
      'data-role': 'prompt',
      'data-testid': 'aip-prompt-question',
      style: {
        margin: '0 0 8px 0',
        color: TEXT_COLOR,
        fontSize: '16px',
        fontWeight: 600,
      },
    },
    prompt,
  );

  // Phase marker — a tiny inline `<span>` carrying the phase text so
  // tests can assert via `screen.getByTestId('aip-state').textContent`.
  const phaseMarker = createElement(
    'span',
    {
      key: 'state',
      'data-role': 'phase-marker',
      'data-testid': 'aip-state',
      style: { display: 'none' },
    },
    phase,
  );

  const children: ReactElement[] = [promptLabel, phaseMarker];

  if (phase === 'voting') {
    // Voting phase — full prompt feed + total label.
    children.push(renderPromptFeed(snapshot.prompts, null));
  } else if (phase === 'generating') {
    // Generation phase — winner banner + spinner placeholder text.
    children.push(
      createElement(
        'div',
        {
          key: 'winner',
          'data-role': 'winner-banner',
          'data-testid': 'aip-winner',
          style: {
            padding: '12px',
            border: `2px solid ${ACCENT_COLOR}`,
            borderRadius: '8px',
            color: ACCENT_COLOR,
            fontWeight: 600,
            marginBottom: '12px',
          },
        },
        winner?.text ?? '',
      ),
      createElement(
        'p',
        {
          key: 'generating',
          'data-role': 'generating-placeholder',
          'data-testid': 'aip-generating',
          style: { color: SECONDARY_TEXT_COLOR, fontSize: '14px', margin: 0 },
        },
        '🪄 Generating with AI…',
      ),
    );
  } else {
    // Final phase — winner banner + generated asset + full prompt feed.
    children.push(
      createElement(
        'div',
        {
          key: 'winner',
          'data-role': 'winner-banner',
          'data-testid': 'aip-winner',
          style: {
            padding: '12px',
            border: `2px solid ${ACCENT_COLOR}`,
            borderRadius: '8px',
            color: ACCENT_COLOR,
            fontWeight: 600,
            marginBottom: '12px',
          },
        },
        winner?.text ?? '',
      ),
      createElement(
        'div',
        {
          key: 'asset-wrap',
          'data-role': 'asset-wrap',
          style: { marginBottom: '12px' },
        },
        snapshot.generatedAssetCacheKey === null
          ? null
          : renderAsset(targetModality, snapshot.generatedAssetCacheKey, winner?.text ?? ''),
      ),
      renderPromptFeed(snapshot.prompts, snapshot.winnerPromptId),
    );
  }

  // Total label — shown in every phase.
  children.push(
    createElement(
      'div',
      {
        key: 'total',
        'data-role': 'total-prompts',
        'data-testid': 'aip-total',
        'data-total-prompts': snapshot.prompts.length,
        style: {
          marginTop: '8px',
          color: SECONDARY_TEXT_COLOR,
          fontSize: '13px',
        },
      },
      formatTotalPromptsLabel(snapshot.prompts.length),
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'audience-ai-prompt',
      'data-testid': 'audience-ai-prompt-root',
      'data-state': phase,
      'data-modality': targetModality,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: PANEL_BG,
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      },
    },
    children,
  );
}
