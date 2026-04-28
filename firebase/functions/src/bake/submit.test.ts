// firebase/functions/src/bake/submit.test.ts
// T-265 — Cloud Function adapter tests. The pure handler is exhaustively
// tested in @stageflip/runtimes-blender; here we cover the adapter glue:
// descriptor validation, region resolution, error translation.

import {
  type BakeQueueProducer,
  type BullQueueLike,
  type SubmitRegionRouter,
  computeInputsHash,
} from '@stageflip/runtimes-blender';
import { describe, expect, it, vi } from 'vitest';

import type { CallerContext, DocRefLike, DocSnapLike, FirestoreLike } from '../auth/types.js';
import { type BakeSubmitDeps, submitBakeJobAdapter } from './submit.js';

const SCENE = { template: 'fluid-sim', params: {} };
const DURATION = { durationMs: 1000, fps: 30 };
const HASH = computeInputsHash({ scene: SCENE, duration: DURATION });

const VALID_DESCRIPTOR = {
  id: 'el_blend1',
  transform: { x: 0, y: 0, width: 1280, height: 720 },
  type: 'blender-clip',
  scene: SCENE,
  duration: DURATION,
  inputsHash: HASH,
};

function makeFirestore(orgRegion: string | undefined, orgExists = true): FirestoreLike {
  const snap: DocSnapLike = {
    exists: orgExists,
    id: 'o1',
    data: () => (orgRegion === undefined ? {} : { region: orgRegion }),
  };
  const doc: DocRefLike = {
    id: 'o1',
    path: 'orgs/o1',
    get: async () => snap,
    set: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
  };
  return {
    doc: () => doc,
    collection: () => ({
      doc: () => doc,
      add: async () => doc,
    }),
  };
}

function makeDeps(opts: { region: 'us' | 'eu' | undefined } = { region: 'us' }): {
  deps: BakeSubmitDeps;
  queueAdd: ReturnType<typeof vi.fn>;
  consumeSpy: ReturnType<typeof vi.fn>;
} {
  const consumeSpy = vi.fn(async () => ({ allowed: true as const }));
  const queueAdd = vi.fn(async () => ({ id: 'job_1' }));
  const queue: BullQueueLike = { add: queueAdd };
  const producer: BakeQueueProducer = {
    enqueue: async (payload) => {
      const r = await queue.add('bake', payload);
      return r.id ?? '';
    },
  } as unknown as BakeQueueProducer;
  const router: SubmitRegionRouter = {
    reader: () => ({
      bucketName: 'us-bucket',
      async getText() {
        return null;
      },
      publicUrl: (p) => `https://us-bucket/${p}`,
    }),
    outputBucket: (r) => (r === 'eu' ? 'eu-bucket' : 'us-bucket'),
  };
  const deps: BakeSubmitDeps = {
    firestore: makeFirestore(opts.region),
    limiter: { consume: consumeSpy },
    producer,
    router,
    clock: () => 0,
    newBakeId: () => 'b1',
  };
  return { deps, queueAdd, consumeSpy };
}

const CALLER: CallerContext = { uid: 'u1', orgId: 'o1', role: 'editor' };

describe('submitBakeJobAdapter — boundary validation', () => {
  it('rejects an unauthenticated caller', async () => {
    const { deps } = makeDeps();
    await expect(
      submitBakeJobAdapter(
        deps,
        { uid: '', orgId: 'o1', role: 'editor' },
        {
          clipDescriptor: VALID_DESCRIPTOR,
        },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('rejects a caller without active org', async () => {
    const { deps } = makeDeps();
    await expect(
      submitBakeJobAdapter(
        deps,
        { uid: 'u1', orgId: undefined, role: 'editor' },
        {
          clipDescriptor: VALID_DESCRIPTOR,
        },
      ),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
  it('rejects an invalid clipDescriptor with code "invalid-argument"', async () => {
    const { deps } = makeDeps();
    await expect(
      submitBakeJobAdapter(deps, CALLER, { clipDescriptor: { type: 'blender-clip' } }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('submitBakeJobAdapter — region resolution (T-265 AC #13)', () => {
  it('reads region from the org doc and forwards to the handler', async () => {
    const { deps, queueAdd } = makeDeps({ region: 'eu' });
    await submitBakeJobAdapter(deps, CALLER, { clipDescriptor: VALID_DESCRIPTOR });
    const call = queueAdd.mock.calls[0];
    if (!call) throw new Error('expected queue.add to be called');
    const payload = call[1] as { region: string; outputBucket: string };
    expect(payload.region).toBe('eu');
    expect(payload.outputBucket).toBe('eu-bucket');
  });
  it('defaults to "us" when org doc has no region (T-271 AC #13)', async () => {
    const { deps, queueAdd } = makeDeps({ region: undefined });
    await submitBakeJobAdapter(deps, CALLER, { clipDescriptor: VALID_DESCRIPTOR });
    const call = queueAdd.mock.calls[0];
    if (!call) throw new Error('expected queue.add to be called');
    const payload = call[1] as { region: string };
    expect(payload.region).toBe('us');
  });
});

describe('submitBakeJobAdapter — happy path', () => {
  it('returns "pending" + bakeId on a fresh submission', async () => {
    const { deps } = makeDeps();
    const out = await submitBakeJobAdapter(deps, CALLER, { clipDescriptor: VALID_DESCRIPTOR });
    expect(out.status).toBe('pending');
    expect(out.inputsHash).toBe(HASH);
  });
});

describe('submitBakeJobAdapter — error translation', () => {
  it('translates SubmitError to CallableError with same code', async () => {
    const { deps } = makeDeps();
    // Force a hash mismatch by submitting a descriptor whose inputsHash is wrong.
    const bad = { ...VALID_DESCRIPTOR, inputsHash: 'b'.repeat(64) };
    await expect(submitBakeJobAdapter(deps, CALLER, { clipDescriptor: bad })).rejects.toMatchObject(
      { code: 'inputs-hash-mismatch' },
    );
  });
});
