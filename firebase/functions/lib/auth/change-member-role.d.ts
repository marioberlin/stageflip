import { type Role } from '@stageflip/auth-schema';
import { type AuthDeps, type CallerContext } from './types.js';
export interface ChangeMemberRoleInput {
    readonly userId: string;
    readonly newRole: Role;
}
export interface ChangeMemberRoleOutput {
    readonly success: true;
}
export declare function changeMemberRoleHandler(deps: AuthDeps, caller: CallerContext, input: ChangeMemberRoleInput): Promise<ChangeMemberRoleOutput>;
//# sourceMappingURL=change-member-role.d.ts.map