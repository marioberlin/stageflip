import type { AdminAuthLike, AuthDeps, CollectionRefLike, DocRefLike, FirestoreLike } from './types.js';
interface DocStore {
    data: Record<string, unknown> | undefined;
}
export declare class MemoryFirestore implements FirestoreLike {
    readonly docs: Map<string, DocStore>;
    doc(path: string): DocRefLike;
    collection(path: string): CollectionRefLike;
    private docRef;
    private collectionRef;
    private getOrCreate;
    /** Test helper — seed a doc directly. */
    seed(path: string, data: Record<string, unknown>): void;
}
export declare class MemoryAuth implements AdminAuthLike {
    readonly claims: Map<string, {
        org?: string;
        role?: string;
    }>;
    setCustomUserClaims(uid: string, next: {
        org?: string;
        role?: string;
    }): Promise<void>;
}
export declare function fakeDeps(overrides?: Partial<AuthDeps>): AuthDeps;
export {};
//# sourceMappingURL=test-helpers.d.ts.map