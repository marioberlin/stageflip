// packages/variant-gen/src/generate.ts
// `generateVariants` — the variant-generation primitive.
//
// Turns one canonical Document into a (synchronous, eager) iterable of
// VariantOutput records, one per matrix coordinate. Per ADR-005 §D6 the
// output is consumed by the export-matrix routing layer (T-408); per
// D-T386-9 variant-gen is opaque to how its output is rendered.
//
// Determinism: pure transformation over inputs (D-T386-4). No `Date.now`,
// no `Math.random`, no rAF. The cache key is content-addressed via
// `deriveCacheKey` so identical inputs yield identical keys across runs.
//
// Structural sharing: per D-T386-5, a variant whose only difference from
// the source is one substituted text slot retains reference identity for
// every other element. AC #21 pins this on a 100-element source.

import type { Document } from '@stageflip/schema';
import type {
  LocaleAxisEntry,
  MessageVariantAxisEntry,
  VariantSlotDef,
  VariantSlots,
} from '@stageflip/schema';
import { deriveCacheKey } from './cache-key.js';
import { VariantMatrixCapExceededError } from './errors.js';
import type { LocaleProvider } from './locale-provider.js';
import { replaceElementInDocument } from './structural-sharing.js';

/** Default cap on output count (D-T386-7). */
export const DEFAULT_MAX_VARIANTS = 100;

/**
 * Variant-matrix specification. T-386 v1 ships message + locale axes only.
 *
 * D-T386-8: `size` is explicitly out of scope (T-386a follow-up). The
 * `size?: never` marker forces a TypeScript error at authoring time;
 * the matching Zod schema in `@stageflip/schema/variants` is `strict()`,
 * so passing `size:` at runtime fails parse.
 */
export interface VariantMatrixSpec {
  /** Variants of message slots (text content). */
  messages?: ReadonlyArray<MessageVariantAxisEntry>;
  /** Locales to render the source + each message variant in. */
  locales?: ReadonlyArray<LocaleAxisEntry>;
  /** Strict cap on output count; prevents combinatorial blow-ups. Default 100. */
  maxVariants?: number;
  /** OUT OF SCOPE — see T-386a. Authoring-time TypeScript error if set. */
  readonly size?: never;
}

export interface VariantOutput {
  /** Resolved coordinate. Both fields optional — empty matrix yields neither axis. */
  readonly coordinate: { messageId?: string; locale?: string };
  /** Transformed Document — never references the source after construction. */
  readonly document: Document;
  /** Stable cache key — sha256(sourceDocId + coordinate) — used by the export pipeline. */
  readonly cacheKey: string;
}

export interface GenerateVariantsOptions {
  /**
   * Locale-axis translation backend. Required when `spec.locales` is
   * non-empty AND the source Document carries variant slots whose text
   * differs by locale; tests that use locale-only matrices without
   * substitutions can omit this.
   */
  localeProvider?: LocaleProvider;
}

interface DocLikeWithVariantSlots extends Document {
  variantSlots?: VariantSlots;
}

/**
 * Walk the matrix and yield per-coordinate variant outputs. Synchronous +
 * bounded; the cap-exceeded path throws BEFORE any output is emitted (AC
 * #14, D-T386-7). Returns an Iterable so callers can `for...of` and stop
 * early.
 */
export function generateVariants(
  source: Document,
  spec: VariantMatrixSpec,
  options: GenerateVariantsOptions = {},
): Iterable<VariantOutput> {
  const messages = spec.messages ?? [];
  const locales = spec.locales ?? [];
  const cap = spec.maxVariants ?? DEFAULT_MAX_VARIANTS;

  const messageDim = Math.max(1, messages.length);
  const localeDim = Math.max(1, locales.length);
  const total = messages.length === 0 && locales.length === 0 ? 0 : messageDim * localeDim;
  if (total > cap) {
    throw new VariantMatrixCapExceededError(cap, total);
  }

  const docWithSlots = source as DocLikeWithVariantSlots;
  const slots: VariantSlots = docWithSlots.variantSlots ?? {};

  const provider = options.localeProvider;
  const sourceDocId = source.meta.id;

  const out: VariantOutput[] = [];
  if (total === 0) return out;

  const messageEntries: ReadonlyArray<MessageVariantAxisEntry | null> =
    messages.length === 0 ? [null] : messages;
  const localeEntries: ReadonlyArray<LocaleAxisEntry | null> =
    locales.length === 0 ? [null] : locales;

  for (const messageEntry of messageEntries) {
    for (const localeEntry of localeEntries) {
      const coordinate: { messageId?: string; locale?: string } = {};
      if (messageEntry) coordinate.messageId = messageEntry.id;
      if (localeEntry) coordinate.locale = localeEntry.tag;

      const cacheKey = deriveCacheKey(sourceDocId, coordinate);
      const newDocId = `${sourceDocId}::${cacheKey}`;
      const docWithNewId: Document = {
        ...source,
        meta: { ...source.meta, id: newDocId },
      };

      // Apply per-slot substitutions. Each substitution structurally shares
      // the rest of the tree (D-T386-5).
      let working: Document = docWithNewId;
      for (const [slotName, slotDef] of Object.entries(slots) as Array<[string, VariantSlotDef]>) {
        const sourceText = readElementText(source, slotDef);
        const messageOverride = messageEntry?.slots?.[slotName];
        const baseText = messageOverride ?? sourceText;
        const finalText =
          localeEntry && provider
            ? provider.translate({
                tag: localeEntry.tag,
                key: slotName,
                source: baseText,
              })
            : baseText;

        if (finalText === sourceText && messageOverride === undefined) {
          // No substitution needed — preserve full structural sharing.
          continue;
        }

        working = replaceElementInDocument(working, slotDef.elementId, {
          [slotDef.path]: finalText,
        });
      }

      out.push({ coordinate, document: working, cacheKey });
    }
  }

  return out;
}

/** Look up the existing text at the slot path. Returns '' if unresolved. */
function readElementText(source: Document, slotDef: VariantSlotDef): string {
  const content = source.content;
  if (content.mode !== 'slide') return '';
  for (const slide of content.slides) {
    for (const el of slide.elements) {
      if ((el as unknown as { id: string }).id !== slotDef.elementId) continue;
      const value = (el as unknown as Record<string, unknown>)[slotDef.path];
      return typeof value === 'string' ? value : '';
    }
  }
  return '';
}
