// apps/audience-join/src/components/heatmap-voter-input.tsx
// T-469 — Voter UI for the `heatmap` clip family. Renders the
// underlying image with an `onClick` handler that captures the tap's
// normalised `(x, y)` coordinates (`[0..1]` against the image's
// bounding rect) and emits a `HeatmapVote`.
//
// Multi-tap support: voters may tap up to `maxIntensity` times. After
// the cap is reached the tap-target disables and a "All taps used"
// status appears. Per the contract each tap is emitted as a single
// vote with `intensity: 1`; the server-side aggregator accumulates
// per-tap weight at the grid level.
//
// The component is presentation-only — the caller wires the
// `onSubmit` callback to `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { HeatmapVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useRef, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`HeatmapVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives the prompt / imageRef / maxIntensity from
 * the first aggregation snapshot (or from the live-mount props).
 */
export interface HeatmapVoterInputDomainProps {
  /** Question text shown above the image. */
  readonly prompt: string;
  /** Underlying image URL or `cacheKey:` reference. */
  readonly imageRef: string;
  /** Per-voter tap cap. Bounded 1..20. */
  readonly maxIntensity: number;
  /** Tap callback — invoked once per tap with normalised `(x, y)`. */
  readonly onSubmit: (vote: HeatmapVote) => void;
  /** When true, the tap-target is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Clamp a value to the closed interval `[0, 1]`.
 */
function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Presentational voter UI. The voter sees the prompt + the underlying
 * image. Clicking on the image emits a single `HeatmapVote` per click
 * with the click's normalised `(x, y)` within the image's bounding
 * rect. After `maxIntensity` clicks the image disables and a status
 * line appears.
 */
export function HeatmapVoterInputDomain(props: HeatmapVoterInputDomainProps): ReactElement {
  const { prompt, imageRef, maxIntensity, onSubmit, disabled = false } = props;
  const [tapCount, setTapCount] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const inputDisabled = disabled || tapCount >= maxIntensity;

  const handleTap = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (inputDisabled) return;
      const img = imgRef.current;
      if (img === null) return;
      const rect = img.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);
      onSubmit({ kind: 'heatmap', x, y, intensity: 1 });
      setTapCount((prev) => prev + 1);
    },
    [inputDisabled, onSubmit],
  );

  return (
    <section data-testid="voter-input-heatmap">
      <p
        data-testid="heatmap-voter-prompt"
        style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0' }}
      >
        {prompt}
      </p>
      <div
        data-role="image-stage"
        style={{ position: 'relative', width: '100%', maxWidth: '480px' }}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap-target is touch-first; keyboard alt handled by the global voter shell. */}
        <img
          ref={imgRef}
          src={imageRef}
          alt={prompt}
          data-testid="heatmap-voter-image"
          data-disabled={inputDisabled ? 'true' : 'false'}
          onClick={handleTap}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            cursor: inputDisabled ? 'not-allowed' : 'crosshair',
            opacity: inputDisabled ? 0.6 : 1,
          }}
        />
      </div>
      <p
        data-testid="heatmap-voter-status"
        data-tap-count={tapCount}
        data-max-intensity={maxIntensity}
        style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}
      >
        {tapCount >= maxIntensity ? 'All taps used' : `Tap submitted (${tapCount}/${maxIntensity})`}
      </p>
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-469 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the prompt / imageRef /
 * maxIntensity from the live aggregation feed and forwards `onSubmit`
 * to the `voterAppClient.submitVote` channel.
 *
 * For T-469 the wrapper renders a disabled placeholder card that
 * includes the session id; the test verifies the dispatcher resolves
 * the kind to this component (not the unregistered fallback).
 */
export function HeatmapVoterInput(props: VoterInputProps): ReactElement {
  // A minimal 1×1 transparent GIF — placeholder so the underlying
  // `<img>` element renders without surfacing a browser "empty src"
  // warning. The production wrapper replaces this with the live
  // imageRef from the snapshot feed.
  const PLACEHOLDER_IMAGE =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  return (
    <section
      data-testid="voter-input-heatmap-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <HeatmapVoterInputDomain
        prompt="Waiting for the heatmap…"
        imageRef={PLACEHOLDER_IMAGE}
        maxIntensity={1}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
