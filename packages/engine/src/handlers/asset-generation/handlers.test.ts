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
  type AssetGenerationContext,
  type ExecuteAdapterCallInput,
  type ExecuteAdapterCallResult,
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
  it('handlers array length is 3', () => {
    expect(ASSET_GENERATION_HANDLERS.length).toBe(3);
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
