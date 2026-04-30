import { type AuthDeps, type CallerContext } from './types.js';
export interface SetActiveOrgInput {
    readonly orgId: string;
}
export interface SetActiveOrgOutput {
    readonly success: true;
}
export declare function setActiveOrgHandler(deps: AuthDeps, caller: CallerContext, input: SetActiveOrgInput): Promise<SetActiveOrgOutput>;
//# sourceMappingURL=set-active-org.d.ts.map