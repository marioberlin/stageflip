// packages/render-farm/src/in-memory.test.ts
// InMemoryRenderFarmAdapter tests (T-266 ACs #3–#8, #14–#16).
//
// Test seam: we inject a stub spawn function that returns a fake ChildProcess
// — an EventEmitter with stdout/stderr streams we drive synchronously. This
// keeps the suite hermetic (no actual subprocess) while exercising the same
// state-transition + log-parsing code paths the real spawn would.

import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

import { context as otelContext, propagation, trace } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AlwaysOnSampler,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RenderFarmJob } from './contract.js';
import { InMemoryRenderFarmAdapter, type SpawnFn } from './in-memory.js';
import { buildFinishedMarker, buildStartedMarker } from './state-markers.js';

/** Build a minimal RenderFarmJob fixture. */
function makeJob(overrides: Partial<RenderFarmJob> = {}): RenderFarmJob {
  return {
    bakeId: 'bake-1',
    image: '/path/to/worker.js',
    resources: { cpu: 1, memoryGB: 1, gpu: 'cpu-only' },
    env: { REDIS_URL: 'redis://localhost' },
    ...overrides,
  };
}

/** A fake ChildProcess controllable from tests. */
interface FakeChild extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  kill(signal?: string): boolean;
  killed: boolean;
  /** Emit a stdout line followed by `\n`. */
  emitStdout(line: string): void;
  /** Trigger exit with given code/signal. */
  emitExit(code: number | null, signal?: string | null): void;
}

function createFakeChild(): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  ee.stdout = stdout;
  ee.stderr = stderr;
  ee.killed = false;
  ee.kill = vi.fn(function kill(this: FakeChild, _signal?: string): boolean {
    this.killed = true;
    return true;
  });
  ee.emitStdout = (line: string) => {
    stdout.push(`${line}\n`);
  };
  ee.emitExit = (code: number | null, signal: string | null = null) => {
    stdout.push(null);
    stderr.push(null);
    ee.emit('exit', code, signal);
  };
  return ee;
}

/** Yield to the event loop so queued stdout `data` events are dispatched. */
async function tick(): Promise<void> {
  await new Promise((r) => setImmediate(r));
}

/** Build a SpawnFn that yields a queue of fake children. */
function queuedSpawn(children: FakeChild[]): SpawnFn {
  let i = 0;
  return () => {
    const c = children[i++];
    if (c === undefined) throw new Error('queuedSpawn: out of children');
    return c as unknown as ReturnType<SpawnFn>;
  };
}

/* OTel provider bookkeeping — installed once per test. */
let provider: NodeTracerProvider | null = null;
let exporter: InMemorySpanExporter | null = null;

function installTestTracer(): void {
  uninstallTestTracer();
  exporter = new InMemorySpanExporter();
  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'test' }),
    sampler: new AlwaysOnSampler(),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register();
}

function uninstallTestTracer(): void {
  if (provider !== null) {
    void provider.shutdown();
    provider = null;
  }
  exporter = null;
  trace.disable();
  propagation.disable();
  otelContext.disable();
}

function recordedSpans(): readonly ReadableSpan[] {
  return exporter?.getFinishedSpans() ?? [];
}

