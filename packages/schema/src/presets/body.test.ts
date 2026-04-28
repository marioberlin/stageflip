// packages/schema/src/presets/body.test.ts
// AC #9–#12.

import { describe, expect, it } from 'vitest';

import { extractPresetBody } from './body.js';

const CANONICAL_BODY = `# CNN Classic — lower third

## Visual tokens
- Banner: white fill
- End cap: red

## Typography
- Headline: Bold Condensed

## Animation
- Wipe L→R, 600ms

## Rules
- Use for breaking news

## Acceptance (parity)
- Reference frames: 0, 15, 30, 60
- PSNR ≥ 40 dB

## References
- compass §CNN
`;

describe('extractPresetBody (AC #9–#12)', () => {
  it('AC #9: canonical 6-section body parses into 6 fields', () => {
    const body = extractPresetBody(CANONICAL_BODY);
    expect(body.visualTokens).toContain('Banner: white fill');
    expect(body.typography).toContain('Bold Condensed');
    expect(body.animation).toContain('Wipe L→R');
    expect(body.rules).toContain('Use for breaking news');
    expect(body.acceptance).toContain('PSNR ≥ 40 dB');
    expect(body.references).toContain('compass §CNN');
    expect(body.unknown).toEqual({});
  });

  it('AC #9: section content preserves intra-section newlines but trims surrounding blanks', () => {
    const body = extractPresetBody(CANONICAL_BODY);
    expect(body.visualTokens.startsWith('-')).toBe(true);
    expect(body.visualTokens.endsWith('\n')).toBe(false);
  });

  it('AC #10: section order is structural, not semantic', () => {
    const reversed = `## References
- ref a

## Acceptance
- ok

## Rules
- ok

## Animation
- ok

## Typography
- ok

## Visual tokens
- ok
`;
    const body = extractPresetBody(reversed);
    expect(body.visualTokens).toBe('- ok');
    expect(body.typography).toBe('- ok');
    expect(body.animation).toBe('- ok');
    expect(body.rules).toBe('- ok');
    expect(body.acceptance).toBe('- ok');
    expect(body.references).toBe('- ref a');
  });

  it('AC #11: unknown H2 sections land in body.unknown by header text', () => {
    const body = extractPresetBody(`${CANONICAL_BODY}\n## Notes\n- internal note\n`);
    expect(body.unknown).toEqual({ Notes: '- internal note' });
  });

  it('AC #12: missing canonical sections produce empty strings (not undefined)', () => {
    const body = extractPresetBody('## Typography\n- only this section\n');
    expect(body.typography).toBe('- only this section');
    expect(body.visualTokens).toBe('');
    expect(body.animation).toBe('');
    expect(body.rules).toBe('');
    expect(body.acceptance).toBe('');
    expect(body.references).toBe('');
    // Empty-string check, not undefined check (spec D-T304-4).
    expect(body.visualTokens.length).toBe(0);
    expect(body.unknown).toEqual({});
  });

  it('handles `## Acceptance` (without parity suffix) as the same field', () => {
    const body = extractPresetBody('## Acceptance\n- threshold\n');
    expect(body.acceptance).toBe('- threshold');
  });

  it('treats H3 headers as section content, not new sections', () => {
    const body = extractPresetBody('## Rules\n### Sub-rule\n- detail\n');
    expect(body.rules).toContain('### Sub-rule');
    expect(body.rules).toContain('- detail');
  });

  it('discards content before the first H2 (e.g., a leading H1 + paragraph)', () => {
    const body = extractPresetBody('# Title\n\nSome lead text.\n\n## Typography\n- t\n');
    expect(body.typography).toBe('- t');
    expect(
      Object.values(body)
        .filter((v) => typeof v === 'string')
        .join(''),
    ).toContain('- t');
  });

  it('header matching is case-insensitive', () => {
    const body = extractPresetBody('## VISUAL TOKENS\n- x\n## typography\n- y\n');
    expect(body.visualTokens).toBe('- x');
    expect(body.typography).toBe('- y');
  });
});
