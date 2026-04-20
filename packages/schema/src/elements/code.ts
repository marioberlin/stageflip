// packages/schema/src/elements/code.ts
// Code element — syntax-highlighted source block.

import { z } from 'zod';
import { elementBaseSchema } from './base.js';

/** Narrow-ish list of languages the default theme knows about. More can be
 * registered at runtime; the type here catches typos in common cases. */
export const codeLanguageSchema = z.enum([
  'plaintext',
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'rust',
  'go',
  'java',
  'kotlin',
  'swift',
  'ruby',
  'php',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'toml',
  'markdown',
  'bash',
  'sql',
  'other',
]);

export const codeElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('code'),
      code: z.string(),
      language: codeLanguageSchema.default('plaintext'),
      theme: z.string().optional(),
      showLineNumbers: z.boolean().default(false),
      wrap: z.boolean().default(false),
    }),
  )
  .strict();

export type CodeLanguage = z.infer<typeof codeLanguageSchema>;
export type CodeElement = z.infer<typeof codeElementSchema>;
