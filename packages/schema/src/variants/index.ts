// packages/schema/src/variants/index.ts
// T-386 — `@stageflip/schema/variants` barrel. Re-exports the matrix-spec
// + variant-slots Zod surfaces.

export {
  type LocaleAxisEntry,
  type MessageVariantAxisEntry,
  type VariantMatrixSpec,
  localeAxisEntrySchema,
  messageVariantAxisEntrySchema,
  variantMatrixSpecSchema,
} from './matrix-spec.js';

export {
  type VariantSlotDef,
  type VariantSlots,
  variantSlotDefSchema,
  variantSlotsSchema,
} from './variant-slots.js';
