import { type Role } from '@stageflip/auth-schema';
import { type AuthDeps, type CallerContext } from './types.js';
export interface CreateApiKeyInput {
    readonly name: string;
    readonly role: Role;
}
export interface CreateApiKeyOutput {
    readonly id: string;
    /** Plaintext key, returned ONCE. Never logged anywhere. */
    readonly plaintext: string;
    readonly prefix: string;
}
export declare function createApiKeyHandler(deps: AuthDeps, caller: CallerContext, input: CreateApiKeyInput): Promise<CreateApiKeyOutput>;
//# sourceMappingURL=create-api-key.d.ts.map