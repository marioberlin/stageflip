// firebase/functions/src/auth/test-helpers.ts
// Tiny in-memory implementations of the firebase-admin shapes the
// auth handlers consume. Keeps the unit tests free of any
// firebase-admin runtime.
export class MemoryFirestore {
    docs = new Map();
    doc(path) {
        return this.docRef(path);
    }
    collection(path) {
        return this.collectionRef(path);
    }
    docRef(path) {
        const store = this.getOrCreate(path);
        const fs = this;
        return {
            id: path.split('/').pop() ?? '',
            path,
            async get() {
                return {
                    exists: store.data !== undefined,
                    id: path.split('/').pop() ?? '',
                    data: () => store.data,
                };
            },
            async set(data) {
                store.data = { ...data };
            },
            async update(data) {
                store.data = { ...(store.data ?? {}), ...data };
            },
            async delete() {
                store.data = undefined;
                fs.docs.delete(path);
            },
        };
    }
    collectionRef(path) {
        const fs = this;
        let counter = 0;
        return {
            doc(id) {
                const finalId = id ?? `auto-${++counter}`;
                return fs.docRef(`${path}/${finalId}`);
            },
            async add(data) {
                const finalId = `auto-${++counter}`;
                const ref = fs.docRef(`${path}/${finalId}`);
                await ref.set(data);
                return ref;
            },
        };
    }
    getOrCreate(path) {
        const existing = this.docs.get(path);
        if (existing)
            return existing;
        const created = { data: undefined };
        this.docs.set(path, created);
        return created;
    }
    /** Test helper — seed a doc directly. */
    seed(path, data) {
        const store = this.getOrCreate(path);
        store.data = { ...data };
    }
}
export class MemoryAuth {
    claims = new Map();
    async setCustomUserClaims(uid, next) {
        this.claims.set(uid, { ...next });
    }
}
export function fakeDeps(overrides = {}) {
    let now = 1_700_000_000_000;
    const fs = overrides.firestore ?? new MemoryFirestore();
    const auth = overrides.auth ?? new MemoryAuth();
    return {
        firestore: fs,
        auth,
        clock: overrides.clock ?? (() => now++),
        randomBytes: overrides.randomBytes ??
            ((n) => {
                const out = new Uint8Array(n);
                for (let i = 0; i < n; i++)
                    out[i] = (i * 37 + 11) & 0xff;
                return out;
            }),
        env: overrides.env ?? 'dev',
        hashApiKey: overrides.hashApiKey ??
            (async (s) => {
                // Test fake — emit a deterministic non-reversible string that
                // does NOT embed the plaintext (real scrypt is one-way).
                let h = 0;
                for (let i = 0; i < s.length; i++)
                    h = (h * 31 + s.charCodeAt(i)) | 0;
                return `scrypt-fake$${(h >>> 0).toString(16).padStart(8, '0')}`;
            }),
    };
}
//# sourceMappingURL=test-helpers.js.map