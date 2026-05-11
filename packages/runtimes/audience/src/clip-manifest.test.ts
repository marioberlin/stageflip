// packages/runtimes/audience/src/clip-manifest.test.ts
// T-455 — type-level + structural tests for `AudienceClipManifest`. The
// literal-tuple typing on `permissions` is the first line of defence;
// `scripts/check-audience-permissions.ts` is the second (static source
// scan at CI time). These tests assert the shape contracts at the type
// system + runtime levels.

import { describe, expect, it } from 'vitest';

import type { AudienceClipManifest } from './clip-manifest.js';

describe('AudienceClipManifest', () => {
  it("accepts a manifest with exactly `permissions: ['audience-network']`", () => {
    const manifest: AudienceClipManifest = {
      kind: 'live-poll-multiple-choice',
      permissions: ['audience-network'],
    };
    expect(manifest.kind).toBe('live-poll-multiple-choice');
    expect(manifest.permissions).toEqual(['audience-network']);
    expect(manifest.permissions.length).toBe(1);
  });

  it('rejects extra permissions at the type level (compile-time assertion)', () => {
    // @ts-expect-error — `permissions` is `readonly ['audience-network']`;
    // a two-entry tuple is structurally incompatible (length mismatch).
    const _wide: AudienceClipManifest = {
      kind: 'live-poll-multiple-choice',
      permissions: ['audience-network', 'microphone'],
    };
    expect(_wide.permissions[0]).toBe('audience-network');
  });

  it('rejects a different permission scope at the type level', () => {
    // @ts-expect-error — `'network'` is not assignable to the literal
    // tuple element `'audience-network'`.
    const _wrong: AudienceClipManifest = {
      kind: 'live-poll-multiple-choice',
      permissions: ['network'],
    };
    expect(_wrong.permissions[0]).toBe('network');
  });

  it('rejects an empty permissions tuple at the type level', () => {
    // @ts-expect-error — empty tuple lacks the required `'audience-network'`
    // entry (length mismatch with the literal tuple type).
    const _empty: AudienceClipManifest = {
      kind: 'live-poll-multiple-choice',
      permissions: [],
    };
    expect(_empty.permissions.length).toBe(0);
  });

  it('rejects a non-audience clip kind at the type level', () => {
    // @ts-expect-error — `'lower-third'` is not a member of the
    // `AudienceClipKind` union (T-452 / ADR-010 §D2).
    const _kind: AudienceClipManifest = {
      kind: 'lower-third',
      permissions: ['audience-network'],
    };
    expect(_kind.kind).toBe('lower-third');
  });

  it('accepts every `AudienceClipKind` discriminant', () => {
    // Spread across all 11 kinds per ADR-010 §D2; the array is the
    // exhaustive list of valid `kind` values.
    const kinds = [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
      'heatmap',
      'reaction-stream',
      'audience-ai-prompt',
    ] as const;
    for (const kind of kinds) {
      const manifest: AudienceClipManifest = {
        kind,
        permissions: ['audience-network'],
      };
      expect(manifest.kind).toBe(kind);
      expect(manifest.permissions).toEqual(['audience-network']);
    }
  });
});
