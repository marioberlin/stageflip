// firebase/functions/src/index.ts
// Top-level Cloud Functions entrypoint. Each callable adapts a pure
// handler from `./auth/*` (T-262) and `./backup/*` (T-272) into Firebase's
// onCall / onSchedule conventions. The handlers themselves are unit-tested
// in their `*.test.ts` siblings; this file is integration-only and not
// covered by unit tests (firebase-admin initialisation can't be mocked
// cleanly in vitest).

import { randomBytes } from 'node:crypto';
import { hashApiKey } from '@stageflip/auth-middleware';
import { roleSchema } from '@stageflip/auth-schema';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { type CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  type AuthDeps,
  CallableError,
  type CallerContext,
  acceptInviteHandler,
  changeMemberRoleHandler,
  createApiKeyHandler,
  inviteMemberHandler,
  removeMemberHandler,
  revokeApiKeyHandler,
  setActiveOrgHandler,
} from './auth/index.js';
import { createAdminBackupDeps } from './backup/admin-deps.js';
import {
  type BackupDeps,
  backupFirestoreHandler,
  backupStorageHandler,
  verifyBackupHandler,
} from './backup/index.js';
import { createAdminBakeDeps } from './bake/admin-deps.js';
import { type BakeSubmitDeps, submitBakeJobAdapter } from './bake/index.js';

initializeApp();

function deps(): AuthDeps {
  const env = (process.env.STAGEFLIP_ENV ?? 'dev') as 'dev' | 'prod' | 'staging';
  return {
    firestore: getFirestore() as unknown as AuthDeps['firestore'],
    auth: getAuth() as unknown as AuthDeps['auth'],
    clock: () => Date.now(),
    randomBytes: (n) => randomBytes(n),
    env,
    hashApiKey,
  };
}

function callerOf(req: CallableRequest<unknown>): CallerContext {
  const claims = (req.auth?.token ?? {}) as Record<string, unknown>;
  const role = roleSchema.safeParse(claims.role);
  return {
    uid: req.auth?.uid ?? '',
    orgId: typeof claims.org === 'string' ? claims.org : undefined,
    role: role.success ? role.data : undefined,
  };
}

function asHttps(err: unknown): never {
  if (err instanceof CallableError) {
    throw new HttpsError(toFnCode(err.code), err.message);
  }
  throw err;
}

type FnCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'failed-precondition'
  | 'internal';

function toFnCode(code: string): FnCode {
  switch (code) {
    case 'unauthenticated':
    case 'permission-denied':
    case 'invalid-argument':
    case 'not-found':
    case 'failed-precondition':
      return code;
    default:
      return 'internal';
  }
}

export const setActiveOrg = onCall(async (req: CallableRequest<{ orgId: string }>) => {
  try {
    return await setActiveOrgHandler(deps(), callerOf(req), { orgId: req.data.orgId });
  } catch (err) {
    asHttps(err);
  }
});

export const createApiKey = onCall(async (req) => {
  try {
    return await createApiKeyHandler(deps(), callerOf(req), {
      name: (req.data as { name: string }).name,
      role: (req.data as { role: never }).role,
    });
  } catch (err) {
    asHttps(err);
  }
});

export const revokeApiKey = onCall(async (req) => {
  try {
    return await revokeApiKeyHandler(deps(), callerOf(req), {
      keyId: (req.data as { keyId: string }).keyId,
    });
  } catch (err) {
    asHttps(err);
  }
});

export const inviteMember = onCall(async (req) => {
  try {
    return await inviteMemberHandler(deps(), callerOf(req), {
      email: (req.data as { email: string }).email,
      role: (req.data as { role: never }).role,
    });
  } catch (err) {
    asHttps(err);
  }
});

export const acceptInvite = onCall(async (req) => {
  try {
    return await acceptInviteHandler(deps(), callerOf(req), {
      token: (req.data as { token: string }).token,
      orgId: (req.data as { orgId: string }).orgId,
    });
  } catch (err) {
    asHttps(err);
  }
});

export const removeMember = onCall(async (req) => {
  try {
    return await removeMemberHandler(deps(), callerOf(req), {
      userId: (req.data as { userId: string }).userId,
    });
  } catch (err) {
    asHttps(err);
  }
});

export const changeMemberRole = onCall(async (req) => {
  try {
    return await changeMemberRoleHandler(deps(), callerOf(req), {
      userId: (req.data as { userId: string }).userId,
      newRole: (req.data as { newRole: never }).newRole,
    });
  } catch (err) {
    asHttps(err);
  }
});

// --- T-272: backup + verification scheduled functions ---

function backupDeps(): BackupDeps {
  return createAdminBackupDeps();
}

/** T-272 AC #1: daily Firestore export at 02:00 UTC. */
export const backupFirestore = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Etc/UTC', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await backupFirestoreHandler(backupDeps());
  },
);

/** T-272 AC #2: daily Storage backup at 02:00 UTC. */
export const backupStorage = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Etc/UTC', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await backupStorageHandler(backupDeps());
  },
);

/** T-272 AC #5: daily verification at 03:00 UTC (1h after backup). */
export const verifyBackup = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    await verifyBackupHandler(backupDeps());
  },
);

// --- T-265: bake submission callable ---

let cachedBakeDeps: Promise<BakeSubmitDeps> | null = null;
function bakeDeps(): Promise<BakeSubmitDeps> {
  if (cachedBakeDeps === null) {
    cachedBakeDeps = createAdminBakeDeps();
  }
  return cachedBakeDeps;
}

export const submitBakeJob = onCall(async (req: CallableRequest<{ clipDescriptor: unknown }>) => {
  try {
    const deps = await bakeDeps();
    return await submitBakeJobAdapter(deps, callerOf(req), {
      clipDescriptor: req.data.clipDescriptor,
    });
  } catch (err) {
    asHttps(err);
  }
});
