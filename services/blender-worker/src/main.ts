// services/blender-worker/src/main.ts
// Worker entrypoint — wires the BullMQ Worker on top of the pure
// `processBakeJob`. Integration-only; not unit-tested. Run via
// `node ./dist/main.js` inside the Docker image (see Dockerfile CMD).

import { type Bucket, Storage } from '@google-cloud/storage';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

import type { BakeJobPayload } from '@stageflip/runtimes-blender';

import { createBlenderCliInvoker } from './blender-invoker.js';
import {
  type BakeOutputBucket,
  type BucketRouter,
  WORKER_QUEUE_NAME,
  type WorkerObservability,
  processBakeJob,
} from './worker.js';

function envOr(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v !== undefined && v.length > 0) return v;
  return fallback;
}

function buildBucketRouter(): BucketRouter {
  // Lazy import google-cloud-storage at first request to keep import cost low.
  const storage = new Storage();
  const cache = new Map<string, BakeOutputBucket>();
  function adapter(bucketName: string): BakeOutputBucket {
    const cached = cache.get(bucketName);
    if (cached) return cached;
    const handle: Bucket = storage.bucket(bucketName);
    const value: BakeOutputBucket = {
      async getText(path) {
        const file = handle.file(path);
        const [exists] = await file.exists();
        if (!exists) return null;
        const [buf] = await file.download();
        return buf.toString('utf8');
      },
      async putBytes(path, bytes) {
        const file = handle.file(path);
        await file.save(Buffer.from(bytes), {
          contentType: 'image/png',
          resumable: false,
        });
      },
      async putText(path, text) {
        const file = handle.file(path);
        await file.save(Buffer.from(text, 'utf8'), {
          contentType: 'application/json',
          resumable: false,
        });
      },
    };
    cache.set(bucketName, value);
    return value;
  }
  return { bucketFor: (_region, name) => adapter(name) };
}

function buildObservability(): WorkerObservability {
  // Stdout structured log; Sentry wired via @stageflip/observability when
  // STAGEFLIP_SENTRY_DSN is set in the worker env.
  return {
    info: (msg, ctx) => process.stdout.write(`${JSON.stringify({ level: 'info', msg, ctx })}\n`),
    warn: (msg, ctx) => process.stdout.write(`${JSON.stringify({ level: 'warn', msg, ctx })}\n`),
    captureError: (err, ctx) =>
      process.stderr.write(`${JSON.stringify({ level: 'error', err: String(err), ctx })}\n`),
  };
}

export async function startWorker(): Promise<Worker> {
  const redisUrl =
    envOr('STAGEFLIP_BAKE_REDIS_URL') ?? envOr('REDIS_URL') ?? 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const observability = buildObservability();
  const router = buildBucketRouter();
  const invoker = createBlenderCliInvoker();
  const worker = new Worker(
    WORKER_QUEUE_NAME,
    async (job) => {
      const payload = job.data as BakeJobPayload;
      return processBakeJob({ invoker, router, observability, clock: () => Date.now() }, payload);
    },
    { connection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    observability.captureError(err, { jobId: job?.id, payload: job?.data });
  });
  observability.info('worker.started', { queue: WORKER_QUEUE_NAME });
  return worker;
}

// Run when invoked directly. Avoids running on import (so tests can import
// helpers without spinning up the worker).
const isMain = typeof process.argv[1] === 'string' && process.argv[1].endsWith('main.js');
if (isMain) {
  startWorker().catch((err) => {
    process.stderr.write(`worker startup failed: ${String(err)}\n`);
    process.exit(1);
  });
}
