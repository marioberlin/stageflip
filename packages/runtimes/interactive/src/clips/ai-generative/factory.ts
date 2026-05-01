// packages/runtimes/interactive/src/clips/ai-generative/factory.ts
// `aiGenerativeClipFactory` — produces the `ClipFactory` for
// `family: 'ai-generative'` (T-395 D-T395-1, D-T395-4).
// Standalone interactive-tier clip — no §3 runtime to wrap, no
// `frameSource` dependency (D-T395-6), no convergence test. Wraps
// a host-injected `AiGenerativeProvider` to feed the per-slide
// `prompt` and render the resolved `Blob` into a single `<img>`
// element under `ctx.root`.
//
// CRITICAL — D-T395-7: `dispose()` MUST tear down every resource:
//   1. signal.abort() on any in-flight generation.
//   2. URL.revokeObjectURL on the active blob URL — without this
//      the browser holds the blob indefinitely (~200KB per
//      regenerate; one slide × one clip = unbounded growth).
//   3. Drop result reference.
//   4. Unsubscribe handlers.
//   5. Detach the <img>.
//   6. Idempotent.
//
// CRITICAL — D-T395-8 + AC #18: telemetry NEVER carries prompt
// body, negativePrompt body, or generated blob bytes. Only integer
// attributes (`promptLength`, `blobByteLength`, `durationMs`) plus
// typed enums.
//
// HARD-RULE COMPLIANCE — AC #26: this file contains no direct
// `fetch(`, `XMLHttpRequest`, or `sendBeacon` reference. The
// `AiGenerativeProvider` seam owns the transport.
//
// Browser-safe: DOM only. No Node imports. No React (the <img> is
// the surface; no React tree needed — same posture as T-393
// WebEmbed).

import { type AiGenerativeClipProps, aiGenerativeClipPropsSchema } from '@stageflip/schema';

import type { ClipFactory, MountContext } from '../../contract.js';
import type { AiGenerativeProvider } from './ai-generative-provider.js';
import type {
  AiGenerativeClipMountHandle,
  AiGenerativeMountFailureReason,
  ErrorEvent,
  ErrorHandler,
  ResultEvent,
  ResultHandler,
} from './types.js';

/**
 * Caller-injected hooks. Tests inject an
 * `InMemoryAiGenerativeProvider`; production hosts construct a
 * `HostInjectedAiGenerativeProvider` once at app boot and pass it
 * here.
 */
export interface AiGenerativeClipFactoryOptions {
  /**
   * `AiGenerativeProvider` implementation. Required at the factory
   * layer — the package ships no production default because
   * `globalThis.fetch` is forbidden inside `clips/**` per
   * CLAUDE.md §3 (T-395 AC #26). Tests inject
   * `InMemoryAiGenerativeProvider`.
   */
  provider?: AiGenerativeProvider;
}

interface AiGenerativeMountState {
  img: HTMLImageElement;
  dataHandlers: Set<ResultHandler>;
  errorHandlers: Set<ErrorHandler>;
  /**
   * Per-generation AbortController for the in-flight `generateOnce`
   * call. Replaced at each invocation; at `dispose`, the active one
   * is aborted then cleared.
   */
  activeAbort: AbortController | undefined;
  /** Latest resolved result. */
  latestResult: { blob: Blob; contentType: string } | undefined;
  /** Active blob URL (created via URL.createObjectURL). */
  activeBlobUrl: string | undefined;
  disposed: boolean;
  /** Monotonic counter for telemetry `requestId`. */
  requestCounter: number;
}

/**
 * Convenience namespace for the factory builder. Mirrors
 * `LiveDataClipFactoryBuilder` (T-391) for consistency across
 * γ-live factories.
 */
export const AiGenerativeClipFactoryBuilder = {
  build(options: AiGenerativeClipFactoryOptions = {}): ClipFactory {
    return (ctx: MountContext) => mountAiGenerativeClip(ctx, options);
  },
};