describe('InMemoryRenderFarmAdapter', () => {
  beforeEach(() => {
    installTestTracer();
  });
  afterEach(() => {
    uninstallTestTracer();
  });

  describe('AC #7: capabilities', () => {
    it('reports the documented shape', () => {
      const a = new InMemoryRenderFarmAdapter();
      expect(a.capabilities).toEqual({
        streamingLogs: true,
        gpuTypes: ['cpu-only'],
        fastScaleUp: true,
        maxConcurrentJobs: 4,
      });
    });

    it('honours a custom maxConcurrentJobs', () => {
      const a = new InMemoryRenderFarmAdapter({ maxConcurrentJobs: 2 });
      expect(a.capabilities.maxConcurrentJobs).toBe(2);
    });

    it('rejects invalid maxConcurrentJobs', () => {
      expect(() => new InMemoryRenderFarmAdapter({ maxConcurrentJobs: 0 })).toThrow();
      expect(() => new InMemoryRenderFarmAdapter({ maxConcurrentJobs: 1.5 })).toThrow();
      expect(() => new InMemoryRenderFarmAdapter({ maxConcurrentJobs: -1 })).toThrow();
    });
  });

  describe('AC #3 + #4: submitJob / getJobStatus lifecycle', () => {
    it('returns a jobId immediately and reports running, then succeeded', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());

      // Spawn → running.
      const running = await a.getJobStatus(jobId);
      expect(running.state).toBe('running');
      expect(running.startedAt).toBeDefined();
      expect(running.finishedAt).toBeUndefined();

      // Worker emits markers and exits cleanly.
      child.emitStdout(buildStartedMarker('bake-1'));
      child.emitStdout('rendering frame 0');
      child.emitStdout(buildFinishedMarker({ bakeId: 'bake-1', status: 'succeeded' }));
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);

      const done = await a.getJobStatus(jobId);
      expect(done.state).toBe('succeeded');
      expect(done.finishedAt).toBeDefined();
      expect(done.error).toBeUndefined();
    });

    it('non-zero exit transitions to failed', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.emitExit(1);
      await a.whenDone(jobId);
      const status = await a.getJobStatus(jobId);
      expect(status.state).toBe('failed');
      expect(status.error).toMatch(/exited with code 1/);
    });

    it('process exit code 0 always wins over a failed marker (markers are advisory)', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.emitStdout(
        buildFinishedMarker({ bakeId: 'bake-1', status: 'failed', error: 'invoker bug' }),
      );
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);
      const status = await a.getJobStatus(jobId);
      // Document actual semantics: process exit code wins. The marker error is
      // captured in the log buffer but the final state is succeeded.
      expect(status.state).toBe('succeeded');
    });

    it('throws RenderFarmJobNotFoundError for an unknown jobId', async () => {
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([]) });
      await expect(a.getJobStatus('nope')).rejects.toThrow(/job not found/);
    });
  });

  describe('AC #5: cancelJob', () => {
    it('SIGTERMs a running child and reports canceled', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      await a.cancelJob(jobId);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      // Now simulate the child responding to the signal.
      child.emitExit(null, 'SIGTERM');
      await a.whenDone(jobId);
      const status = await a.getJobStatus(jobId);
      expect(status.state).toBe('canceled');
    });

    it('queued (un-spawned) jobs cancel immediately without spawn', async () => {
      const child1 = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({
        maxConcurrentJobs: 1,
        spawn: queuedSpawn([child1]),
      });
      const { jobId: j1 } = await a.submitJob(makeJob({ bakeId: 'b1' }));
      const { jobId: j2 } = await a.submitJob(makeJob({ bakeId: 'b2' }));
      // j2 is queued — cancel before it ever spawns.
      await a.cancelJob(j2);
      const s2 = await a.getJobStatus(j2);
      expect(s2.state).toBe('canceled');
      // j1 still running.
      const s1 = await a.getJobStatus(j1);
      expect(s1.state).toBe('running');
    });

    it('cancel on terminal state is a no-op', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.emitExit(0);
      await a.whenDone(jobId);
      await a.cancelJob(jobId); // should not throw
      const status = await a.getJobStatus(jobId);
      expect(status.state).toBe('succeeded');
    });

    it('cancel on unknown jobId throws', async () => {
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([]) });
      await expect(a.cancelJob('nope')).rejects.toThrow(/job not found/);
    });
  });

  describe('AC #6: streamLogs', () => {
    it('yields stdout lines as they arrive', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      // Pre-emit some lines before the consumer subscribes — they should be replayed.
      child.emitStdout('line-1');
      // Yield the microtask so the data event handler runs.
      await new Promise((r) => setImmediate(r));

      const collected: string[] = [];
      const consumer = (async () => {
        for await (const line of a.streamLogs(jobId)) {
          collected.push(line);
          if (collected.length === 3) return;
        }
      })();

      // Drive more lines + exit.
      await new Promise((r) => setImmediate(r));
      child.emitStdout('line-2');
      child.emitStdout('line-3');
      await consumer;
      expect(collected).toEqual(['line-1', 'line-2', 'line-3']);
    });

    it('honours opts.signal for early termination', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      const ctrl = new AbortController();
      const collected: string[] = [];
      const consumer = (async () => {
        for await (const line of a.streamLogs(jobId, { signal: ctrl.signal })) {
          collected.push(line);
        }
      })();
      await new Promise((r) => setImmediate(r));
      child.emitStdout('keep');
      await new Promise((r) => setImmediate(r));
      ctrl.abort();
      await consumer;
      expect(collected).toContain('keep');
    });

    it('returns immediately if the job is already terminal', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.emitStdout('done-line');
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);
      const collected: string[] = [];
      for await (const line of a.streamLogs(jobId)) collected.push(line);
      expect(collected).toEqual(['done-line']);
    });

    it('streamLogs on unknown job throws', async () => {
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([]) });
      await expect(async () => {
        for await (const _l of a.streamLogs('nope')) {
          /* unreachable */
        }
      }).rejects.toThrow(/job not found/);
    });
  });

  describe('AC #8: concurrency limit', () => {
    it('queues the 5th job when 4 are running; promotes when one finishes', async () => {
      const children = [
        createFakeChild(),
        createFakeChild(),
        createFakeChild(),
        createFakeChild(),
        createFakeChild(),
      ];
      const a = new InMemoryRenderFarmAdapter({
        maxConcurrentJobs: 4,
        spawn: queuedSpawn(children),
      });
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const { jobId } = await a.submitJob(makeJob({ bakeId: `b${i}` }));
        ids.push(jobId);
      }
      // First four running, fifth queued.
      const states = await Promise.all(ids.map((id) => a.getJobStatus(id)));
      expect(states.slice(0, 4).every((s) => s.state === 'running')).toBe(true);
      expect(states[4]?.state).toBe('queued');

      // Finish job 0 — that should promote job 4.
      const c0 = children[0];
      if (!c0) throw new Error('test fixture');
      c0.emitExit(0);
      await a.whenDone(ids[0] ?? '');
      // Allow microtask for promotion.
      await new Promise((r) => setImmediate(r));

      const fifth = await a.getJobStatus(ids[4] ?? '');
      expect(fifth.state).toBe('running');
    });

    it('promotion handles spawn failure of the next queued job', async () => {
      const child1 = createFakeChild();
      let i = 0;
      const a = new InMemoryRenderFarmAdapter({
        maxConcurrentJobs: 1,
        spawn: () => {
          if (i++ === 0) return child1 as unknown as ReturnType<SpawnFn>;
          throw new Error('spawn boom');
        },
      });
      const { jobId: j1 } = await a.submitJob(makeJob({ bakeId: 'b1' }));
      const { jobId: j2 } = await a.submitJob(makeJob({ bakeId: 'b2' }));
      // Finish j1 → adapter tries to spawn j2 and fails.
      child1.emitExit(0);
      await a.whenDone(j1);
      await new Promise((r) => setImmediate(r));
      const s2 = await a.getJobStatus(j2);
      expect(s2.state).toBe('failed');
      expect(s2.error).toMatch(/spawn boom/);
    });
  });

  describe('spawn-time errors', () => {
    it('records failure and rethrows when spawn throws synchronously', async () => {
      const a = new InMemoryRenderFarmAdapter({
        spawn: () => {
          throw new Error('eaccess');
        },
      });
      await expect(a.submitJob(makeJob())).rejects.toThrow(/spawn worker.*eaccess/);
    });

    it('marks failed when child emits an error event', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.emit('error', new Error('child boom'));
      await a.whenDone(jobId);
      const s = await a.getJobStatus(jobId);
      expect(s.state).toBe('failed');
      expect(s.error).toMatch(/child boom/);
    });
  });

  describe('AC #15: telemetry — OTel spans', () => {
    it('emits a span for submitJob with vendor / jobId / state / duration_ms', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      const spans = recordedSpans();
      const submit = spans.find((s) => s.name === 'render-farm.submitJob');
      expect(submit).toBeDefined();
      expect(submit?.attributes.vendor).toBe('in-memory');
      expect(submit?.attributes.jobId).toBe(jobId);
      expect(submit?.attributes.state).toBeDefined();
      expect(submit?.attributes.duration_ms).toBeDefined();
    });

    it('emits a span for getJobStatus and cancelJob', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      await a.getJobStatus(jobId);
      await a.cancelJob(jobId);
      const spans = recordedSpans();
      expect(spans.some((s) => s.name === 'render-farm.getJobStatus')).toBe(true);
      expect(spans.some((s) => s.name === 'render-farm.cancelJob')).toBe(true);
    });
  });

  describe('AC #14: state-marker integration with worker output', () => {
    it('parses the worker-emitted markers as part of normal stdout flow', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob({ bakeId: 'inputshash-abc' }));
      // The worker writes:
      //   {"level":"info","msg":"worker.started",...}
      //   STAGEFLIP_RENDER_FARM_STARTED bakeId=inputshash-abc
      //   ...rendering...
      //   STAGEFLIP_RENDER_FARM_FINISHED bakeId=inputshash-abc status=succeeded
      child.emitStdout('{"level":"info","msg":"worker.started","ctx":{}}');
      child.emitStdout(buildStartedMarker('inputshash-abc'));
      child.emitStdout('{"level":"info","msg":"bake.completed","ctx":{}}');
      child.emitStdout(buildFinishedMarker({ bakeId: 'inputshash-abc', status: 'succeeded' }));
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);

      const status = await a.getJobStatus(jobId);
      expect(status.state).toBe('succeeded');
      // Replay the buffered logs and confirm both worker logs and markers are present.
      const lines: string[] = [];
      for await (const l of a.streamLogs(jobId)) lines.push(l);
      expect(lines.some((l) => l.includes('worker.started'))).toBe(true);
      expect(lines.some((l) => l.startsWith('STAGEFLIP_RENDER_FARM_STARTED'))).toBe(true);
      expect(lines.some((l) => l.startsWith('STAGEFLIP_RENDER_FARM_FINISHED'))).toBe(true);
    });
  });

  describe('coverage edge cases', () => {
    it('partial line + exit flushes the trailing buffer', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.stdout.push('partial-line-without-newline');
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);
      const lines: string[] = [];
      for await (const l of a.streamLogs(jobId)) lines.push(l);
      expect(lines).toContain('partial-line-without-newline');
    });

    it('bounded log buffer drops oldest', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({
        spawn: queuedSpawn([child]),
        logBufferLines: 3,
      });
      const { jobId } = await a.submitJob(makeJob());
      child.emitStdout('a');
      child.emitStdout('b');
      child.emitStdout('c');
      child.emitStdout('d');
      child.emitStdout('e');
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);
      const lines: string[] = [];
      for await (const l of a.streamLogs(jobId)) lines.push(l);
      expect(lines).toEqual(['c', 'd', 'e']);
    });

    it('whenDone rejects for unknown jobId', async () => {
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([]) });
      await expect(a.whenDone('nope')).rejects.toThrow(/job not found/);
    });

    it('strips trailing CR from CRLF-delimited lines', async () => {
      const child = createFakeChild();
      const a = new InMemoryRenderFarmAdapter({ spawn: queuedSpawn([child]) });
      const { jobId } = await a.submitJob(makeJob());
      child.stdout.push('hello\r\nworld\r\n');
      await tick();
      child.emitExit(0);
      await a.whenDone(jobId);
      const lines: string[] = [];
      for await (const l of a.streamLogs(jobId)) lines.push(l);
      expect(lines).toEqual(['hello', 'world']);
    });
  });
});
