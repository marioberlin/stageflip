import { type AuthDeps, type CallerContext } from './types.js';
export interface RevokeApiKeyInput {
    readonly keyId: string;
}
export interface RevokeApiKeyOutput {
    readonly success: true;
}
export declare function revokeApiKeyHandler(deps: AuthDeps, caller: CallerContext, input: RevokeApiKeyInput): Promise<RevokeApiKeyOutput>;
//# sourceMappingURL=revoke-api-key.d.ts.map