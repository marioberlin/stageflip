// packages/skills-sync/src/schema-gen.ts
// Generator for skills/stageflip/reference/schema/SKILL.md. Walks the most
// user-facing exports of @stageflip/schema and emits a deterministic markdown
// reference page. Consumed by scripts/sync-skills.ts.

import type { ZodTypeAny } from 'zod';
import { describeSchema } from './introspect.js';

interface SchemaEntry {
  title: string;
  identifier: string;
  schema: ZodTypeAny;
  note?: string;
}

/**
 * The schemas we render into the reference skill. Ordered for reading:
 * top-level first, then elements, then content, then animations + timing.
 * Adding a new entry is all it takes to surface it in the generated skill.
 */
export function buildSchemaEntries(pkg: typeof import('@stageflip/schema')): SchemaEntry[] {
  return [
    { title: 'Document', identifier: 'documentSchema', schema: pkg.documentSchema },
    { title: 'DocumentMeta', identifier: 'documentMetaSchema', schema: pkg.documentMetaSchema },
    { title: 'Theme', identifier: 'themeSchema', schema: pkg.themeSchema },
    {
      title: 'ElementBase',
      identifier: 'elementBaseSchema',
      schema: pkg.elementBaseSchema,
      note: 'Shared base every element type merges with.',
    },
    {
      title: 'Element (discriminated union)',
      identifier: 'elementSchema',
      schema: pkg.elementSchema,
      note: 'Top-level 11-variant union across every element type.',
    },
    { title: 'TextElement', identifier: 'textElementSchema', schema: pkg.textElementSchema },
    { title: 'ImageElement', identifier: 'imageElementSchema', schema: pkg.imageElementSchema },
    { title: 'VideoElement', identifier: 'videoElementSchema', schema: pkg.videoElementSchema },
    { title: 'AudioElement', identifier: 'audioElementSchema', schema: pkg.audioElementSchema },
    { title: 'ShapeElement', identifier: 'shapeElementSchema', schema: pkg.shapeElementSchema },
    { title: 'ChartElement', identifier: 'chartElementSchema', schema: pkg.chartElementSchema },
    { title: 'TableElement', identifier: 'tableElementSchema', schema: pkg.tableElementSchema },
    { title: 'ClipElement', identifier: 'clipElementSchema', schema: pkg.clipElementSchema },
    { title: 'EmbedElement', identifier: 'embedElementSchema', schema: pkg.embedElementSchema },
    { title: 'CodeElement', identifier: 'codeElementSchema', schema: pkg.codeElementSchema },
    {
      title: 'GroupElement',
      identifier: 'groupElementSchema',
      schema: pkg.groupElementSchema,
      note: 'Recursive — `children: Element[]`.',
    },
    { title: 'SlideContent', identifier: 'slideContentSchema', schema: pkg.slideContentSchema },
    { title: 'VideoContent', identifier: 'videoContentSchema', schema: pkg.videoContentSchema },
    {
      title: 'DisplayContent',
      identifier: 'displayContentSchema',
      schema: pkg.displayContentSchema,
    },
    {
      title: 'DisplayBudget',
      identifier: 'displayBudgetSchema',
      schema: pkg.displayBudgetSchema,
      note: 'Per T-021 [rev]: totalZipKb, externalFontsAllowed, externalFontsKbCap, assetsInlined.',
    },
    {
      title: 'Animation',
      identifier: 'animationSchema',
      schema: pkg.animationSchema,
      note: 'Carries a TimingPrimitive (B1–B5) + AnimationKind.',
    },
    {
      title: 'TimingPrimitive',
      identifier: 'timingPrimitiveSchema',
      schema: pkg.timingPrimitiveSchema,
      note: 'B1–B5 union: absolute / relative / anchored / beat / event.',
    },
  ];
}

const FRONTMATTER = `---
title: Reference — Schema (auto-gen)
id: skills/stageflip/reference/schema
tier: reference
status: auto-generated
last_updated: 2026-04-20
owner_task: T-034
related:
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/rir/SKILL.md
---`;

const PREAMBLE = `# Reference — Schema

**This file is auto-generated** by \`@stageflip/skills-sync\` from the Zod schemas in
\`@stageflip/schema\`. Do not edit by hand; run \`pnpm skills-sync\` to regenerate.
The \`check-skill-drift\` CI gate (T-014) will fail if this file drifts from the
generator's current output.

Every concept and convention lives in the source skills:
\`concepts/schema/SKILL.md\` is the narrative source of truth; this reference is
a deterministic table-of-shapes for quick lookup.

`;

/**
 * Emit the full SKILL.md body. Output is deterministic — same inputs produce
 * byte-identical output so `check-skill-drift` can diff cheaply.
 */
export function generateSchemaSkill(pkg: typeof import('@stageflip/schema')): string {
  const entries = buildSchemaEntries(pkg);
  const parts: string[] = [FRONTMATTER, '', PREAMBLE.trimEnd(), '', '## Table of contents', ''];
  for (const e of entries) parts.push(`- [${e.title}](#${slug(e.title)})`);
  parts.push('');

  for (const e of entries) {
    parts.push(`## ${e.title}`);
    parts.push('');
    parts.push(`**Identifier:** \`${e.identifier}\``);
    if (e.note) parts.push(`**Note:** ${e.note}`);
    const desc = describeSchema(e.schema);
    parts.push(`**Kind:** ${desc.summary}`);
    if (desc.discriminator) parts.push(`**Discriminator:** \`${desc.discriminator}\``);
    parts.push('');

    if (desc.kind === 'object' && desc.fields.length > 0) {
      parts.push('| Field | Type | Required |');
      parts.push('|---|---|---|');
      for (const f of desc.fields) {
        const req = f.required ? '✓' : '—';
        parts.push(`| \`${f.name}\` | ${escapePipes(f.description)} | ${req} |`);
      }
      parts.push('');
    } else if (desc.kind === 'enum') {
      parts.push('**Values:**');
      for (const v of desc.members) parts.push(`- \`${v}\``);
      parts.push('');
    } else if (desc.kind === 'union' || desc.kind === 'discriminated-union') {
      parts.push('**Variants:**');
      for (const m of desc.members) parts.push(`- ${escapePipes(m)}`);
      parts.push('');
    } else if (desc.kind === 'array' || desc.kind === 'record') {
      if (desc.inner) parts.push(`**Inner:** ${escapePipes(desc.inner)}`);
      parts.push('');
    } else if (desc.kind === 'lazy') {
      parts.push('**Shape:** recursive (see canonical schema source).');
      parts.push('');
    } else {
      parts.push(`**Shape:** ${escapePipes(desc.summary)}`);
      parts.push('');
    }
  }

  parts.push('');
  parts.push('---');
  parts.push(
    '*Regenerate with `pnpm skills-sync`. Adding or removing an exported schema in `@stageflip/schema` flows through automatically when the corresponding entry is added to `buildSchemaEntries` in `@stageflip/skills-sync/src/schema-gen.ts`.*',
  );
  parts.push('');

  return parts.join('\n');
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|');
}
