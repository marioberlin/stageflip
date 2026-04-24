// packages/export-html5-zip/src/click-tag.test.ts
// T-203a — clickTag injector tests.

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CLICK_TAG_PLACEHOLDER,
  clickTagScript,
  escapeClickTagForScript,
  injectClickTagScript,
} from './click-tag.js';

const EMPTY_HEAD = '<!doctype html><html><head></head><body></body></html>';

describe('escapeClickTagForScript', () => {
  it('passes through URLs unchanged', () => {
    expect(escapeClickTagForScript('https://example.com')).toBe('https://example.com');
  });

  it('escapes embedded double quotes', () => {
    expect(escapeClickTagForScript('ab"cd')).toBe('ab\\"cd');
  });

  it('escapes backslashes', () => {
    expect(escapeClickTagForScript('a\\b')).toBe('a\\\\b');
  });

  it('escapes newlines and carriage returns', () => {
    expect(escapeClickTagForScript('a\nb\rc')).toBe('a\\nb\\rc');
  });

  it('rejects an empty string', () => {
    expect(() => escapeClickTagForScript('')).toThrow(/must not be empty/);
  });

  it('rejects a </script sequence', () => {
    expect(() => escapeClickTagForScript('a</script>b')).toThrow(/<\/script/);
  });

  it('accepts the IAB default placeholder', () => {
    expect(escapeClickTagForScript(DEFAULT_CLICK_TAG_PLACEHOLDER)).toBe(
      DEFAULT_CLICK_TAG_PLACEHOLDER,
    );
  });
});

describe('clickTagScript', () => {
  it('declares clickTag at window scope', () => {
    const script = clickTagScript('https://example.com');
    expect(script).toContain('var clickTag = "https://example.com"');
    expect(script).toContain('window.clickTag = clickTag');
  });

  it('wraps in a stageflip marker comment for idempotency', () => {
    expect(clickTagScript('x')).toContain('<!-- stageflip-click-tag -->');
  });

  it('opens + closes a <script> block', () => {
    const script = clickTagScript('x');
    expect(script).toContain('<script>');
    expect(script).toContain('</script>');
  });
});

describe('injectClickTagScript', () => {
  it('inserts the script immediately after <head>', () => {
    const out = injectClickTagScript(EMPTY_HEAD, 'https://example.com');
    const headIdx = out.indexOf('<head>');
    const scriptIdx = out.indexOf('<script>');
    expect(headIdx).toBeGreaterThanOrEqual(0);
    expect(scriptIdx).toBeGreaterThan(headIdx);
    expect(out).toContain('var clickTag = "https://example.com"');
  });

  it('handles <head> with attributes', () => {
    const input = '<!doctype html><html><head lang="en"></head><body></body></html>';
    const out = injectClickTagScript(input, 'https://example.com');
    expect(out).toContain('<head lang="en">');
    expect(out).toContain('var clickTag = "https://example.com"');
  });

  it('is idempotent — re-injecting replaces the existing script', () => {
    const once = injectClickTagScript(EMPTY_HEAD, 'https://first.example');
    const twice = injectClickTagScript(once, 'https://second.example');
    expect(twice).not.toContain('first.example');
    expect(twice).toContain('second.example');
    // Only one marker comment should remain.
    expect(twice.split('<!-- stageflip-click-tag -->').length).toBe(2);
  });

  it('throws when no <head> is present', () => {
    const input = '<!doctype html><html><body></body></html>';
    expect(() => injectClickTagScript(input, 'x')).toThrow(/no <head>/);
  });

  it('throws when the marker is present but no closing </script> follows', () => {
    const broken = '<!-- stageflip-click-tag -->\n<script>var clickTag = "x";';
    expect(() => injectClickTagScript(broken, 'y')).toThrow(/no closing <\/script>/);
  });

  it('escapes unsafe values in the output', () => {
    const out = injectClickTagScript(EMPTY_HEAD, 'https://example.com/"bad"');
    expect(out).toContain('\\"bad\\"');
    expect(out).not.toContain('"bad"');
  });
});
