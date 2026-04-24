// packages/export-video/src/concurrency.ts
// A small concurrency-limited runner. No runtime dependency on p-limit —
// the orchestrator only needs a FIFO queue with N in-flight slots.

/**
 * Run `tasks` with at most `limit` in flight. Preserves input order in
 * the returned array. Each task function receives its 0-based index so
 * it can correlate with the input.
 *
 * `limit <= 0` is treated as unlimited (equivalent to `Promise.all`).
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
