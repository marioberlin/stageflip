// packages/engine/src/handlers/asset-generation/handlers.test.ts
// T-423 — `asset-generation` agent-tool tests covering the dispatch shell:
// happy-path generation, soft-seam absent / no-adapter / no-licensed /
// all-failed error paths, list_adapters, get_adapter_capabilities,
// determinism + cache-key parity with @stageflip/asset-cache.

import { AdapterRegistry, type LicenseGate, type TenantContext } from '@stageflip/adapters-core';
import { cacheKeyString, deriveCacheKey } from '@stageflip/asset-cache';
import { mediaProvenanceSchema } from '@stageflip/schema';
import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import {
  ASSET_GENERATION_HANDLERS,
  type AdapterUsageEventLike,
  type AssetGenerationContext,
  type CostTrackerStoreLike,
  type ExecuteAdapterCallInput,
  type ExecuteAdapterCallResult,
  type PlaceholderDispatchInput,
  type PlaceholderResolver,
  type TenantSettingsStoreLike,
  type UsageTelemetryReaderLike,
} from './handlers.js';

function collectingSink(): PatchSink & { drain(): JsonPatchOp[] } {
  const queue: JsonPatchOp[] = [];
  return {
    push(op) {
      queue.push(op);
    },
    pushAll(ops) {
      for (const op of ops) queue.push(op);
    },
    drain() {
      const out = queue.slice();
      queue.length = 0;
      return out;
    },
  };
}

function makeDoc(): Document {
  return {
    meta: {
      id: 'doc-asset-gen',
      version: 1,
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [{ id: 'slide-1', elements: [] }],
    },
  } as unknown as Document;
}

function makeVideoDoc(): Document {
  return {
    meta: {
      id: 'doc-video',
      version: 1,
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'video',
      tracks: [],
    },
  } as unknown as Document;
}

const allowAllGate: LicenseGate = {
  evaluate: () => 'allow',
};
const denyAllGate: LicenseGate = {
  evaluate: () => 'deny',
};
const tenantContext: TenantContext = { licensePosture: 'permit-all' };

function fakeRegistryWithTtsAdapter(adapterId = 'tts-fake'): AdapterRegistry {
  const r = new AdapterRegistry();
  r.register({
    id: adapterId,
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
  });
  return r;
}

function makeCtx(opts: {
  document?: Document;
  registry?: AdapterRegistry;
  gate?: LicenseGate;
  tenant?: TenantContext;
  executeAdapterCall?: (input: ExecuteAdapterCallInput) => Promise<ExecuteAdapterCallResult>;
  placeholderResolver?: PlaceholderResolver;
  randomUuid?: () => string;
  nowMs?: () => number;
  costTrackerStore?: CostTrackerStoreLike;
  tenantSettingsStore?: TenantSettingsStoreLike;
  tenantId?: string;
  usageTelemetryReader?: UsageTelemetryReaderLike;
}): AssetGenerationContext & { patchSink: ReturnType<typeof collectingSink> } {
  return {
    document: opts.document ?? makeDoc(),
    patchSink: collectingSink(),
    ...(opts.registry !== undefined ? { adapterRegistry: opts.registry } : {}),
    ...(opts.gate !== undefined ? { licenseGate: opts.gate } : {}),
    ...(opts.tenant !== undefined ? { tenantContext: opts.tenant } : {}),
    ...(opts.executeAdapterCall !== undefined
      ? { executeAdapterCall: opts.executeAdapterCall }
      : {}),
    ...(opts.placeholderResolver !== undefined
      ? { placeholderResolver: opts.placeholderResolver }
      : {}),
    ...(opts.randomUuid !== undefined ? { randomUuid: opts.randomUuid } : {}),
    ...(opts.nowMs !== undefined ? { nowMs: opts.nowMs } : {}),
    ...(opts.costTrackerStore !== undefined ? { costTrackerStore: opts.costTrackerStore } : {}),
    ...(opts.tenantSettingsStore !== undefined
      ? { tenantSettingsStore: opts.tenantSettingsStore }
      : {}),
    ...(opts.tenantId !== undefined ? { tenantId: opts.tenantId } : {}),
    ...(opts.usageTelemetryReader !== undefined
      ? { usageTelemetryReader: opts.usageTelemetryReader }
      : {}),
  };
}

