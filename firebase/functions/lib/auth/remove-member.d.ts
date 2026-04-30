import { type AuthDeps, type CallerContext } from './types.js';
export interface RemoveMemberInput {
    readonly userId: string;
}
export interface RemoveMemberOutput {
    readonly success: true;
}
export declare function removeMemberHandler(deps: AuthDeps, caller: CallerContext, input: RemoveMemberInput): Promise<RemoveMemberOutput>;
//# sourceMappingURL=remove-member.d.ts.map