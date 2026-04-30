import { type Role } from '@stageflip/auth-schema';
import { type AuthDeps, type CallerContext } from './types.js';
export interface InviteMemberInput {
    readonly email: string;
    readonly role: Role;
}
export interface InviteMemberOutput {
    readonly token: string;
    readonly expiresAt: number;
}
export declare function inviteMemberHandler(deps: AuthDeps, caller: CallerContext, input: InviteMemberInput): Promise<InviteMemberOutput>;
//# sourceMappingURL=invite-member.d.ts.map