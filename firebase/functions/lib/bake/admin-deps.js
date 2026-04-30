// firebase/functions/src/bake/admin-deps.ts
// Production wiring for the bake submit Cloud Function. Integration-only and
// NOT unit-tested — depends on `firebase-admin`, `bullmq`, and `ioredis`
// runtime, none of which is exercised inside vitest. The pure handler is
// fully covered in @stageflip/runtimes-blender's submit.test.ts and the
// adapter glue in submit.test.ts.
import { randomUUID } from 'node:crypto';
import { BAKE_QUEUE_NAME, BakeQueueProducer, } from '@stageflip/runtimes-blender';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
function envOr(name, fallback) {
    const v = process.env[name];
    if (v !== undefined && v.length > 0)
        return v;
    return fallback;
}
/**
 * Adapt our `RateLimiterLike` shape on top of an ioredis client. We only need
 * `consume(input)` here; @stageflip/rate-limit ships the full token-bucket
 * implementation. Lazy imports keep tests of unrelated paths from loading
 * heavy deps.
 */
async function buildLimiter() {
    const { RateLimiter } = await import('@stageflip/rate-limit');
    const Redis = (await import('ioredis')).default;
    const redisUrl = envOr('STAGEFLIP_BAKE_REDIS_URL', envOr('REDIS_URL'));
    if (redisUrl === undefined) {
        throw new Error('createAdminBakeDeps: STAGEFLIP_BAKE_REDIS_URL or REDIS_URL must be set for the bake submit limiter');
    }
    const client = new Redis(redisUrl);
    const limiter = new RateLimiter({
        redis: {
            get: (k) => client.get(k),
            set: async (k, v, opts) => {
                if (opts && typeof opts.px === 'number') {
                    await client.set(k, v, 'PX', opts.px);
                    return;
                }
                await client.set(k, v);
            },
        },
    });
    return { consume: (input) => limiter.consume(input) };
}
async function buildProducer() {
    const { Queue } = await import('bullmq');
    const Redis = (await import('ioredis')).default;
    const redisUrl = envOr('STAGEFLIP_BAKE_REDIS_URL', envOr('REDIS_URL'));
    if (redisUrl === undefined) {
        throw new Error('createAdminBakeDeps: STAGEFLIP_BAKE_REDIS_URL or REDIS_URL must be set for the bake queue producer');
    }
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue(BAKE_QUEUE_NAME, { connection });
    return new BakeQueueProducer({ queue });
}
function buildRouter() {
    const usBucket = envOr('STAGEFLIP_BAKE_BUCKET_US', 'stageflip-assets');
    const euBucket = envOr('STAGEFLIP_BAKE_BUCKET_EU', 'stageflip-eu-assets');
    const storage = getStorage();
    function reader(bucketName) {
        return {
            bucketName,
            async getText(path) {
                const file = storage.bucket(bucketName).file(path);
                const [exists] = await file.exists();
                if (!exists)
                    return null;
                const [buf] = await file.download();
                return buf.toString('utf8');
            },
            publicUrl(path) {
                return `https://storage.googleapis.com/${bucketName}/${path}`;
            },
        };
    }
    return {
        reader: (region) => reader(region === 'eu' ? euBucket : usBucket),
        outputBucket: (region) => (region === 'eu' ? euBucket : usBucket),
    };
}
/** Build the production BakeSubmitDeps bundle from ambient Cloud Functions env. */
export async function createAdminBakeDeps() {
    const [limiter, producer] = await Promise.all([buildLimiter(), buildProducer()]);
    return {
        firestore: getFirestore(),
        limiter,
        producer,
        router: buildRouter(),
        clock: () => Date.now(),
        newBakeId: () => randomUUID(),
    };
}
//# sourceMappingURL=admin-deps.js.map