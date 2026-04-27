// packages/auth-client/src/claims-events.ts
// Lightweight in-process pub/sub for "ID-token claims have changed".
// `switchOrg` publishes after a force-refresh; `useCurrentOrg`
// subscribes and re-reads.
//
// Firebase's `onIdTokenChanged` would do this for us in a real client,
// but we can't depend on `firebase` here without forcing every
// consumer to install it. The bus is structurally compatible: a real
// Firebase consumer can wire `auth.onIdTokenChanged` into
// `notifyClaimsChanged` if they prefer.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to claims-changed events. Returns an unsubscribe fn. */
export function subscribeClaimsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify all subscribers — typically called by `switchOrg`. */
export function notifyClaimsChanged(): void {
  for (const l of listeners) l();
}
