# @stageflip/export-video

## 0.1.0

### Minor Changes

- 9310860: T-186: multi-aspect parallel export orchestrator.

  `@stageflip/export-video` (previously stubbed) gains the orchestration
  layer that consumes the agent's `bounce_to_aspect_ratios` output
  (T-185) and runs one render per target aspect ratio in parallel.

  **API:**

  ```ts
  exportMultiAspectInParallel({
    document: Document,
    variants: VariantTarget[],
    renderer: VariantRenderer,
    concurrency?: number,    // default 3
    signal?: AbortSignal,
  }): Promise<MultiAspectExportResult>
  ```

  - **`VariantRenderer`** is the injectable contract — real backends
    (CDP host bundle, bake tier) plug in behind it; this package owns
    the orchestration only.
  - **Collect-all error policy**: one failing variant doesn't cancel
    the others. Outcomes are `{ ok: true, output }` or
    `{ ok: false, variant, error }` per input target, preserving input
    order.
  - **Concurrency cap**: default 3 in-flight renders, configurable.
    `Infinity` / `<= 0` means unlimited. Implemented via a minimal
    worker-pool helper (`mapWithConcurrency`, also exported), no
    `p-limit` dep.
  - **Abort signal**: propagates to every renderer call.
  - **Non-Error throws**: normalised into `Error` instances so callers
    can rely on `.message`.

  14 tests (7 concurrency + 7 orchestrator). Zero opinionated runtime
  deps beyond `@stageflip/schema`.

### Patch Changes

- Updated dependencies [36d0c5d]
  - @stageflip/schema@0.1.0
