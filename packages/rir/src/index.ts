// packages/rir/src/index.ts
// @stageflip/rir — types for the Renderable Intermediate Representation.
// The compiler itself (T-030) and its sub-passes (T-031, stacking + timing
// flatten) import this package for their output shape. Renderers import it
// as their input shape.

export * from './types.js';
export { compileRIR, type CompileRIROptions } from './compile/index.js';
export type { DataSourceProvider } from './compile/passes.js';
