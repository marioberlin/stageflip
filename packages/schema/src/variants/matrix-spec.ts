// packages/schema/src/variants/matrix-spec.ts
// T-386 — `VariantMatrixSpec` schema. Authors describe the variant matrix
// via two axes (messages + locales) plus a hard `maxVariants` cap; the
// schema validates structurally before @stageflip/variant-gen materialises
// the matrix.
//
// BROWSER-SAFE — pure Zod, no Node-only imports.
//
// D-T386-8 (size axis explicitly out of scope): the TypeScript surface in
// `@stageflip/variant-gen` carries `size?: never` so authors writing TS
// see a compile error. The Zod schema below is `strict()`, so passing
// `size:` at runtime fails parse — silent rejection over silent ignore.

import { z } from 'zod';

/**
 * Light-weight BCP-47 sanity regex. Matches common shapes:
 *   en, en-US, pt-BR, zh-Hant, zh-Hant-TW, en-US-x-private
 * Not a full ICU validator — that lives at the locale-provider layer if a
 * provider needs strict validation. Rejects whitespace, punctuation, empties.
 */
const BCP_47_REGEX = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** One message-axis entry. `id` keys the variant in output coordinates. */
export const messageVariantAxisEntrySchema = z
  .object({
    id: z.string().min(1),
    /** Map of slot-name → text override. Slot names match `Document.variantSlots`. */
    slots: z.record(z.string()),
  })
  .strict();
export type MessageVariantAxisEntry = z.infer<typeof messageVariantAxisEntrySchema>;

/** One locale-axis entry. `tag` is BCP-47. */
export const localeAxisEntrySchema = z
  .object({
    tag: z.string().min(1).regex(BCP_47_REGEX, 'tag must be a BCP-47-shaped locale identifier'),
  })
  .strict();
export type LocaleAxisEntry = z.infer<typeof localeAxisEntrySchema>;

/**
 * Full matrix spec. All axes optional; cap defaults at the variant-gen layer
 * (the schema only enforces `maxVariants >= 1` if supplied). `size` is NOT
 * a field here (D-T386-8) — `strict()` rejects it at runtime.
 */
export const variantMatrixSpecSchema = z
  .object({
    messages: z
      .array(messageVariantAxisEntrySchema)
      .superRefine((entries, ctx) => {
        const seen = new Set<string>();
        for (const e of entries) {
          if (seen.has(e.id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `messages[].id must be unique; saw "${e.id}" twice`,
              path: [],
            });
            return;
          }
          seen.add(e.id);
        }
      })
      .optional(),
    locales: z.array(localeAxisEntrySchema).optional(),
    maxVariants: z.number().int().positive().optional(),
  })
  .strict();
export type VariantMatrixSpec = z.infer<typeof variantMatrixSpecSchema>;
