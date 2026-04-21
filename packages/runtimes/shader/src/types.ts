// packages/runtimes/shader/src/types.ts
// Narrow interface over `getContext('webgl2')` / `getContext('webgl')`. Tests
// inject a stub via the `glContextFactory` seam; production uses the real
// canvas API.

/** Uniform values supported by the runtime's render loop. */
export type UniformValue = number | readonly number[];

/** Per-frame uniform resolver: given progress + props, return uniform values keyed by name. */
export type UniformsForFrame<P> = (args: {
  /** Clip-local progress 0..1 (`localFrame / clipDurationInFrames`). */
  progress: number;
  /** Clip-local time in seconds (`localFrame / fps`). */
  timeSec: number;
  /** Clip-local frame number. */
  frame: number;
  /** Composition fps. */
  fps: number;
  /** Canvas width / height in pixels. */
  resolution: readonly [number, number];
  /** Clip props. */
  props: P;
}) => Readonly<Record<string, UniformValue>>;

/** Factory for the WebGL context — the seam that tests use to stub GL out. */
export type GlContextFactory = (
  canvas: HTMLCanvasElement,
) => WebGL2RenderingContext | WebGLRenderingContext | null;

/** Default factory: prefer webgl2, fall back to webgl. */
export const defaultGlContextFactory: GlContextFactory = (canvas) => {
  const gl2 = canvas.getContext('webgl2');
  if (gl2 !== null) return gl2 as WebGL2RenderingContext;
  return canvas.getContext('webgl') as WebGLRenderingContext | null;
};
