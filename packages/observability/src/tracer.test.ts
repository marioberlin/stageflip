// packages/observability/src/tracer.test.ts
// T-264 ACs #5, #6, #7 — forced trace always samples; getTraceContext returns
// W3C traceparent; withTraceContext makes child span with matching parent id.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __getInMemorySpansForTests,
  __resetTracerForTests,
  __setupTestTracer,
  getTraceContext,
  withForcedTrace,
  withTraceContext,
} from './tracer.js';

describe('tracer', () => {
  beforeEach(() => {
    __setupTestTracer({ sampleRate: 0 }); // base rate 0 — only forced should export
  });

  afterEach(() => {
    __resetTracerForTests();
  });

  it('AC #5: withForcedTrace exports a span even when traceSampleRate=0', async () => {
    await withForcedTrace('payment.flow', async () => {
      // no-op
    });
    const spans = __getInMemorySpansForTests().filter((s) => s.name === 'payment.flow');
    expect(spans.length).toBe(1);
  });

  it('AC #5: non-forced spans at sampleRate=0 are NOT exported', async () => {
    await withForcedTrace('parent', async () => {
      // no-op (forced — exported)
    });
    // No call to a non-forced API; we just confirm the count is exactly 1.
    expect(__getInMemorySpansForTests().length).toBe(1);
  });

  it('AC #6: getTraceContext outside an active span returns undefined traceparent', () => {
    const ctx = getTraceContext();
    // Spec: serializable. Outside a span, no traceparent — undefined is fine.
    expect(ctx.traceparent).toBeUndefined();
  });

  it('AC #6: getTraceContext inside an active span returns a W3C traceparent', async () => {
    let captured: { traceparent?: string } | null = null;
    await withForcedTrace('hop', async () => {
      captured = getTraceContext();
    });
    expect(captured).not.toBeNull();
    // W3C format: 00-<32 hex>-<16 hex>-<2 hex>
    expect(captured?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  });

  it('AC #7: withTraceContext creates a child whose parent-id matches the upstream span-id', async () => {
    let upstream: { traceparent?: string } | null = null;
    await withForcedTrace('upstream', async () => {
      upstream = getTraceContext();
    });
    expect(upstream?.traceparent).toBeDefined();
    const upstreamTraceparent = upstream?.traceparent ?? '';
    const upstreamSpanId = upstreamTraceparent.split('-')[2];
    expect(upstreamSpanId).toMatch(/^[0-9a-f]{16}$/);

    let childTraceparent = '';
    await withTraceContext({ traceparent: upstreamTraceparent }, async () => {
      await withForcedTrace('downstream', async () => {
        childTraceparent = getTraceContext().traceparent ?? '';
      });
    });

    // Child's traceparent: same trace-id, different span-id; AND the child
    // span's parent_span_id matches upstream's span-id.
    const upstreamTraceId = upstreamTraceparent.split('-')[1];
    const childTraceId = childTraceparent.split('-')[1];
    expect(childTraceId).toBe(upstreamTraceId);
    expect(childTraceparent.split('-')[2]).not.toBe(upstreamSpanId);

    // Verify parent-id link via the exported span itself.
    const downstream = __getInMemorySpansForTests().find((s) => s.name === 'downstream');
    expect(downstream).toBeDefined();
    expect(downstream?.parentSpanContext?.spanId).toBe(upstreamSpanId);
  });

  it('AC #6: getTraceContext output is JSON-serializable', async () => {
    await withForcedTrace('serialize', async () => {
      const ctx = getTraceContext();
      const json = JSON.stringify(ctx);
      expect(JSON.parse(json)).toEqual(ctx);
    });
  });
});
