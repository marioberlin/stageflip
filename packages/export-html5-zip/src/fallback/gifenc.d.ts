// packages/export-html5-zip/src/fallback/gifenc.d.ts
// Local type declarations for gifenc 1.0.3 — upstream ships no @types
// package. Covers only the surface `render-gif.ts` calls. Extend here
// if more of the gifenc API is adopted.

declare module 'gifenc' {
  export interface GifWriteFrameOptions {
    palette?: number[][];
    delay?: number;
    dispose?: number;
    transparent?: boolean;
    transparentIndex?: number;
  }

  export interface GIFEncoder {
    writeFrame(
      indexed: Uint8Array,
      width: number,
      height: number,
      options?: GifWriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoder;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number },
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;
}
