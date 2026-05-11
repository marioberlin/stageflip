// packages/storage/src/tenant-adapter-credentials.test.ts
// Schema tests for adapterCredentialSchema + adapterCredentialsMapSchema (T-444).

import { describe, expect, it } from 'vitest';

import {
  adapterCredentialSchema,
  adapterCredentialsMapSchema,
} from './tenant-adapter-credentials.js';

describe('adapterCredentialSchema', () => {
  it('accepts apiKey-only', () => {
    expect(adapterCredentialSchema.parse({ apiKey: 'sk-abc' })).toEqual({ apiKey: 'sk-abc' });
  });

  it('accepts baseUrl-only', () => {
    expect(adapterCredentialSchema.parse({ baseUrl: 'https://api.example/v1' })).toEqual({
      baseUrl: 'https://api.example/v1',
    });
  });

  it('accepts apiKey + baseUrl together', () => {
    expect(adapterCredentialSchema.parse({ apiKey: 'sk', baseUrl: 'https://api.example' })).toEqual(
      { apiKey: 'sk', baseUrl: 'https://api.example' },
    );
  });

  it('rejects empty {}', () => {
    expect(() => adapterCredentialSchema.parse({})).toThrow(/at least one of/);
  });

  it('rejects empty apiKey string', () => {
    expect(() => adapterCredentialSchema.parse({ apiKey: '' })).toThrow();
  });

  it('rejects non-URL baseUrl', () => {
    expect(() => adapterCredentialSchema.parse({ baseUrl: 'not-a-url' })).toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() => adapterCredentialSchema.parse({ apiKey: 'sk', extra: 'x' })).toThrow();
  });
});

describe('adapterCredentialsMapSchema', () => {
  it('accepts an empty record', () => {
    expect(adapterCredentialsMapSchema.parse({})).toEqual({});
  });

  it('accepts a populated record keyed by kebab-case adapter ids', () => {
    const v = {
      'tts-kokoro': { apiKey: 'sk-a' },
      'video-runway': { baseUrl: 'https://runway.example' },
    };
    expect(adapterCredentialsMapSchema.parse(v)).toEqual(v);
  });

  it('rejects non-kebab-case keys', () => {
    expect(() => adapterCredentialsMapSchema.parse({ 'TTS-Kokoro': { apiKey: 'sk' } })).toThrow();
    expect(() => adapterCredentialsMapSchema.parse({ tts_kokoro: { apiKey: 'sk' } })).toThrow();
  });

  it('rejects an empty credential value in the record', () => {
    expect(() => adapterCredentialsMapSchema.parse({ kokoro: {} })).toThrow();
  });
});
