// apps/stageflip-slide/src/components/onboarding/onboarding-storage.ts
// Thin localStorage adapter for first-run detection (T-139c).

/**
 * The onboarding coachmark sequence runs on first editor load and then
 * never again until the user clears it. We persist the completion flag
 * through the same failure-tolerant storage shape as T-121c's
 * `document-storage` — SSR, Safari private browsing, and quota errors
 * all degrade to "don't show onboarding", which is correct for a
 * first-run affordance (we'd rather skip it than crash the app).
 */

const STORAGE_KEY = 'stageflip:editor:onboarding:complete';

function storage(): Storage | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  return (globalThis as { localStorage?: Storage }).localStorage;
}

/** Returns true iff the user has already completed or skipped onboarding. */
export function isOnboardingComplete(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Marks onboarding as done; subsequent mounts will not show it. */
export function markOnboardingComplete(): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore — quota or private-browsing
  }
}

/** Test hook: clear the flag so repeated test runs start fresh. */
export function resetOnboardingForTest(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
