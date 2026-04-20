// packages/schema/src/content/index.ts
// Mode-discriminated content union. Every Document has exactly one `content`
// whose `mode` selects the shape.

import { z } from 'zod';
import { type DisplayContent, displayContentSchema } from './display.js';
import { type SlideContent, slideContentSchema } from './slide.js';
import { type VideoContent, videoContentSchema } from './video.js';

/** Discriminated union across the three modes. */
export const contentSchema = z.discriminatedUnion('mode', [
  slideContentSchema,
  videoContentSchema,
  displayContentSchema,
]);
export type Content = SlideContent | VideoContent | DisplayContent;

export const MODES = ['slide', 'video', 'display'] as const;
export type Mode = (typeof MODES)[number];

export * from './display.js';
export * from './slide.js';
export * from './video.js';
