// packages/export-pptx/src/test-helpers/build-doc.ts
// Test helper for constructing a fully-validated Document from terse input.
// Re-uses zod parsing so tests fail fast on invalid fixtures instead of
// silently feeding the writer ill-typed values.

import { type Document, documentSchema } from '@stageflip/schema';

const NOW = '2024-01-01T00:00:00.000Z';

export interface BuildDocInput {
  slides: Array<{
    id: string;
    title?: string;
    notes?: string;
    layoutId?: string;
    background?: { kind: 'color'; value: string } | { kind: 'asset'; value: string };
    elements: unknown[];
  }>;
  theme?: { tokens?: Record<string, string | number>; palette?: Record<string, string> };
  meta?: { title?: string };
  /** T-253-rider: deck-level layouts. */
  layouts?: unknown[];
  /** T-253-rider: deck-level masters. */
  masters?: unknown[];
}

/** Build a slide-mode Document with terse boilerplate. */
export function buildDoc(input: BuildDocInput): Document {
  const meta = {
    id: 'd1',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...(input.meta?.title !== undefined ? { title: input.meta.title } : {}),
  };
  return documentSchema.parse({
    meta,
    theme: input.theme ?? { tokens: {} },
    variables: {},
    components: {},
    masters: input.masters ?? [],
    layouts: input.layouts ?? [],
    content: {
      mode: 'slide',
      slides: input.slides.map((s) => {
        const slide: Record<string, unknown> = { id: s.id, elements: s.elements };
        if (s.title !== undefined) slide.title = s.title;
        if (s.notes !== undefined) slide.notes = s.notes;
        if (s.layoutId !== undefined) slide.layoutId = s.layoutId;
        if (s.background !== undefined) slide.background = s.background;
        return slide;
      }),
    },
  });
}
