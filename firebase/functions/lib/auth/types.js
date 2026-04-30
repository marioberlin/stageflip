// firebase/functions/src/auth/types.ts
// Shared types + DI shapes for the auth callables (T-262).
//
// Each handler is a pure-async function over an injected `AuthDeps`
// bundle. The Firebase wrappers in `index.ts` adapt these handlers to
// `onCall` callables; the handlers themselves are unit-testable
// without `firebase-functions-test`.
export class CallableError extends Error {
    code;
    httpStatus;
    constructor(code, message, httpStatus = 400) {
        super(message);
        this.name = 'CallableError';
        this.code = code;
        this.httpStatus = httpStatus;
    }
}
//# sourceMappingURL=types.js.map