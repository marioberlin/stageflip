// packages/export-html5-zip/src/concurrency.ts
// Concurrency-limited runner for the multi-size orchestrator. Independent
// copy of `@stageflip/export-video`'s helper — this package is a leaf,
// pulling a workspace dep for a 40-line utility isn't worth the coupling.

/**
 * Run `tasks` with at most `limit` in flight. Preserves input order.
 * `limit <= 0` or `limit >= tasks.length` runs everything concurrently.
 */
export async function mapWithConcurrency<T, R>(
  tasks: readonly T[],
  limit: number,
  fn: (task: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (tasks.length === 0) return [];
  if (!Number.isFinite(limit) || limit <= 0 || limit >= tasks.length) {
    return Promise.all(tasks.map((task, index) => fn(task, index)));
  }

  const results: R[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      const task = tasks[index];
      if (task === undefined) return;
      results[index] = await fn(task, index);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}
