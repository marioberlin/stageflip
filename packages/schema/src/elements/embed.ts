// packages/schema/src/elements/embed.ts
// Embed element — iframe for external content. Wrapped in `isolation: isolate`
// by the RIR compiler (see concepts/rir/SKILL.md stacking-context pass).

import { z } from 'zod';
import { elementBaseSchema } from './base.js';

export const embedElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('embed'),
      src: z.string().url(),
      sandbox: z
        .array(
          z.enum([
            'allow-scripts',
            'allow-same-origin',
            'allow-forms',
            'allow-popups',
            'allow-modals',
          ]),
        )
        .default(['allow-scripts']),
      allowFullscreen: z.boolean().default(false),
    }),
  )
  .strict();

export type EmbedElement = z.infer<typeof embedElementSchema>;
