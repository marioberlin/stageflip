import { type AuthDeps, type CallerContext } from './types.js';
export interface AcceptInviteInput {
    readonly token: string;
    /** The org the invite belongs to (carried via the link). */
    readonly orgId: string;
}
export interface AcceptInviteOutput {
    readonly orgId: string;
    readonly role: string;
}
export declare function acceptInviteHandler(deps: AuthDeps, caller: CallerContext, input: AcceptInviteInput): Promise<AcceptInviteOutput>;
//# sourceMappingURL=accept-invite.d.ts.map