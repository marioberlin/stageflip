// packages/export-video/src/multi-aspect.test.ts
// T-186 — exportMultiAspectInParallel: per-variant outcomes, collect-all
// error handling, concurrency cap, abort-signal propagation.

import type { Document } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';

import { exportMultiAspectInParallel } from './multi-aspect.js';
import type { VariantRenderer, VariantTarget } from './types.js';

const fakeDocument = { meta: { id: 'doc' }, content: { mode: 'video' } } as unknown as Document;

const targets: VariantTarget[] = [
  { label: '16:9', aspectRatio: '16:9', width: 1920, height: 1080 },
  { label: '9:16', aspectRatio: '9:16', width: 1080, height: 1920 },
  { label: '1:1', aspectRatio: '1:1', width: 1080, height: 1080 },
];

function makeRenderer(
  behavior: (variant: VariantTarget) => Promise<Uint8Array> = async () => new Uint8Array([0]),
): VariantRenderer {
  return {
    id: 'fake-renderer',
    async render({ variant }) {
      const bytes = await behavior(variant);
      return {
        variant,
        mimeType: 'video/mp4',
        bytes,
        durationMs: 10,
      };
    },
  };
}

describe('exportMultiAspectInParallel', () => {
  it('renders every variant and returns outcomes in input order', async () => {
    const renderer = makeRenderer();
    const result = await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: targets,
      renderer,
    });
    expect(result.rendererId).toBe('fake-renderer');
    expect(result.okCount).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(result.outcomes.map((o) => (o.ok ? o.output.variant.label : 'fail'))).toEqual([
      '16:9',
      '9:16',
      '1:1',
    ]);
  });

  it('returns collect-all outcomes when one variant fails', async () => {
    const renderer = makeRenderer(async (variant) => {
      if (variant.label === '9:16') throw new Error('codec not supported');
      return new Uint8Array([0]);
    });
    const result = await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: targets,
      renderer,
    });
    expect(result.okCount).toBe(2);
    expect(result.errorCount).toBe(1);
    const failed = result.outcomes[1];
    expect(failed?.ok).toBe(false);
    if (failed?.ok === false) {
      expect(failed.variant.label).toBe('9:16');
      expect(failed.error.message).toBe('codec not supported');
    }
  });

  it('runs in parallel up to the concurrency cap', async () => {
    let running = 0;
    let peak = 0;
    const renderer: VariantRenderer = {
      id: 'observing',
      async render({ variant }) {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 10));
        running -= 1;
        return { variant, mimeType: 'video/mp4', bytes: new Uint8Array(), durationMs: 10 };
      },
    };
    await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: [...targets, ...targets], // 6 tasks
      renderer,
      concurrency: 2,
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });

  it('defaults concurrency to 3', async () => {
    let running = 0;
    let peak = 0;
    const renderer: VariantRenderer = {
      id: 'observing',
      async render({ variant }) {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 10));
        running -= 1;
        return { variant, mimeType: 'video/mp4', bytes: new Uint8Array(), durationMs: 10 };
      },
    };
    await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: [...targets, ...targets, ...targets], // 9 tasks
      renderer,
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('propagates the abort signal to every renderer call', async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const renderer: VariantRenderer = {
      id: 'observing',
      async render({ variant, signal }) {
        signals.push(signal);
        return { variant, mimeType: 'video/mp4', bytes: new Uint8Array(), durationMs: 10 };
      },
    };
    const controller = new AbortController();
    await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: targets,
      renderer,
      signal: controller.signal,
    });
    expect(signals.every((s) => s === controller.signal)).toBe(true);
  });

  it('returns empty outcomes + zero counts for no variants', async () => {
    const renderer = makeRenderer();
    const spy = vi.spyOn(renderer, 'render');
    const result = await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: [],
      renderer,
    });
    expect(result.outcomes).toEqual([]);
    expect(result.okCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('normalises non-Error throws into Error instances', async () => {
    const renderer: VariantRenderer = {
      id: 'throwy',
      render() {
        return Promise.reject('string-error');
      },
    };
    const result = await exportMultiAspectInParallel({
      document: fakeDocument,
      variants: [targets[0] as VariantTarget],
      renderer,
    });
    const outcome = result.outcomes[0];
    expect(outcome?.ok).toBe(false);
    if (outcome?.ok === false) {
      expect(outcome.error).toBeInstanceOf(Error);
      expect(outcome.error.message).toBe('string-error');
    }
  });
});
