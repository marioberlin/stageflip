// packages/export-html5-zip/src/fallback/generator.ts
// T-204 — the fallback generator. Wires a `FrameRenderer` +
// PNG/GIF encoders + an `InMemoryAssetResolver` into a
// `FallbackProvider` that T-203b's orchestrator consumes.
//
// How it plugs in:
//
//   const resolver = new InMemoryAssetResolver();
//   const provider = createFallbackGenerator({
//     frameRenderer: myRenderer,
//     resolver,
//     durationMs: displayContent.durationMs,
//   });
//   const result = await exportHtml5ZipForSize(size, input, {
//     bundler, assetResolver: resolver, fallbackProvider: provider,
//   });

import type { AssetRef, BannerFallback } from '@stageflip/schema';

import type { InMemoryAssetResolver } from '../asset-resolver.js';
import type { BannerSize, FallbackProvider } from '../types.js';
import { encodeGif } from './render-gif.js';
import { encodePng } from './render-png.js';
import type { FallbackGeneratorOptions, FrameRenderer, RgbaFrame } from './types.js';

const DEFAULT_FPS = 30;
const DEFAULT_GIF_FRAME_COUNT = 8;
const DEFAULT_GIF_START_FRACTION = 0.125;
const DEFAULT_GIF_END_FRACTION = 0.875;
const DEFAULT_GIF_FRAME_DELAY_MS = 250;

export interface CreateFallbackGeneratorInput {
  readonly frameRenderer: FrameRenderer;
  readonly resolver: InMemoryAssetResolver;
  /** Composition duration. Required — used to compute midpoint + GIF frames. */
  readonly durationMs: number;
  readonly options?: FallbackGeneratorOptions;
}

function assetRefFor(prefix: string, size: BannerSize): AssetRef {
  const id = size.id ?? `${size.width}x${size.height}`;
  return `asset:fallback-${prefix}-${id}` as AssetRef;
}

/** Compute the 0-based midpoint frame index for a composition. */
export function midpointFrameIndex(durationMs: number, fps: number): number {
  const totalFrames = Math.max(1, Math.round((durationMs * fps) / 1000));
  return Math.floor(totalFrames / 2);
}

/**
 * Compute an evenly-spaced list of frame indices for the animated GIF.
 * Returns indices in ascending order; deduplicated when spacing rounds
 * to a single frame (common for very short compositions).
 */
export function gifFrameIndices(
  durationMs: number,
  fps: number,
  count: number,
  startFraction: number,
  endFraction: number,
): number[] {
  if (count <= 0) return [];
  const totalFrames = Math.max(1, Math.round((durationMs * fps) / 1000));
  if (count === 1) {
    return [Math.floor(totalFrames * ((startFraction + endFraction) / 2))];
  }
  const indices: number[] = [];
  const span = endFraction - startFraction;
  for (let i = 0; i < count; i++) {
    const fraction = startFraction + (span * i) / (count - 1);
    indices.push(Math.min(totalFrames - 1, Math.floor(totalFrames * fraction)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/**
 * Build a `FallbackProvider` that renders one midpoint PNG + an
 * optional N-frame animated GIF per banner size. Bytes are written to
 * `input.resolver` under deterministic `asset:fallback-png-<id>` /
 * `asset:fallback-gif-<id>` refs; the returned `BannerFallback` points
 * at those refs. Two calls with identical inputs produce byte-identical
 * output.
 */
export function createFallbackGenerator(input: CreateFallbackGeneratorInput): FallbackProvider {
  const fps = input.options?.fps ?? DEFAULT_FPS;
  const gifFrameCount = input.options?.gifFrameCount ?? DEFAULT_GIF_FRAME_COUNT;
  const gifStartFraction = input.options?.gifStartFraction ?? DEFAULT_GIF_START_FRACTION;
  const gifEndFraction = input.options?.gifEndFraction ?? DEFAULT_GIF_END_FRACTION;
  const gifFrameDelayMs = input.options?.gifFrameDelayMs ?? DEFAULT_GIF_FRAME_DELAY_MS;

  return {
    async generate(size: BannerSize): Promise<BannerFallback> {
      const midFrame = midpointFrameIndex(input.durationMs, fps);
      const midRgba: RgbaFrame = await input.frameRenderer.renderFrame(size, midFrame);
      if (midRgba.width !== size.width || midRgba.height !== size.height) {
        throw new Error(
          `frameRenderer returned ${midRgba.width}x${midRgba.height} for requested ` +
            `${size.width}x${size.height}`,
        );
      }
      const pngBytes = encodePng(midRgba);
      const pngRef = assetRefFor('png', size);
      input.resolver.set(pngRef, pngBytes);

      if (gifFrameCount <= 0) {
        return { png: pngRef };
      }
      const gifIndices = gifFrameIndices(
        input.durationMs,
        fps,
        gifFrameCount,
        gifStartFraction,
        gifEndFraction,
      );
      const gifFrames: RgbaFrame[] = [];
      for (const idx of gifIndices) {
        const frame = await input.frameRenderer.renderFrame(size, idx);
        gifFrames.push(frame);
      }
      const gifBytes = encodeGif(gifFrames, { frameDelayMs: gifFrameDelayMs });
      const gifRef = assetRefFor('gif', size);
      input.resolver.set(gifRef, gifBytes);
      return { png: pngRef, gif: gifRef };
    },
  };
}
