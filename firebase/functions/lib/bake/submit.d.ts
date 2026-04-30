import { type SubmitDeps, type SubmitOutput } from '@stageflip/runtimes-blender';
import { type CallerContext, type FirestoreLike } from '../auth/types.js';
/** Firestore-backed deps the adapter needs in addition to {@link SubmitDeps}. */
export interface BakeSubmitFirestoreDeps {
    readonly firestore: FirestoreLike;
}
export interface BakeSubmitDeps extends SubmitDeps, BakeSubmitFirestoreDeps {
}
export interface SubmitBakeJobInput {
    readonly clipDescriptor: unknown;
}
export type SubmitBakeJobOutput = SubmitOutput;
export declare function submitBakeJobAdapter(deps: BakeSubmitDeps, caller: CallerContext, input: SubmitBakeJobInput): Promise<SubmitBakeJobOutput>;
//# sourceMappingURL=submit.d.ts.map