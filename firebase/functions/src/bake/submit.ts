// firebase/functions/src/bake/submit.ts
// Cloud Function adapter for `submitBakeJob({ clipDescriptor })` (T-265
// D-T265-5). The pure handler lives in @stageflip/runtimes-blender; this
// module is the Firebase glue that
//   - extracts the `CallerContext` from the request,
//   - resolves the caller's region by reading their org doc,
//   - hands a typed `SubmitDeps` to the handler,
//   - translates any `SubmitError` to a Firebase `HttpsError`-shaped throw
//     (the top-level index.ts performs the actual HttpsError wrap).

import type { Region } from '@stageflip/auth-schema';
import {
  type SubmitCaller,
  type SubmitDeps,
  type SubmitInput,
  type SubmitOutput,
  submitBakeJobHandler,
} from '@stageflip/runtimes-blender';
import { type BlenderClipElement, blenderClipSchema } from '@stageflip/schema';

import { CallableError, type CallerContext, type FirestoreLike } from '../auth/types.js';

/** Firestore-backed deps the adapter needs in addition to {@link SubmitDeps}. */
export interface BakeSubmitFirestoreDeps {
  readonly firestore: FirestoreLike;
}

export interface BakeSubmitDeps extends SubmitDeps, BakeSubmitFirestoreDeps {}

export interface SubmitBakeJobInput {
  readonly clipDescriptor: unknown;
}

export type SubmitBakeJobOutput = SubmitOutput;

export async function submitBakeJobAdapter(
  deps: BakeSubmitDeps,
  caller: CallerContext,
  input: SubmitBakeJobInput,
): Promise<SubmitBakeJobOutput> {
  if (!caller.uid) {
    throw new CallableError('unauthenticated', 'sign-in required', 401);
  }
  if (!caller.orgId) {
    throw new CallableError('failed-precondition', 'active org required', 412);
  }

  // Validate the descriptor at the boundary; reject obviously malformed input
  // before we touch the limiter or hash.
  const parsed = blenderClipSchema.safeParse(input.clipDescriptor);
  if (!parsed.success) {
    throw new CallableError(
      'invalid-argument',
      `clipDescriptor failed schema validation: ${parsed.error.message}`,
    );
  }
  const clipDescriptor: BlenderClipElement = parsed.data;

  // Resolve caller's region from the org doc (T-271 routing precondition).
  const region = await readOrgRegion(deps.firestore, caller.orgId);

  const submitCaller: SubmitCaller = {
    uid: caller.uid,
    orgId: caller.orgId,
    region,
  };
  const submitInput: SubmitInput = { clipDescriptor };

  try {
    return await submitBakeJobHandler(deps, submitCaller, submitInput);
  } catch (err) {
    // Translate the package-level SubmitError into the local CallableError so
    // the top-level Firebase wrapper produces the right HttpsError shape.
    if (err instanceof Error) {
      const maybe = err as unknown as { code?: unknown; httpStatus?: unknown };
      if (maybe.code !== undefined) {
        const code = String(maybe.code);
        const status = typeof maybe.httpStatus === 'number' ? maybe.httpStatus : 400;
        throw new CallableError(code, err.message, status);
      }
    }
    throw err;
  }
}

async function readOrgRegion(firestore: FirestoreLike, orgId: string): Promise<Region> {
  const snap = await firestore.doc(`orgs/${orgId}`).get();
  if (!snap.exists) {
    // Org missing — caller has org claim but no org doc; treat as US default
    // (T-271 AC #13: persisted orgs without region default to "us").
    return 'us';
  }
  const data = snap.data() ?? {};
  const region = (data as { region?: unknown }).region;
  if (region === 'us' || region === 'eu') return region;
  return 'us';
}
