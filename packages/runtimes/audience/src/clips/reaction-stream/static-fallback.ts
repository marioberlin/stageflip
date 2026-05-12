// packages/runtimes/audience/src/clips/reaction-stream/static-fallback.ts
// T-470 — Static-fallback renderer for the `reaction-stream` clip.
// Returns a React tree that mounts a `<ShaderClipHost>` from
// `@stageflip/runtimes-shader` (T-383) configured with the
// `REACTION_STREAM_FRAGMENT` shader + the uniforms computed by
// `computeReactionStreamUniforms` over the snapshot's
// `emojiCounts` × the clip's `palette`.
//
// Layout (per T-470 spec + ADR-010 §D4):
//   - Outer panel (`<div data-stageflip-clip="reaction-stream">`)
//     carries the prompt label + the total-reactions counter.
//   - Below the prompt: a `<div>` positioning context. The
//     `<ShaderClipHost>` renders a `<canvas>` filling the stage.
//   - Empty-snapshot routing: zero `emojiCounts` AND zero
//     `totalReactions` renders a placeholder + transparent canvas
//     (`Waiting for reactions…` status line).
//   - Static-fallback uses `localFrame: 0` (the snapshot's "peak"
//     frame) per ADR-010 §D4.
//
// Browser-safe — pure JSX (createElement). The shader runtime's host
// owns the canvas + the WebGL state.

import type { ReactionStreamAggregation } from '@stageflip/audience-contract';
import { ShaderClipHost } from '@stageflip/runtimes-shader';
import type { ReactionStreamClipProps } from '@stageflip/schema';
import { type ReactElement, createElement } from 'react';

import { REACTION_STREAM_FRAGMENT } from './fragment.glsl.js';
import { computeReactionStreamUniforms } from './uniforms.js';

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. `prompt` + `palette` propagate to the rendered DOM (the prompt
 * label + the per-emoji density mapping inside the shader).
 */
export interface ReactionStreamStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /** Question text shown above the canvas stage. */
  readonly prompt: string;
  /** Emoji palette from `clip.props.palette`. */
  readonly palette: ReactionStreamClipProps['palette'];
  /** Composition fps — drives the `uTime` uniform. Defaults to 30. */
  readonly fps?: number;
  /** Clip-local frame for the uniform computation. Defaults to 0 (peak). */
  readonly localFrame?: number;
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Secondary text colour. */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Default fps for the static-fallback uniform computation. */
const DEFAULT_STATIC_FPS = 30;

/**
 * Format the total-reactions label. Matches the `${n} reactions` /
 * `1 reaction` singular-plural precedent from the prior families.
 */
export function formatTotalReactionsLabel(totalReactions: number): string {
  return `${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}`;
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. The tree includes the prompt label, a
 * `<ShaderClipHost>` for the particle storm, and a total-reactions
 * counter. The shader host owns the canvas + the GL state.
 *
 * Routing:
 *   - `aggregation.emojiCounts.length === 0` AND
 *     `aggregation.totalReactions === 0` → renders the
 *     `Waiting for reactions…` placeholder.
 *   - otherwise → renders the shader canvas with the computed uniforms.
 */
export function renderReactionStreamStaticFallback(input: {
  readonly snapshot: ReactionStreamAggregation;
  readonly context: ReactionStreamStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { width, height, prompt, palette } = context;
  const fps = context.fps ?? DEFAULT_STATIC_FPS;
  const localFrame = context.localFrame ?? 0;
  const isIdle = snapshot.emojiCounts.length === 0 && snapshot.totalReactions === 0;

  const uniforms = computeReactionStreamUniforms(snapshot.emojiCounts, palette, localFrame, fps);

  const promptLabel = createElement(
    'h4',
    {
      key: 'prompt',
      'data-role': 'prompt',
      'data-testid': 'reaction-stream-prompt',
      style: {
        margin: '0 0 8px 0',
        color: TEXT_COLOR,
        fontSize: '16px',
        fontWeight: 600,
      },
    },
    prompt,
  );

  // Stage height — reserve room for the total label (~64 px) below.
  const stageHeight = Math.max(1, height - 64);

  // Convert uniforms to the host's `UniformValue` shape — numbers stay
  // numbers; the Float32Array densities are passed positionally via
  // `uniform float uDensities[12]`. The host's `applyUniform` switches
  // on length (1..4); for an array uniform we set each element via the
  // suffixed name. The shader declares `uDensities[12]`; GLSL allows
  // setting via `uniform1fv` on the array name, but the host's narrow
  // `UniformValue` only supports numbers + readonly arrays. We forward
  // each density value as a separate uniform `uDensities[i]` so the
  // host can `uniform1f` each.
  const flatUniforms: Record<string, number> = {
    uTime: uniforms.uTime,
    uPaletteSize: uniforms.uPaletteSize,
    uTotalReactions: uniforms.uTotalReactions,
  };
  // Reaction-stream's shader bounds the loop at 12; densities beyond
  // palette size are zero by `computeReactionStreamUniforms`.
  for (let i = 0; i < 12; i += 1) {
    const density = uniforms.uDensities[i] ?? 0;
    flatUniforms[`uDensities[${i}]`] = density;
  }

  const shaderCanvas = createElement(ShaderClipHost, {
    key: 'shader',
    fragmentShader: REACTION_STREAM_FRAGMENT,
    width,
    height: stageHeight,
    uniforms: flatUniforms,
  });

  const innerChildren: ReactElement[] = [shaderCanvas];
  if (isIdle) {
    innerChildren.push(
      createElement(
        'div',
        {
          key: 'waiting',
          'data-role': 'waiting-overlay',
          'data-testid': 'reaction-stream-waiting',
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: SECONDARY_TEXT_COLOR,
            fontSize: '14px',
            background: 'rgba(255, 255, 255, 0.6)',
          },
        },
        'Waiting for reactions…',
      ),
    );
  }

  const inner = createElement(
    'div',
    {
      key: 'inner',
      'data-role': 'shader-stage',
      'data-testid': 'reaction-stream-stage',
      style: {
        position: 'relative',
        width: '100%',
        flex: '1 1 auto',
        overflow: 'hidden',
      },
    },
    innerChildren,
  );

  const totalLabel = createElement(
    'div',
    {
      key: 'total',
      'data-role': 'total-reactions',
      'data-testid': 'reaction-stream-total',
      'data-total-reactions': snapshot.totalReactions,
      style: {
        marginTop: '8px',
        color: SECONDARY_TEXT_COLOR,
        fontSize: '13px',
      },
    },
    formatTotalReactionsLabel(snapshot.totalReactions),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'reaction-stream',
      'data-testid': 'reaction-stream-root',
      'data-state': isIdle ? 'waiting' : 'aggregated',
      'data-palette-size': palette.length,
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
      },
    },
    [promptLabel, inner, totalLabel],
  );
}
