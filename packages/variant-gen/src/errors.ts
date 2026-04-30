// packages/variant-gen/src/errors.ts
// Variant-gen typed errors. `VariantMatrixCapExceededError` is the only
// public failure today (D-T386-7); future errors land here.

/**
 * Thrown synchronously when a `VariantMatrixSpec` would emit more than
 * `maxVariants` variants. The throw happens BEFORE any variant is yielded
 * — partial output is never returned (AC #14).
 */
export class VariantMatrixCapExceededError extends Error {
  readonly cap: number;
  readonly attempted: number;

  constructor(cap: number, attempted: number) {
    super(
      `Variant matrix would emit ${attempted} variants but maxVariants is ${cap}. Reduce axes, narrow the spec, or raise maxVariants.`,
    );
    this.name = 'VariantMatrixCapExceededError';
    this.cap = cap;
    this.attempted = attempted;
  }
}
