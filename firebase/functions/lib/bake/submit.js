// firebase/functions/src/bake/submit.ts
// Cloud Function adapter for `submitBakeJob({ clipDescriptor })` (T-265
// D-T265-5). The pure handler lives in @stageflip/runtimes-blender; this
// module is the Firebase glue that
//   - extracts the `CallerContext` from the request,
//   - resolves the caller's region by reading their org doc,
//   - hands a typed `SubmitDeps` to the handler,
//   - translates any `SubmitError` to a Firebase `HttpsError`-shaped throw
//     (the top-level index.ts performs the actual HttpsError wrap).
import { submitBakeJobHandler, } from '@stageflip/runtimes-blender';
import { blenderClipSchema } from '@stageflip/schema';
import { CallableError } from '../auth/types.js';
export async function submitBakeJobAdapter(deps, caller, input) {
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
        throw new CallableError('invalid-argument', `clipDescriptor failed schema validation: ${parsed.error.message}`);
    }
    const clipDescriptor = parsed.data;
    // Resolve caller's region from the org doc (T-271 routing precondition).
    const region = await readOrgRegion(deps.firestore, caller.orgId);
    const submitCaller = {
        uid: caller.uid,
        orgId: caller.orgId,
        region,
    };
    const submitInput = { clipDescriptor };
    try {
        return await submitBakeJobHandler(deps, submitCaller, submitInput);
    }
    catch (err) {
        // Translate the package-level SubmitError into the local CallableError so
        // the top-level Firebase wrapper produces the right HttpsError shape.
        if (err instanceof Error) {
            const maybe = err;
            if (maybe.code !== undefined) {
                const code = String(maybe.code);
                const status = typeof maybe.httpStatus === 'number' ? maybe.httpStatus : 400;
                throw new CallableError(code, err.message, status);
            }
        }
        throw err;
    }
}
async function readOrgRegion(firestore, orgId) {
    const snap = await firestore.doc(`orgs/${orgId}`).get();
    if (!snap.exists) {
        // Org missing — caller has org claim but no org doc; treat as US default
        // (T-271 AC #13: persisted orgs without region default to "us").
        return 'us';
    }
    const data = snap.data() ?? {};
    const region = data.region;
    if (region === 'us' || region === 'eu')
        return region;
    return 'us';
}
//# sourceMappingURL=submit.js.map