async function mountAiGenerativeClip(
  ctx: MountContext,
  options: AiGenerativeClipFactoryOptions,
): Promise<AiGenerativeClipMountHandle> {
  const family = ctx.clip.family;

  // 1. Parse + narrow `liveMount.props`.
  const propsResult = aiGenerativeClipPropsSchema.safeParse(ctx.clip.liveMount.props);
  if (!propsResult.success) {
    ctx.emitTelemetry('ai-generative-clip.mount.failure', {
      family,
      reason: 'invalid-props' satisfies AiGenerativeMountFailureReason,
      issues: propsResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    throw new Error(
      `aiGenerativeClipFactory: liveMount.props failed aiGenerativeClipPropsSchema — ${propsResult.error.message}`,
    );
  }
  const props: AiGenerativeClipProps = propsResult.data;

  // 2. Resolve provider. The factory rejects if none is supplied —
  //    a missing provider is a configuration bug at app boot, not
  //    a permission denial.
  const provider = options.provider;
  if (provider === undefined) {
    ctx.emitTelemetry('ai-generative-clip.mount.failure', {
      family,
      reason: 'generator-unavailable' satisfies AiGenerativeMountFailureReason,
    });
    throw new Error(
      'aiGenerativeClipFactory: no AiGenerativeProvider supplied. Pass `provider` to AiGenerativeClipFactoryBuilder.build({}) at app boot.',
    );
  }

  // 3. Telemetry — mount.start. Per D-T395-8 the provider / model
  //    strings ARE included; they are configuration, not user
  //    content. promptLength is the integer length only — never
  //    the prompt body.
  ctx.emitTelemetry('ai-generative-clip.mount.start', {
    family,
    provider: props.provider,
    model: props.model,
    promptLength: props.prompt.length,
  });

  // 4. Build the <img> element + state.
  const ownerDoc = ctx.root.ownerDocument ?? document;
  const img = ownerDoc.createElement('img');
  img.setAttribute('data-stageflip-ai-generative-clip', 'true');
  img.setAttribute('width', String(props.width ?? ctx.clip.transform.width));
  img.setAttribute('height', String(props.height ?? ctx.clip.transform.height));
  ctx.root.appendChild(img);

  const state: AiGenerativeMountState = {
    img,
    dataHandlers: new Set(),
    errorHandlers: new Set(),
    activeAbort: undefined,
    latestResult: undefined,
    activeBlobUrl: undefined,
    disposed: false,
    requestCounter: 0,
  };

  // Telemetry — mount.success.
  ctx.emitTelemetry('ai-generative-clip.mount.success', { family });

  // ----- private helpers -----

  const dispatchResult = (event: ResultEvent): void => {
    for (const handler of state.dataHandlers) {
      try {
        handler(event);
      } catch {
        /* swallow — one handler's throw must not break siblings */
      }
    }
  };

  const dispatchError = (event: ErrorEvent): void => {
    for (const handler of state.errorHandlers) {
      try {
        handler(event);
      } catch {
        /* swallow */
      }
    }
  };

  const nowMs = (): number => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  };

  /**
   * Run one generation end-to-end. Updates state, dispatches events,
   * and emits telemetry. Returns when the generation settles.
   */
  const runGenerate = async (): Promise<void> => {
    if (state.disposed) return;

    // Abort any prior in-flight call (regenerate's responsibility,
    // but defensive at the lifecycle entry point too).
    if (state.activeAbort !== undefined) {
      try {
        state.activeAbort.abort();
      } catch {
        /* defensive */
      }
      state.activeAbort = undefined;
    }

    const abort = new AbortController();
    state.activeAbort = abort;

    state.requestCounter += 1;
    const requestId = `req-${state.requestCounter}`;
    const startedAt = nowMs();

    ctx.emitTelemetry('ai-generative-clip.generate.started', {
      family,
      requestId,
      promptLength: props.prompt.length,
    });

    try {
      const result = await provider.generateOnce({
        prompt: props.prompt,
        ...(props.negativePrompt !== undefined ? { negativePrompt: props.negativePrompt } : {}),
        model: props.model,
        ...(props.width !== undefined ? { width: props.width } : {}),
        ...(props.height !== undefined ? { height: props.height } : {}),
        ...(props.seed !== undefined ? { seed: props.seed } : {}),
        signal: abort.signal,
      });

      if (state.disposed || abort.signal.aborted) return;

      // Revoke any prior blob URL before installing a new one.
      if (state.activeBlobUrl !== undefined) {
        URL.revokeObjectURL(state.activeBlobUrl);
        state.activeBlobUrl = undefined;
      }

      const blobUrl = URL.createObjectURL(result.blob);
      state.activeBlobUrl = blobUrl;
      state.img.setAttribute('src', blobUrl);
      state.latestResult = { blob: result.blob, contentType: result.contentType };

      const finishedAt = nowMs();
      const durationMs = Math.max(0, finishedAt - startedAt);

      dispatchResult({
        kind: 'resolved',
        blob: result.blob,
        contentType: result.contentType,
        durationMs,
      });

      ctx.emitTelemetry('ai-generative-clip.generate.resolved', {
        family,
        requestId,
        durationMs,
        // Privacy posture (D-T395-8 + AC #18): integer length only.
        blobByteLength: result.blob.size,
        contentType: result.contentType,
      });
    } catch (err) {
      const aborted = abort.signal.aborted;
      const errorKind = aborted ? 'aborted' : 'generate-error';
      const message = err instanceof Error ? err.message : String(err);

      if (!state.disposed && !aborted) {
        dispatchError({ kind: 'generate-error', message });
      } else if (!state.disposed && aborted) {
        dispatchError({ kind: 'aborted', message });
      }

      ctx.emitTelemetry('ai-generative-clip.generate.error', {
        family,
        requestId,
        errorKind,
      });
    } finally {
      if (state.activeAbort === abort) {
        state.activeAbort = undefined;
      }
    }
  };

  const regenerate = async (): Promise<void> => {
    if (state.disposed) return;
    await runGenerate();
  };

  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    // 1. Abort any in-flight call (D-T395-7 step 1 + AC #14).
    if (state.activeAbort !== undefined) {
      try {
        state.activeAbort.abort();
      } catch {
        /* defensive */
      }
      state.activeAbort = undefined;
    }
    // 2. Revoke blob URL (D-T395-7 step 2 + AC #15).
    if (state.activeBlobUrl !== undefined) {
      try {
        URL.revokeObjectURL(state.activeBlobUrl);
      } catch {
        /* defensive */
      }
      state.activeBlobUrl = undefined;
    }
    // 3. Drop result reference.
    state.latestResult = undefined;
    // 4. Unsubscribe all handlers.
    state.dataHandlers.clear();
    state.errorHandlers.clear();
    // 5. Detach <img> (D-T395-7 step 5 + AC #16).
    if (state.img.parentNode !== null) {
      state.img.parentNode.removeChild(state.img);
    }
    // 6. Final telemetry.
    ctx.emitTelemetry('ai-generative-clip.dispose', { family });
  };

  // Wire signal.abort → dispose at the factory layer.
  if (ctx.signal.aborted) {
    dispose();
  } else {
    ctx.signal.addEventListener(
      'abort',
      () => {
        dispose();
      },
      { once: true },
    );
  }

  // 5. Kick off the mount-time generation on the next microtask so
  //    callers can subscribe `onResult` / `onError` after the
  //    factory's await resolves but before the generation settles.
  //    Same pattern as T-391 LiveData (D-T391-7).
  queueMicrotask(() => {
    if (state.disposed) return;
    void runGenerate();
  });

  // 6. Build the public handle.
  const handle: AiGenerativeClipMountHandle = {
    updateProps: () => {
      // ai-generative props are mount-time configuration; runtime
      // updates are out-of-scope for T-395. No-op.
    },
    dispose,
    regenerate,
    getResult: () =>
      state.latestResult !== undefined
        ? { blob: state.latestResult.blob, contentType: state.latestResult.contentType }
        : undefined,
    onResult: (handler: ResultHandler) => {
      state.dataHandlers.add(handler);
      return () => {
        state.dataHandlers.delete(handler);
      };
    },
    onError: (handler: ErrorHandler) => {
      state.errorHandlers.add(handler);
      return () => {
        state.errorHandlers.delete(handler);
      };
    },
  };

  return handle;
}

/**
 * The default factory instance — no options. Production hosts MUST
 * pass a `provider` via `AiGenerativeClipFactoryBuilder.build({...})`;
 * the no-options export exists so the registry has a concrete factory
 * to register at side-effect import time. Mounting the no-options
 * factory will fail with `mount.failure` reason
 * `'generator-unavailable'`, which is the correct behaviour for an
 * under-configured deployment.
 */
export const aiGenerativeClipFactory: ClipFactory = AiGenerativeClipFactoryBuilder.build();
