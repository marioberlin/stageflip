// packages/schema/src/clips/interactive/voice-props.test.ts
// T-387 ACs #1–#3 — voiceClipPropsSchema parsing.
// T-388 ACs #1–#3 — `posterText?` field shape (optional, non-empty).

import { describe, expect, it } from 'vitest';

import { voiceClipPropsSchema } from './voice-props.js';

describe('voiceClipPropsSchema (T-387 AC #1)', () => {
  it('AC #1 — accepts a complete voice-props payload', () => {
    const parsed = voiceClipPropsSchema.parse({
      mimeType: 'audio/webm;codecs=opus',
      maxDurationMs: 30_000,
      partialTranscripts: false,
      language: 'de-DE',
      posterFrame: 12,
    });
    expect(parsed.mimeType).toBe('audio/webm;codecs=opus');
    expect(parsed.maxDurationMs).toBe(30_000);
    expect(parsed.partialTranscripts).toBe(false);
    expect(parsed.language).toBe('de-DE');
    expect(parsed.posterFrame).toBe(12);
  });

  it('AC #1 — defaults populate when fields omitted', () => {
    const parsed = voiceClipPropsSchema.parse({});
    expect(parsed.mimeType).toBe('audio/webm');
    expect(parsed.maxDurationMs).toBe(60_000);
    expect(parsed.partialTranscripts).toBe(true);
    expect(parsed.language).toBe('en-US');
    expect(parsed.posterFrame).toBe(0);
  });

  it('AC #2 — maxDurationMs of 0 throws', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        maxDurationMs: 0,
      }),
    ).toThrow(/maxDurationMs/);
  });

  it('AC #2 — negative maxDurationMs throws', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        maxDurationMs: -1,
      }),
    ).toThrow(/maxDurationMs/);
  });

  it('AC #2 — non-integer maxDurationMs throws', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        maxDurationMs: 1.5,
      }),
    ).toThrow();
  });

  it('AC #3 — empty language throws', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        language: '',
      }),
    ).toThrow(/language/);
  });

  it('rejects empty mimeType', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        mimeType: '',
      }),
    ).toThrow(/mimeType/);
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        sneaky: true,
      }),
    ).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        posterFrame: -1,
      }),
    ).toThrow();
  });

  it('rejects non-boolean partialTranscripts', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        partialTranscripts: 'yes',
      }),
    ).toThrow();
  });

  // ----- T-388 — posterText slot -----

  it('T-388 AC #1 — accepts a non-empty posterText string', () => {
    const parsed = voiceClipPropsSchema.parse({
      posterText: 'Tap to speak',
    });
    expect(parsed.posterText).toBe('Tap to speak');
  });

  it('T-388 AC #2 — empty posterText throws', () => {
    expect(() =>
      voiceClipPropsSchema.parse({
        posterText: '',
      }),
    ).toThrow(/posterText/);
  });

  it('T-388 AC #3 — payload without posterText still validates (T-387 backward-compat)', () => {
    const parsed = voiceClipPropsSchema.parse({
      mimeType: 'audio/webm',
      maxDurationMs: 30_000,
      partialTranscripts: true,
      language: 'en-US',
      posterFrame: 0,
    });
    expect(parsed.posterText).toBeUndefined();
  });

  it('T-388 — posterText is optional even with all other defaults populated', () => {
    const parsed = voiceClipPropsSchema.parse({});
    expect(parsed.posterText).toBeUndefined();
  });
});