function find(name: string) {
  const h = ASSET_GENERATION_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

const validTarget = {
  slideId: 'slide-1',
  elementType: 'audio' as const,
  transform: { x: 0, y: 0, width: 320, height: 64 },
  src: 'asset:tts-output-1',
};

const validInput = {
  modality: 'tts' as const,
  prompt: '  Hello, World!  ',
  model: 'kokoro-82m',
  voice: 'lib-female-en-1',
  params: { sampleRate: 24000 },
  seed: 7,
  target: validTarget,
};

describe('generate_asset — happy path', () => {
  it('returns ok:true with provenance + cacheKey, emits a JSON-Patch add op', async () => {
    const recorded: Array<{ adapterId: string; cacheKey: string }> = [];
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async (input) => {
        recorded.push({ adapterId: input.adapter.id, cacheKey: input.cacheKey });
        return { ok: true };
      },
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      slideId: string;
      elementId: string;
      cacheKey: string;
      provenance: Record<string, unknown>;
    };
    expect(r.ok).toBe(true);
    expect(r.slideId).toBe('slide-1');
    expect(r.elementId).toMatch(/^el-\d+$/);
    expect(r.cacheKey).toMatch(/^tts\/[0-9a-f]{64}$/);

    // Provenance passes the strict schema.
    const parsed = mediaProvenanceSchema.parse(r.provenance);
    expect(parsed.kind).toBe('tts');
    expect(parsed.provider).toBe('tts-fake');
    expect(parsed.model).toBe('kokoro-82m');
    expect(parsed.cacheKey).toBe(r.cacheKey);
    // Prompt is normalized (trim + collapse + lowercase + NFC).
    expect(parsed.prompt).toBe('hello, world!');
    expect(parsed.voiceId).toBe('lib-female-en-1');
    expect(parsed.seed).toBe(7);

    // Patch sink saw an `add` op against the right slide path.
    const ops = ctx.patchSink.drain();
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op?.op).toBe('add');
    expect(op?.path).toBe('/content/slides/0/elements/-');
    const value = op?.value as Record<string, unknown>;
    expect(value.type).toBe('audio');
    expect(value.id).toBe(r.elementId);
    expect(value.src).toBe('asset:tts-output-1');
    expect((value.provenance as Record<string, unknown>).kind).toBe('tts');

    // Adapter executor saw a single call with the same cacheKey.
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.adapterId).toBe('tts-fake');
    expect(recorded[0]?.cacheKey).toBe(r.cacheKey);
  });

  it('cacheKey matches deriveCacheKey + cacheKeyString exactly', async () => {
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      cacheKey: string;
    };
    const expected = cacheKeyString(
      await deriveCacheKey({
        modality: 'tts',
        model: 'kokoro-82m',
        voice: 'lib-female-en-1',
        prompt: '  Hello, World!  ',
        params: { sampleRate: 24000 },
        seed: 7,
      }),
    );
    expect(r.cacheKey).toBe(expected);
  });

  it('image modality emits an image element', async () => {
    const ctx = makeCtx({
      registry: (() => {
        const r = new AdapterRegistry();
        r.register({
          id: 'img-fake',
          modality: { kind: 'infographic-gen' },
          capability: {},
          license: { kind: 'apache-2.0' },
          sandbox: { kind: 'in-process' },
        });
        return r;
      })(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(
      {
        modality: 'infographic-gen',
        prompt: 'a colorful chart',
        target: {
          slideId: 'slide-1',
          elementType: 'image',
          transform: { x: 0, y: 0, width: 800, height: 600 },
          src: 'asset:img-1',
        },
      },
      ctx as MutationContext,
    )) as { ok: true; provenance: { kind: string }; cacheKey: string };
    expect(r.ok).toBe(true);
    expect(r.provenance.kind).toBe('image-gen');
    expect(r.cacheKey).toMatch(/^infographic-gen\/[0-9a-f]{64}$/);
    const op = ctx.patchSink.drain()[0];
    const value = op?.value as Record<string, unknown>;
    expect(value.type).toBe('image');
  });

  it('researchSessionId is forwarded into provenance', async () => {
    const ctx = makeCtx({
      registry: (() => {
        const r = new AdapterRegistry();
        r.register({
          id: 'video-grounded',
          modality: { kind: 'video-gen' },
          capability: {},
          license: { kind: 'mit' },
          sandbox: { kind: 'in-process' },
        });
        return r;
      })(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(
      {
        modality: 'video-gen',
        prompt: 'sunrise',
        researchSessionId: 'rs-42',
        target: {
          slideId: 'slide-1',
          elementType: 'video',
          transform: { x: 0, y: 0, width: 1920, height: 1080 },
          src: 'asset:vid-1',
        },
      },
      ctx as MutationContext,
    )) as { ok: true; provenance: Record<string, unknown> };
    expect(r.provenance.researchSessionId).toBe('rs-42');
  });
});

describe('generate_asset — error paths', () => {
  it('returns asset_generation_unavailable when seam is absent', async () => {
    const ctx: AssetGenerationContext & { patchSink: PatchSink } = {
      document: makeDoc(),
      patchSink: collectingSink(),
    };
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('asset_generation_unavailable');
  });

  it('returns no_adapter_for_modality when registry is empty for the modality', async () => {
    const ctx = makeCtx({
      registry: new AdapterRegistry(), // no adapters
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_adapter_for_modality');
  });

  it('returns no_licensed_adapter when the gate denies every candidate', async () => {
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: denyAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_licensed_adapter');
  });

  it('returns all_adapters_failed when every executor call rejects', async () => {
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => {
        throw new Error('upstream-down');
      },
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: false;
      reason: string;
      errors?: ReadonlyArray<{ adapterId: string; errorMessage: string }>;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('all_adapters_failed');
    expect(r.errors?.length).toBeGreaterThan(0);
    expect(r.errors?.[0]?.adapterId).toBe('tts-fake');
    expect(r.errors?.[0]?.errorMessage).toBe('upstream-down');
  });

  it('returns wrong_mode when the document is not slide-mode', async () => {
    const ctx = makeCtx({
      document: makeVideoDoc(),
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('wrong_mode');
  });

  it('returns slide_not_found when target.slideId does not exist', async () => {
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, target: { ...validTarget, slideId: 'slide-missing' } },
      ctx as MutationContext,
    )) as { ok: false; reason: string };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('slide_not_found');
  });

  it('schema rejects non-asset-producing modalities + extras + bad enum', () => {
    const tool = find('generate_asset');
    expect(() => tool.inputSchema.parse({ ...validInput, modality: 'research-session' })).toThrow();
    expect(() => tool.inputSchema.parse({ ...validInput, modality: 'audience-backend' })).toThrow();
    expect(() => tool.inputSchema.parse({ ...validInput, modality: 'bundle' })).toThrow();
    expect(() => tool.inputSchema.parse({ ...validInput, rogue: 'x' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        ...validInput,
        target: { ...validTarget, src: 'http://example.com/notanasset' },
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({ ...validInput, target: { ...validTarget, elementType: 'text' } }),
    ).toThrow();
  });
});

describe('list_adapters', () => {
  it('returns empty list when seam is wired but registry empty', async () => {
    const ctx = makeCtx({ registry: new AdapterRegistry() });
    const r = (await find('list_adapters').handle({}, ctx as MutationContext)) as {
      ok: true;
      adapters: ReadonlyArray<unknown>;
    };
    expect(r.ok).toBe(true);
    expect(r.adapters).toEqual([]);
  });

  it('returns the adapter list filtered by modality', async () => {
    const ctx = makeCtx({ registry: fakeRegistryWithTtsAdapter() });
    const r = (await find('list_adapters').handle({ modality: 'tts' }, ctx as MutationContext)) as {
      ok: true;
      adapters: ReadonlyArray<{ id: string }>;
    };
    expect(r.ok).toBe(true);
    expect(r.adapters).toHaveLength(1);
    expect(r.adapters[0]?.id).toBe('tts-fake');

    const r2 = (await find('list_adapters').handle(
      { modality: 'video-gen' },
      ctx as MutationContext,
    )) as { ok: true; adapters: ReadonlyArray<unknown> };
    expect(r2.adapters).toEqual([]);
  });

  it('returns asset_generation_unavailable when seam absent', async () => {
    const ctx: AssetGenerationContext & { patchSink: PatchSink } = {
      document: makeDoc(),
      patchSink: collectingSink(),
    };
    const r = (await find('list_adapters').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('asset_generation_unavailable');
  });
});

describe('get_adapter_capabilities', () => {
  it('returns the descriptor for a registered adapter', async () => {
    const ctx = makeCtx({ registry: fakeRegistryWithTtsAdapter() });
    const r = (await find('get_adapter_capabilities').handle(
      { modality: 'tts', adapterId: 'tts-fake' },
      ctx as MutationContext,
    )) as { ok: true; descriptor: { id: string; modality: { kind: string } } };
    expect(r.ok).toBe(true);
    expect(r.descriptor.id).toBe('tts-fake');
    expect(r.descriptor.modality.kind).toBe('tts');
  });

  it('returns not_found for an unknown adapter', async () => {
    const ctx = makeCtx({ registry: fakeRegistryWithTtsAdapter() });
    const r = (await find('get_adapter_capabilities').handle(
      { modality: 'tts', adapterId: 'tts-other' },
      ctx as MutationContext,
    )) as { ok: false; reason: string };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_found');
  });

  it('returns asset_generation_unavailable when seam absent', async () => {
    const ctx: AssetGenerationContext & { patchSink: PatchSink } = {
      document: makeDoc(),
      patchSink: collectingSink(),
    };
    const r = (await find('get_adapter_capabilities').handle(
      { modality: 'tts', adapterId: 'tts-fake' },
      ctx as MutationContext,
    )) as { ok: false; reason: string };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('asset_generation_unavailable');
  });
});

describe('barrel + invariants', () => {
  it('handlers array length is 5', () => {
    // T-423: 3 tools; T-443: +query_cost_budget (4); T-445: +query_usage_telemetry (5).
    expect(ASSET_GENERATION_HANDLERS.length).toBe(5);
  });

  it('every handler declares bundle === "asset-generation"', () => {
    for (const h of ASSET_GENERATION_HANDLERS) {
      expect(h.bundle).toBe('asset-generation');
    }
  });

  it('determinism — same input twice yields equal cache key + provenance', async () => {
    const factory = (): AssetGenerationContext & { patchSink: PatchSink } =>
      makeCtx({
        registry: fakeRegistryWithTtsAdapter(),
        gate: allowAllGate,
        tenant: tenantContext,
        executeAdapterCall: async () => ({ ok: true }),
      });
    const a = (await find('generate_asset').handle(validInput, factory() as MutationContext)) as {
      ok: true;
      cacheKey: string;
      provenance: Record<string, unknown>;
    };
    const b = (await find('generate_asset').handle(validInput, factory() as MutationContext)) as {
      ok: true;
      cacheKey: string;
      provenance: Record<string, unknown>;
    };
    expect(a.cacheKey).toBe(b.cacheKey);
    // elementId differs because element ids are doc-position-derived and the
    // factory builds a fresh empty doc each time, so both produce 'el-1'.
    expect(a.provenance.cacheKey).toBe(b.provenance.cacheKey);
  });
});

// ---------------------------------------------------------------------------
// T-438 — optimistic-placeholder path
// ---------------------------------------------------------------------------

function fakeResolver(): PlaceholderResolver & {
  calls: PlaceholderDispatchInput[];
  resolveNext: () => void;
} {
  const calls: PlaceholderDispatchInput[] = [];
  let resolveDeferred: (() => void) | null = null;
  const deferred = new Promise<void>((res) => {
    resolveDeferred = res;
  });
  return {
    calls,
    resolveNext: () => {
      if (resolveDeferred) resolveDeferred();
    },
    dispatch: async (input) => {
      calls.push(input);
      // Block until the test releases — verifies the handler does NOT await.
      await deferred;
    },
  };
}

describe('generate_asset — T-438 optimistic placeholder path', () => {
  it('returns asset_generation_unavailable when placeholderResolver seam absent', async () => {
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      // No placeholderResolver wired.
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as { ok: false; reason: string; detail?: string };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('asset_generation_unavailable');
    expect(r.detail).toContain('placeholderResolver');
  });

  it('returns placeholder shape immediately and emits an asset-gen-pending element', async () => {
    const resolver = fakeResolver();
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: resolver,
      randomUuid: () => 'deadbeef-1234-5678-9abc-def012345678',
      nowMs: () => Date.parse('2026-05-11T00:00:00.000Z'),
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as {
      ok: true;
      kind: 'placeholder';
      slideId: string;
      elementId: string;
      placeholderId: string;
      modality: string;
      cacheKey: string;
      estimatedCompletionAt?: string;
    };
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('placeholder');
    expect(r.slideId).toBe('slide-1');
    expect(r.elementId).toMatch(/^el-\d+$/);
    expect(r.placeholderId).toBe('ph-deadbeef-1234-5678-9abc-def012345678');
    expect(r.modality).toBe('tts');
    expect(r.cacheKey).toMatch(/^tts\/[0-9a-f]{64}$/);
    // Falls back to per-modality default (tts: 5s).
    expect(r.estimatedCompletionAt).toBe('2026-05-11T00:00:05.000Z');

    // Patch-sink saw one `add` op with pending provenance.
    const ops = ctx.patchSink.drain();
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op?.op).toBe('add');
    expect(op?.path).toBe('/content/slides/0/elements/-');
    const value = op?.value as Record<string, unknown>;
    const provenance = value.provenance as Record<string, unknown>;
    expect(provenance.kind).toBe('asset-gen-pending');
    expect(provenance.placeholderId).toBe('ph-deadbeef-1234-5678-9abc-def012345678');
    expect(provenance.cacheKey).toBe(r.cacheKey);
    expect(provenance.provider).toBe('tts-fake');
    expect(provenance.estimatedCompletionAt).toBe('2026-05-11T00:00:05.000Z');
  });

  it('invokes placeholderResolver.dispatch with the licensed adapter list and cacheKey', async () => {
    const resolver = fakeResolver();
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: resolver,
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as { ok: true; cacheKey: string; placeholderId: string };

    // The dispatch ran in the background — give the microtask queue a turn.
    await Promise.resolve();
    expect(resolver.calls).toHaveLength(1);
    const call = resolver.calls[0];
    if (!call) throw new Error('expected dispatch call');
    expect(call.placeholderId).toBe(r.placeholderId);
    expect(call.cacheKey).toBe(r.cacheKey);
    expect(call.modality).toBe('tts');
    expect(call.licensed).toHaveLength(1);
    expect(call.licensed[0]?.id).toBe('tts-fake');
    expect(call.target.slideId).toBe('slide-1');
    expect(call.target.elementType).toBe('audio');
    expect(call.target.src).toBe('asset:tts-output-1');

    // Now release the dispatch so the test doesn't leak an open promise.
    resolver.resolveNext();
  });

  it('does NOT await the placeholderResolver.dispatch continuation', async () => {
    // The fake resolver's dispatch awaits a deferred that we never release;
    // if the handler awaited it, this `handle` call would hang. The
    // assertion is implicit: the call resolves.
    const resolver = fakeResolver();
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: resolver,
    });
    const start = Date.now();
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as { ok: true; kind: 'placeholder' };
    const elapsed = Date.now() - start;
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('placeholder');
    expect(elapsed).toBeLessThan(500); // sanity check: not blocked on dispatch
    resolver.resolveNext();
  });

  it('seam-dispatch failures do not raise unhandled rejections on the handler', async () => {
    // A resolver that throws synchronously inside dispatch.
    const rejecting: PlaceholderResolver = {
      dispatch: () => Promise.reject(new Error('boom')),
    };
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: rejecting,
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as { ok: true; kind: 'placeholder' };
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('placeholder');
    // Give the rejection a turn — should be swallowed by the .catch.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('estimatedCompletionAt derived from adapter latencyMs.p95 when present', async () => {
    const r0 = new AdapterRegistry();
    r0.register({
      id: 'tts-slow',
      modality: { kind: 'tts' },
      capability: {},
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      latencyMs: { p50: 1_000, p95: 7_500 },
    });
    const resolver = fakeResolver();
    const ctx = makeCtx({
      registry: r0,
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: resolver,
      nowMs: () => Date.parse('2026-05-11T00:00:00.000Z'),
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as { ok: true; estimatedCompletionAt?: string };
    // 7500ms from epoch base.
    expect(r.estimatedCompletionAt).toBe('2026-05-11T00:00:07.500Z');
    resolver.resolveNext();
  });

  it('back-compat: omitting optimistic runs the synchronous path identically', async () => {
    const recorded: Array<{ adapterId: string }> = [];
    const resolver = fakeResolver(); // wired but should NOT be used
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: resolver,
      executeAdapterCall: async (input) => {
        recorded.push({ adapterId: input.adapter.id });
        return { ok: true };
      },
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      kind?: string;
      provenance: { kind: string };
    };
    expect(r.ok).toBe(true);
    expect(r.kind).toBeUndefined(); // sync path doesn't return `kind`
    expect(r.provenance.kind).toBe('tts'); // not 'asset-gen-pending'
    expect(recorded).toHaveLength(1);
    // Resolver was wired but NOT called.
    expect(resolver.calls).toHaveLength(0);
  });

  it('placeholder slideId is the input.target.slideId; mounts on the right slide', async () => {
    const resolver = fakeResolver();
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      placeholderResolver: resolver,
    });
    const r = (await find('generate_asset').handle(
      { ...validInput, optimistic: true },
      ctx as MutationContext,
    )) as { ok: true; slideId: string };
    expect(r.slideId).toBe('slide-1');
    resolver.resolveNext();
  });
});

// ---------------------------------------------------------------------------
// T-443 — cost-budget surfacing
// ---------------------------------------------------------------------------

interface FakeCostTracker extends CostTrackerStoreLike {
  records: Array<{
    tenantId: string;
    adapterId: string;
    amount: number;
    currency: string;
    recordedAt: string;
  }>;
  preset: number;
}

function fakeCostTracker(presetTotal = 0): FakeCostTracker {
  const records: FakeCostTracker['records'] = [];
  const tracker: FakeCostTracker = {
    records,
    preset: presetTotal,
    recordCost: async (r) => {
      records.push({ ...r });
    },
    getPeriodTotal: async (tenantId, _start, _end) => {
      // Reflect any records pushed in addition to preset.
      const live = records
        .filter((rec) => rec.tenantId === tenantId)
        .reduce((sum, rec) => sum + rec.amount, 0);
      return presetTotal + live;
    },
  };
  return tracker;
}

function fakeSettingsStore(aiBudget?: {
  monthlyAmount: number;
  currency: string;
  periodEnd: string;
}): TenantSettingsStoreLike {
  return {
    getTenantSettings: async (_tenantId: string) => {
      return aiBudget === undefined ? { aiBudget: undefined } : { aiBudget };
    },
  };
}

function adapterWithCost(id: string, usd: number): AdapterRegistry {
  const r = new AdapterRegistry();
  r.register({
    id,
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
    costPerCall: { usd },
  });
  return r;
}

describe('generate_asset — T-443 cost-budget envelope', () => {
  it('omits costBudget when no soft seams are wired (back-compat)', async () => {
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: unknown;
    };
    expect(r.ok).toBe(true);
    expect(r.costBudget).toBeUndefined();
  });

  it('omits costBudget when tenantId is absent (host has no multi-tenant)', async () => {
    const tracker = fakeCostTracker();
    const settings = fakeSettingsStore({
      monthlyAmount: 10,
      currency: 'USD',
      periodEnd: '2026-06-01T00:00:00.000Z',
    });
    const ctx = makeCtx({
      registry: fakeRegistryWithTtsAdapter(),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
      costTrackerStore: tracker,
      tenantSettingsStore: settings,
      // No tenantId.
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: unknown;
    };
    expect(r.costBudget).toBeUndefined();
    expect(tracker.records).toHaveLength(0);
  });

  it('records the chosen adapter cost AND surfaces costBudget when both seams + tenantId wired', async () => {
    const tracker = fakeCostTracker();
    const settings = fakeSettingsStore({
      monthlyAmount: 10,
      currency: 'USD',
      periodEnd: '2026-06-01T00:00:00.000Z',
    });
    const ctx = makeCtx({
      registry: adapterWithCost('expensive-tts', 1.5),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
      costTrackerStore: tracker,
      tenantSettingsStore: settings,
      tenantId: 'tenant-1',
      nowMs: () => Date.parse('2026-05-15T00:00:00.000Z'),
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: {
        costIncurred: { adapterId: string; amount: number; currency: string };
        budgetRemaining?: { amount: number; currency: string; periodEndAt: string };
        budgetExhausted: boolean;
      };
    };
    expect(r.costBudget).toBeDefined();
    expect(r.costBudget?.costIncurred).toEqual({
      adapterId: 'expensive-tts',
      amount: 1.5,
      currency: 'USD',
    });
    expect(r.costBudget?.budgetRemaining).toEqual({
      amount: 8.5, // 10 - 1.5
      currency: 'USD',
      periodEndAt: '2026-06-01T00:00:00.000Z',
    });
    expect(r.costBudget?.budgetExhausted).toBe(false);

    // Tracker received one record for the chosen adapter.
    expect(tracker.records).toHaveLength(1);
    expect(tracker.records[0]).toEqual({
      tenantId: 'tenant-1',
      adapterId: 'expensive-tts',
      amount: 1.5,
      currency: 'USD',
      recordedAt: '2026-05-15T00:00:00.000Z',
    });
  });

  it('records a zero-amount line for adapters with costPerCall.usd === 0', async () => {
    const tracker = fakeCostTracker();
    const ctx = makeCtx({
      registry: adapterWithCost('free-tts', 0),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
      costTrackerStore: tracker,
      tenantId: 'tenant-1',
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: { costIncurred: { amount: number } };
    };
    expect(r.costBudget?.costIncurred.amount).toBe(0);
    expect(tracker.records[0]?.amount).toBe(0);
  });

  it('records cost without budgetRemaining when tenant has no aiBudget', async () => {
    const tracker = fakeCostTracker();
    const settings = fakeSettingsStore(undefined); // No aiBudget.
    const ctx = makeCtx({
      registry: adapterWithCost('tts-x', 0.5),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
      costTrackerStore: tracker,
      tenantSettingsStore: settings,
      tenantId: 'tenant-1',
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: {
        costIncurred: { amount: number };
        budgetRemaining?: unknown;
        budgetExhausted: boolean;
      };
    };
    expect(r.costBudget?.costIncurred.amount).toBe(0.5);
    expect(r.costBudget?.budgetRemaining).toBeUndefined();
    expect(r.costBudget?.budgetExhausted).toBe(false);
  });

  it('flags budgetExhausted=true when accumulated cost meets the budget', async () => {
    // Preset: 9.5 already spent; this call costs 0.5; total = 10 = budget.
    const tracker = fakeCostTracker(9.5);
    const settings = fakeSettingsStore({
      monthlyAmount: 10,
      currency: 'USD',
      periodEnd: '2026-06-01T00:00:00.000Z',
    });
    const ctx = makeCtx({
      registry: adapterWithCost('tts-x', 0.5),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
      costTrackerStore: tracker,
      tenantSettingsStore: settings,
      tenantId: 'tenant-1',
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: { budgetRemaining?: { amount: number }; budgetExhausted: boolean };
    };
    expect(r.costBudget?.budgetRemaining?.amount).toBe(0);
    expect(r.costBudget?.budgetExhausted).toBe(true);
  });

  it('flags budgetExhausted=true when remaining goes negative (overshoot)', async () => {
    const tracker = fakeCostTracker(11);
    const settings = fakeSettingsStore({
      monthlyAmount: 10,
      currency: 'USD',
      periodEnd: '2026-06-01T00:00:00.000Z',
    });
    const ctx = makeCtx({
      registry: adapterWithCost('tts-x', 0.5),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => ({ ok: true }),
      costTrackerStore: tracker,
      tenantSettingsStore: settings,
      tenantId: 'tenant-1',
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: true;
      costBudget?: { budgetRemaining?: { amount: number }; budgetExhausted: boolean };
    };
    expect(r.costBudget?.budgetRemaining?.amount).toBeLessThan(0);
    expect(r.costBudget?.budgetExhausted).toBe(true);
  });

  it('does NOT record cost when the fallback chain exhausts (all adapters fail)', async () => {
    const tracker = fakeCostTracker();
    const ctx = makeCtx({
      registry: adapterWithCost('tts-x', 1),
      gate: allowAllGate,
      tenant: tenantContext,
      executeAdapterCall: async () => {
        throw new Error('boom');
      },
      costTrackerStore: tracker,
      tenantId: 'tenant-1',
    });
    const r = (await find('generate_asset').handle(validInput, ctx as MutationContext)) as {
      ok: boolean;
      reason?: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('all_adapters_failed');
    expect(tracker.records).toHaveLength(0);
  });
});

describe('query_cost_budget — T-443', () => {
  it('returns cost_budget_unavailable when costTrackerStore is unwired', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      tenantSettingsStore: fakeSettingsStore({
        monthlyAmount: 10,
        currency: 'USD',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }),
      tenantId: 'tenant-1',
    });
    const r = (await find('query_cost_budget').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cost_budget_unavailable');
  });

  it('returns cost_budget_unavailable when tenantSettingsStore is unwired', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      costTrackerStore: fakeCostTracker(),
      tenantId: 'tenant-1',
    });
    const r = (await find('query_cost_budget').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cost_budget_unavailable');
  });

  it('returns cost_budget_unavailable when tenantId is absent', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      costTrackerStore: fakeCostTracker(),
      tenantSettingsStore: fakeSettingsStore({
        monthlyAmount: 10,
        currency: 'USD',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }),
    });
    const r = (await find('query_cost_budget').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cost_budget_unavailable');
  });

  it('returns no_budget_configured when settings exist but aiBudget is absent', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      costTrackerStore: fakeCostTracker(),
      tenantSettingsStore: fakeSettingsStore(undefined),
      tenantId: 'tenant-1',
    });
    const r = (await find('query_cost_budget').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_budget_configured');
  });

  it('returns the budget posture when seams + tenantId + aiBudget all present', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      costTrackerStore: fakeCostTracker(2.5),
      tenantSettingsStore: fakeSettingsStore({
        monthlyAmount: 10,
        currency: 'USD',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }),
      tenantId: 'tenant-1',
    });
    const r = (await find('query_cost_budget').handle({}, ctx as MutationContext)) as {
      ok: true;
      budget: {
        monthlyAmount: number;
        currency: string;
        periodEndAt: string;
        used: number;
        remaining: number;
        exhausted: boolean;
      };
    };
    expect(r.ok).toBe(true);
    expect(r.budget.monthlyAmount).toBe(10);
    expect(r.budget.currency).toBe('USD');
    expect(r.budget.periodEndAt).toBe('2026-06-01T00:00:00.000Z');
    expect(r.budget.used).toBe(2.5);
    expect(r.budget.remaining).toBe(7.5);
    expect(r.budget.exhausted).toBe(false);
  });

  it('flags exhausted=true when used >= monthlyAmount', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      costTrackerStore: fakeCostTracker(10),
      tenantSettingsStore: fakeSettingsStore({
        monthlyAmount: 10,
        currency: 'USD',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }),
      tenantId: 'tenant-1',
    });
    const r = (await find('query_cost_budget').handle({}, ctx as MutationContext)) as {
      ok: true;
      budget: { exhausted: boolean; remaining: number };
    };
    expect(r.budget.remaining).toBe(0);
    expect(r.budget.exhausted).toBe(true);
  });

  it('emits no patch ops (pure read)', async () => {
    const ctx = makeCtx({
      tenant: tenantContext,
      costTrackerStore: fakeCostTracker(2.5),
      tenantSettingsStore: fakeSettingsStore({
        monthlyAmount: 10,
        currency: 'USD',
        periodEnd: '2026-06-01T00:00:00.000Z',
      }),
      tenantId: 'tenant-1',
    });
    await find('query_cost_budget').handle({}, ctx as MutationContext);
    expect(ctx.patchSink.drain()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// query_usage_telemetry — T-445
// ---------------------------------------------------------------------------

function makeUsageEvent(over: Partial<AdapterUsageEventLike> = {}): AdapterUsageEventLike {
  return {
    tenantId: 'tenant-1',
    adapterId: 'kokoro-tts',
    modality: 'tts',
    selectedReason: 'capability-router',
    latencyMs: 200,
    costAmount: 0,
    costCurrency: 'USD',
    outcome: 'success',
    timestamp: '2026-05-11T12:00:00.000Z',
    ...over,
  };
}

function fakeUsageReader(events: readonly AdapterUsageEventLike[]): UsageTelemetryReaderLike {
  return {
    eventsForTenant(tenantId: string) {
      return events.filter((e) => e.tenantId === tenantId);
    },
  };
}

describe('query_usage_telemetry — T-445', () => {
  it('returns usage_telemetry_unavailable when reader seam absent', async () => {
    const ctx = makeCtx({ tenantId: 'tenant-1' });
    const r = (await find('query_usage_telemetry').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('usage_telemetry_unavailable');
  });

  it('returns usage_telemetry_unavailable when tenantId absent', async () => {
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader([]),
    });
    const r = (await find('query_usage_telemetry').handle({}, ctx as MutationContext)) as {
      ok: false;
      reason: string;
    };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('usage_telemetry_unavailable');
  });

  it('returns empty rollups when no events', async () => {
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader([]),
      tenantId: 'tenant-1',
      nowMs: () => new Date('2026-05-11T12:00:00.000Z').getTime(),
    });
    const r = (await find('query_usage_telemetry').handle({}, ctx as MutationContext)) as {
      ok: true;
      rollups: unknown[];
      sinceTimestamp: string;
      untilTimestamp: string;
    };
    expect(r.ok).toBe(true);
    expect(r.rollups).toEqual([]);
    expect(r.untilTimestamp).toBe('2026-05-11T12:00:00.000Z');
    // 7 days back from until.
    expect(r.sinceTimestamp).toBe('2026-05-04T12:00:00.000Z');
  });

  it('rolls up events into per-(adapterId, modality) buckets', async () => {
    const events = [
      makeUsageEvent({ latencyMs: 100, costAmount: 0.01 }),
      makeUsageEvent({ latencyMs: 200, costAmount: 0.02, outcome: 'failed' }),
      makeUsageEvent({ adapterId: 'fish-speech', latencyMs: 300 }),
    ];
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader(events),
      tenantId: 'tenant-1',
      nowMs: () => new Date('2026-05-11T23:00:00.000Z').getTime(),
    });
    const r = (await find('query_usage_telemetry').handle({}, ctx as MutationContext)) as {
      ok: true;
      rollups: Array<{
        adapterId: string;
        count: number;
        successCount: number;
        failedCount: number;
        totalCostAmount: number;
      }>;
    };
    expect(r.ok).toBe(true);
    expect(r.rollups.length).toBe(2);
    const byId = new Map(r.rollups.map((x) => [x.adapterId, x]));
    expect(byId.get('kokoro-tts')?.count).toBe(2);
    expect(byId.get('kokoro-tts')?.successCount).toBe(1);
    expect(byId.get('kokoro-tts')?.failedCount).toBe(1);
    expect(byId.get('kokoro-tts')?.totalCostAmount).toBeCloseTo(0.03, 10);
    expect(byId.get('fish-speech')?.count).toBe(1);
  });

  it('filters by adapterId', async () => {
    const events = [
      makeUsageEvent({ adapterId: 'kokoro-tts' }),
      makeUsageEvent({ adapterId: 'fish-speech' }),
    ];
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader(events),
      tenantId: 'tenant-1',
      nowMs: () => new Date('2026-05-11T23:00:00.000Z').getTime(),
    });
    const r = (await find('query_usage_telemetry').handle(
      { adapterId: 'kokoro-tts' },
      ctx as MutationContext,
    )) as { ok: true; rollups: Array<{ adapterId: string }> };
    expect(r.rollups.length).toBe(1);
    expect(r.rollups[0]?.adapterId).toBe('kokoro-tts');
  });

  it("isolates tenants — reader only returns the calling tenant's events", async () => {
    const events = [
      makeUsageEvent({ tenantId: 'tenant-1', costAmount: 0.01 }),
      makeUsageEvent({ tenantId: 'tenant-2', costAmount: 99 }),
    ];
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader(events),
      tenantId: 'tenant-1',
      nowMs: () => new Date('2026-05-11T23:00:00.000Z').getTime(),
    });
    const r = (await find('query_usage_telemetry').handle({}, ctx as MutationContext)) as {
      ok: true;
      rollups: Array<{ totalCostAmount: number }>;
    };
    expect(r.rollups.length).toBe(1);
    expect(r.rollups[0]?.totalCostAmount).toBe(0.01);
  });

  it('respects explicit since/until timestamps', async () => {
    const events = [
      makeUsageEvent({ timestamp: '2026-05-01T00:00:00.000Z' }), // out
      makeUsageEvent({ timestamp: '2026-05-05T00:00:00.000Z' }), // in
      makeUsageEvent({ timestamp: '2026-05-10T00:00:00.000Z' }), // out (exclusive end)
    ];
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader(events),
      tenantId: 'tenant-1',
    });
    const r = (await find('query_usage_telemetry').handle(
      {
        sinceTimestamp: '2026-05-04T00:00:00.000Z',
        untilTimestamp: '2026-05-10T00:00:00.000Z',
      },
      ctx as MutationContext,
    )) as { ok: true; rollups: Array<{ count: number }> };
    expect(r.rollups[0]?.count).toBe(1);
  });

  it('emits no patch ops (pure read)', async () => {
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader([makeUsageEvent()]),
      tenantId: 'tenant-1',
      nowMs: () => new Date('2026-05-11T23:00:00.000Z').getTime(),
    });
    await find('query_usage_telemetry').handle({}, ctx as MutationContext);
    expect(ctx.patchSink.drain()).toEqual([]);
  });

  it('all three outcome counts surface separately', async () => {
    const events = [
      makeUsageEvent({ outcome: 'success' }),
      makeUsageEvent({ outcome: 'success' }),
      makeUsageEvent({ outcome: 'failed' }),
      makeUsageEvent({ outcome: 'killed' }),
    ];
    const ctx = makeCtx({
      usageTelemetryReader: fakeUsageReader(events),
      tenantId: 'tenant-1',
      nowMs: () => new Date('2026-05-11T23:00:00.000Z').getTime(),
    });
    const r = (await find('query_usage_telemetry').handle({}, ctx as MutationContext)) as {
      ok: true;
      rollups: Array<{ successCount: number; failedCount: number; killedCount: number }>;
    };
    expect(r.rollups[0]?.successCount).toBe(2);
    expect(r.rollups[0]?.failedCount).toBe(1);
    expect(r.rollups[0]?.killedCount).toBe(1);
  });
});
