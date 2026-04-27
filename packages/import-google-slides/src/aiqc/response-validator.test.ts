// packages/import-google-slides/src/aiqc/response-validator.test.ts
// Pin response-validator behavior. ACs #12 / #13 / #14 / #15 / #16.

import { describe, expect, it } from 'vitest';
import { parseGeminiResolution, stripMarkdownFences } from './response-validator.js';

describe('stripMarkdownFences', () => {
  it('strips a json-tagged code fence', () => {
    const input = '```json\n{"a":1}\n```';
    expect(stripMarkdownFences(input)).toBe('{"a":1}');
  });

  it('strips an untagged code fence', () => {
    const input = '```\n{"a":1}\n```';
    expect(stripMarkdownFences(input)).toBe('{"a":1}');
  });

  it('passes plain JSON through unchanged after trimming', () => {
    expect(stripMarkdownFences('  {"a":1}  ')).toBe('{"a":1}');
  });
});

const VALID_RESPONSE = {
  confidence: 0.9,
  resolvedKind: 'text',
  text: 'Hello',
  fillColor: null,
  shapeKind: null,
  reasoning: 'OCR matched the text region',
};

describe('parseGeminiResolution', () => {
  it('AC #12: parses a valid response', () => {
    const result = parseGeminiResolution(JSON.stringify(VALID_RESPONSE));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.confidence).toBe(0.9);
      expect(result.value.resolvedKind).toBe('text');
    }
  });

  it('AC #13: rejects confidence out of range (1.5)', () => {
    const bad = { ...VALID_RESPONSE, confidence: 1.5 };
    const result = parseGeminiResolution(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('MALFORMED_RESPONSE');
  });

  it('AC #13: rejects negative confidence', () => {
    const bad = { ...VALID_RESPONSE, confidence: -0.1 };
    const result = parseGeminiResolution(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });

  it('AC #14: rejects missing required field (confidence)', () => {
    const { confidence: _drop, ...bad } = VALID_RESPONSE;
    const result = parseGeminiResolution(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('MALFORMED_RESPONSE');
  });

  it('AC #14: rejects unknown resolvedKind', () => {
    const bad = { ...VALID_RESPONSE, resolvedKind: 'pancake' };
    const result = parseGeminiResolution(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });

  it('AC #15: parses markdown-wrapped JSON', () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(VALID_RESPONSE)}\n\`\`\``;
    const result = parseGeminiResolution(wrapped);
    expect(result.ok).toBe(true);
  });

  it('AC #16: rejects plain non-JSON text', () => {
    const result = parseGeminiResolution('I think this is a button, but I am not sure.');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('MALFORMED_RESPONSE');
  });

  it('accepts shape resolution with cornerRadiusPx', () => {
    const shape = {
      confidence: 0.92,
      resolvedKind: 'shape',
      text: null,
      fillColor: '#FF0000',
      shapeKind: 'rounded-rect',
      cornerRadiusPx: 8,
      reasoning: 'rounded corners visible',
    };
    const result = parseGeminiResolution(JSON.stringify(shape));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.cornerRadiusPx).toBe(8);
  });
});
