// packages/pack-publish-cli/src/commands/license-templates.test.ts
// T-501 — Unit tests for the substituter + the four template entries.

import { describe, expect, it } from 'vitest';

import { parsePackManifest } from '@stageflip/pack-format';

import {
  TEMPLATES,
  TIER_IDS,
  type TierId,
  renderManifestSnippet,
  substitute,
} from './license-templates.js';

const ALL_VARS: Record<string, string> = {
  packName: 'Demo Pack',
  publisherDisplayName: 'Demo Org',
  contactEmail: 'demo@example.com',
  year: '2026',
  sku: 'demo-sku',
  spdx: 'Apache-2.0',
};

/** Build a minimal valid manifest with a given license object embedded. */
function manifestWith(license: Record<string, unknown>): Record<string, unknown> {
  return {
    manifestVersion: '1',
    id: 'demo',
    name: 'demo',
    version: '1.0.0',
    publisher: { id: 'pub-1', displayName: 'Pub 1' },
    platformCompatibility: '^2.0.0',
    license,
    integrity: { algorithm: 'sha256', hash: '0'.repeat(64) },
    contributes: {},
  };
}

describe('TIER_IDS', () => {
  it('exposes exactly the four canonical tier IDs', () => {
    expect(TIER_IDS).toEqual([
      'commercial-subscription',
      'attribution-required',
      'non-commercial-only',
      'public-domain',
    ]);
    expect(TIER_IDS).toHaveLength(4);
  });
});

describe('TEMPLATES', () => {
  it('every tier exposes license markdown, notice markdown, and a manifest snippet', () => {
    for (const tier of TIER_IDS) {
      const t = TEMPLATES[tier];
      expect(typeof t.licenseMarkdown).toBe('string');
      expect(t.licenseMarkdown.length).toBeGreaterThan(50);
      expect(typeof t.noticeMarkdown).toBe('string');
      expect(t.noticeMarkdown.length).toBeGreaterThan(50);
      expect(typeof t.manifestSnippet).toBe('object');
      expect(t.manifestSnippet).not.toBeNull();
    }
  });

  it("every tier's manifest snippet parses inside a full manifest", () => {
    for (const tier of TIER_IDS) {
      const snippet = renderManifestSnippet(tier, ALL_VARS);
      const manifest = manifestWith(snippet);
      // Should NOT throw.
      const parsed = parsePackManifest(manifest);
      expect(parsed.license).toBeDefined();
    }
  });

  it.each<TierId>([
    'commercial-subscription',
    'attribution-required',
    'non-commercial-only',
    'public-domain',
  ])('LICENSE.md for tier %s contains its expected SPDX line', (tier) => {
    const rendered = substitute(TEMPLATES[tier].licenseMarkdown, ALL_VARS);
    expect(rendered).toContain(`SPDX-License-Identifier: ${TEMPLATES[tier].spdxOrLicenseRef}`);
  });

  it('commercial-subscription snippet has paid-per-tenant kind + substituted sku', () => {
    const snippet = renderManifestSnippet('commercial-subscription', {
      ...ALL_VARS,
      sku: 'my-cool-sku',
    });
    expect(snippet.kind).toBe('paid-per-tenant');
    expect(snippet.sku).toBe('my-cool-sku');
    expect(snippet.entitlementType).toBe('subscription');
  });

  it('attribution-required snippet is open + Apache-2.0', () => {
    const snippet = renderManifestSnippet('attribution-required', ALL_VARS);
    expect(snippet).toEqual({ kind: 'open', spdx: 'Apache-2.0' });
  });

  it('non-commercial-only snippet is open + CC-BY-4.0', () => {
    const snippet = renderManifestSnippet('non-commercial-only', ALL_VARS);
    expect(snippet).toEqual({ kind: 'open', spdx: 'CC-BY-4.0' });
  });

  it('public-domain snippet is open + CC0-1.0', () => {
    const snippet = renderManifestSnippet('public-domain', ALL_VARS);
    expect(snippet).toEqual({ kind: 'open', spdx: 'CC0-1.0' });
  });
});

describe('substitute', () => {
  it('replaces a single {{key}} with the supplied value', () => {
    expect(substitute('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  it('replaces repeated occurrences of the same key', () => {
    expect(substitute('{{x}}-{{x}}-{{x}}', { x: 'a' })).toBe('a-a-a');
  });

  it('replaces multiple distinct keys', () => {
    expect(substitute('{{a}} and {{b}}', { a: 'one', b: 'two' })).toBe('one and two');
  });

  it('throws with the missing key name in the message when a placeholder has no value', () => {
    expect(() => substitute('hello {{missing}}', { other: 'x' })).toThrowError(/missing/);
  });

  it('does not modify text outside {{...}} placeholders', () => {
    const tmpl = 'literal text { not a } placeholder; {{key}} is.';
    expect(substitute(tmpl, { key: 'OK' })).toBe('literal text { not a } placeholder; OK is.');
  });

  it('treats single { or } as literal (no replacement)', () => {
    expect(substitute('{x} {{x}} }x{', { x: 'Y' })).toBe('{x} Y }x{');
  });

  it('handles an empty template', () => {
    expect(substitute('', {})).toBe('');
  });

  it('handles a template with no placeholders', () => {
    expect(substitute('plain text', { unused: 'value' })).toBe('plain text');
  });
});
