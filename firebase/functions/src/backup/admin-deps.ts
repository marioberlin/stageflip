// firebase/functions/src/backup/admin-deps.ts
// Production wiring for the backup BackupDeps bundle. This module is
// integration-only and NOT unit-tested — it depends on `firebase-admin`
// runtime + ambient Cloud Functions environment, neither of which is
// available inside the vitest harness. The pure handlers it adapts are
// fully covered in `*.test.ts`. T-272 D-T272-2.

import { Buffer } from 'node:buffer';
import { request as httpsRequest } from 'node:https';
import { captureError, createLogger } from '@stageflip/observability';
import { getStorage } from 'firebase-admin/storage';
import type {
  BackupDeps,
  BackupTarget,
  FirestoreDatabaseId,
  FirestoreExporterLike,
  StorageCopierLike,
} from './index.js';

const log = createLogger('backup');

/** Read an env var with a fallback. Returns undefined when neither is set. */
function envOr(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v !== undefined && v.length > 0) return v;
  return fallback;
}

/**
 * Cached Google access token. The Cloud Functions runtime exposes a metadata
 * server at http://metadata.google.internal that returns short-lived OAuth
 * tokens. We use it to authenticate the Firestore export REST call without
 * pulling in `googleapis` as a direct dep.
 */
async function getMetadataAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        method: 'GET',
        host: 'metadata.google.internal',
        path: '/computeMetadata/v1/instance/service-accounts/default/token',
        headers: { 'Metadata-Flavor': 'Google' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`metadata token http ${res.statusCode}`));
            return;
          }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              access_token?: string;
            };
            if (!body.access_token) {
              reject(new Error('metadata token response missing access_token'));
              return;
            }
            resolve(body.access_token);
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function adminFirestoreExporter(): FirestoreExporterLike {
  return {
    async exportDocuments(args) {
      const token = await getMetadataAccessToken();
      const dbPath =
        args.databaseId === '(default)'
          ? `projects/${args.project}/databases/(default)`
          : `projects/${args.project}/databases/${args.databaseId}`;
      const body = JSON.stringify({
        outputUriPrefix: args.outputUriPrefix,
        ...(args.collectionIds ? { collectionIds: args.collectionIds } : {}),
      });
      const responseText = await new Promise<string>((resolve, reject) => {
        const req = httpsRequest(
          {
            method: 'POST',
            host: 'firestore.googleapis.com',
            path: `/v1/${encodeURI(dbPath)}:exportDocuments`,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body, 'utf8'),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8');
              if (res.statusCode === undefined || res.statusCode >= 400) {
                reject(new Error(`exportDocuments http ${res.statusCode}: ${text}`));
                return;
              }
              resolve(text);
            });
          },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      const parsed = JSON.parse(responseText) as { name?: string };
      return {
        operationName: parsed.name ?? `<unknown>:${args.databaseId}`,
        outputUriPrefix: args.outputUriPrefix,
      };
    },
  };
}

function adminStorageCopier(): StorageCopierLike {
  const storage = getStorage();
  return {
    async listObjects(args) {
      const bucket = storage.bucket(args.bucket);
      const opts = args.prefix !== undefined ? { prefix: args.prefix } : {};
      const [files] = await bucket.getFiles(opts);
      return files.map((f) => {
        const meta = f.metadata as { size?: string | number };
        const size =
          typeof meta.size === 'string'
            ? Number(meta.size)
            : typeof meta.size === 'number'
              ? meta.size
              : 0;
        return { name: f.name, size };
      });
    },
    async copyObject(args) {
      const src = storage.bucket(args.srcBucket).file(args.srcObject);
      const dst = storage.bucket(args.dstBucket).file(args.dstObject);
      await src.copy(dst);
    },
    async statObject(args) {
      const file = storage.bucket(args.bucket).file(args.object);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [meta] = await file.getMetadata();
      const m = meta as { size?: string | number };
      const size =
        typeof m.size === 'string' ? Number(m.size) : typeof m.size === 'number' ? m.size : 0;
      return { size };
    },
    async readObjectText(args) {
      const file = storage.bucket(args.bucket).file(args.object);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [buf] = await file.download();
      return buf.toString('utf8');
    },
    async uploadText(args) {
      const file = storage.bucket(args.bucket).file(args.object);
      await file.save(Buffer.from(args.text, 'utf8'), {
        contentType: 'application/json',
        resumable: false,
      });
    },
  };
}

function defaultFirestoreTargets(): readonly BackupTarget[] {
  // Per T-271, both databases are backed up.
  const us: BackupTarget = { databaseId: '(default)' as FirestoreDatabaseId, regionTag: 'us' };
  const eu: BackupTarget = { databaseId: 'eu-west' as FirestoreDatabaseId, regionTag: 'eu' };
  return [us, eu];
}

function defaultAssetsBuckets(projectId: string): readonly string[] {
  // Conventional Firebase bucket names; override via env for staging/prod.
  const us = envOr('STAGEFLIP_ASSETS_BUCKET_US', `${projectId}.appspot.com`);
  const eu = envOr('STAGEFLIP_ASSETS_BUCKET_EU', `${projectId}-eu-assets`);
  const out: string[] = [];
  if (us !== undefined) out.push(us);
  if (eu !== undefined) out.push(eu);
  return out;
}

/** Build the production BackupDeps bundle from ambient Cloud Functions env. */
export function createAdminBackupDeps(): BackupDeps {
  const projectId =
    envOr('GCLOUD_PROJECT') ??
    envOr('GCP_PROJECT') ??
    envOr('FIREBASE_CONFIG_PROJECT_ID') ??
    'stageflip';
  const backupsBucket = envOr('STAGEFLIP_BACKUPS_BUCKET', 'stageflip-backups') as string;
  return {
    firestoreExporter: adminFirestoreExporter(),
    storageCopier: adminStorageCopier(),
    logger: {
      info: (obj, msg) => log.info(obj, msg),
      warn: (obj, msg) => log.warn(obj, msg),
      error: (obj, msg) => {
        if (obj instanceof Error) log.error(obj, msg);
        else log.error(obj, msg);
      },
    },
    captureError: (err, ctx) => captureError(err, ctx),
    clock: () => Date.now(),
    projectId,
    backupsBucket,
    firestoreTargets: defaultFirestoreTargets(),
    assetsBuckets: defaultAssetsBuckets(projectId),
    retentionDays: Number(envOr('STAGEFLIP_BACKUP_RETENTION_DAYS', '30')),
  };
}
