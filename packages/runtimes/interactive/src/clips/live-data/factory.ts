// packages/runtimes/interactive/src/clips/live-data/factory.ts
// `liveDataClipFactory` — produces the `ClipFactory` for `family:
// 'live-data'` (T-391 D-T391-1, D-T391-4). Standalone interactive-tier
// clip — no §3 runtime to wrap, no `frameSource` dependency
// (D-T391-6), no convergence test. Mounts a minimal React tree
// (an `<output data-role="live-data" />`), wraps a `LiveDataProvider`
// to expose a one-shot endpoint fetch with manual `refresh()` support.
//
// CRITICAL — D-T391-7: `dispose()` MUST tear down every resource. A
// leaked fetch costs the host's network budget; the abort discipline
// is the architectural floor. AC #16-#17.
//
// CRITICAL — D-T391-8 + AC #18: telemetry NEVER carries response body.
// Only integer attributes (`bodyByteLength`, `durationMs`, `status`)
// plus typed enums.
//
// HARD-RULE COMPLIANCE — D-T391-2 + AC #26: this file contains no
// direct `fetch(`, `XMLHttpRequest`, or `sendBeacon` reference. The
// `LiveDataProvider` seam owns the transport.
//
// Browser-safe: React 19 + DOM. No Node imports.

import { type LiveDataClipProps, liveDataClipPropsSchema } from '@stageflip/schema';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';

import type { ClipFactory, MountContext } from '../../contract.js';
import type { LiveDataProvider } from './live-data-provider.js';
import {
  type DataEvent,
  type DataHandler,
  type ErrorEvent,
  type ErrorHandler,
  type LiveDataClipMountHandle,
  type LiveDataMountFailureReason,
  RefreshTriggerError,
} from './types.js';

/**
 * Caller-injected hooks. Tests inject an `InMemoryLiveDataProvider`;
 * in production, host code constructs a `HostFetcherProvider` once at
 * app boot (passing `globalThis.fetch.bind(globalThis)` or a wrapped
 * fetcher) and passes it here.
 */
export interface LiveDataClipFactoryOptions {
  /**
   * `LiveDataProvider` implementation. Required at the factory layer —
   * the package ships no production default because `globalThis.fetch`
   * is forbidden inside `clips/**` per CLAUDE.md §3 (T-391 AC #26).
   * Tests inject `InMemoryLiveDataProvider`.
   */
  provider?: LiveDataProvider;
}

interface LiveDataMountState {
  reactRoot: Root;
  dataHandlers: Set<DataHandler>;
  errorHandlers: Set<ErrorHandler>;
  /**
   * Per-fetch AbortController for the in-flight `fetchOnce` call.
   * Replaced at each fetch invocation; at `dispose`, the active one is
   * aborted then cleared.
   */
  activeAbort: AbortController | undefined;
  /** Latest resolved data + status. */
  latestData: unknown | undefined;
  latestStatus: number | undefined;
  disposed: boolean;
  /** Monotonic counter for telemetry `requestId`. */
  requestCounter: number;
}

/**
 * Convenience namespace for the factory builder. Mirrors
 * `AiChatClipFactoryBuilder` (T-389) for consistency across γ-live
 * factories.
 */
export const LiveDataClipFactoryBuilder = {
  build(options: LiveDataClipFactoryOptions = {}): ClipFactory {
    return (ctx: MountContext) => mountLiveDataClip(ctx, options);
  },
};

/**
 * Mount routine. Top-level function — live-data lives outside the
 * shader sub-rule scope. The structural shape is for consistency, not
 * for sub-rule compliance.
 */
async function mountLiveDataClip(
  ctx: MountContext,
  options: LiveDataClipFactoryOptions,
): Promise<LiveDataClipMountHandle> {
  const family = ctx.clip.family;

  // 1. Parse + narrow `liveMount.props`.
  const propsResult = liveDataClipPropsSchema.safeParse(ctx.clip.liveMount.props);
  if (!propsResult.success) {
    ctx.emitTelemetry('live-data-clip.mount.failure', {
      family,
      reason: 'invalid-props' satisfies LiveDataMountFailureReason,
      issues: propsResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    throw new Error(
      `liveDataClipFactory: liveMount.props failed liveDataClipPropsSchema — ${propsResult.error.message}`,
    );
  }
  const props: LiveDataClipProps = propsResult.data;

  // 2. Resolve provider. The factory rejects if none is supplied — a
  //    missing provider is a configuration bug at app boot, not a
  //    permission denial.
  const provider = options.provider;
  if (provider === undefined) {
    ctx.emitTelemetry('live-data-clip.mount.failure', {
      family,
      reason: 'fetcher-unavailable' satisfies LiveDataMountFailureReason,
    });
    throw new Error(
      'liveDataClipFactory: no LiveDataProvider supplied. Pass `provider` to LiveDataClipFactoryBuilder.build({}) at app boot.',
    );
  }

  // 3. Telemetry — mount.start. Per D-T391-8 the configuration strings
  //    ARE included; they are configuration, not user content.
  ctx.emitTelemetry('live-data-clip.mount.start', {
    family,
    endpoint: props.endpoint,
    method: props.method,
    parseMode: props.parseMode,
    refreshTrigger: props.refreshTrigger,
  });

  // 4. Build React root + initial render.
  const state: LiveDataMountState = {
    reactRoot: createRoot(ctx.root),
    dataHandlers: new Set(),
    errorHandlers: new Set(),
    activeAbort: undefined,
    latestData: undefined,
    latestStatus: undefined,
    disposed: false,
    requestCounter: 0,
  };
  flushSync(() => {
    state.reactRoot.render(createElement(LiveDataClipMount, {}));
  });

  // Telemetry — mount.success.
  ctx.emitTelemetry('live-data-clip.mount.success', { family });

  // ----- private helpers -----

  /** Dispatch one data event to every subscriber. */
  const dispatchData = (event: DataEvent): void => {
    for (const handler of state.dataHandlers) {
      try {
        handler(event);
      } catch {
        /* swallow — one handler's throw must not break siblings */
      }
    }
  };

  /** Dispatch one error event to every subscriber. */
  const dispatchError = (event: ErrorEvent): void => {
    for (const handler of state.errorHandlers) {
      try {
        handler(event);
      } catch {
        /* swallow */
      }
    }
  };

  /** Wall-clock helper. The interactive tier exempts the broad rule. */
  const nowMs = (): number => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  };

  /**
   * Run one fetch end-to-end. Updates state, dispatches events, and
   * emits telemetry. Returns when the fetch settles.
   */
  const runFetch = async (): Promise<void> => {
    if (state.disposed) return;

    // Per-fetch AbortController. Replaces any prior one (a fresh fetch
    // after a completed one always starts with a new controller).
    const abort = new AbortController();
    state.activeAbort = abort;

    state.requestCounter += 1;
    const requestId = `req-${state.requestCounter}`;
    const startedAt = nowMs();

    ctx.emitTelemetry('live-data-clip.fetch.started', {
      family,
      requestId,
      endpoint: props.endpoint,
      method: props.method,
    });

    // Build the request body + headers. POST with body → JSON.stringify
    // and add Content-Type: application/json. AC #13.
    const headers: Record<string, string> = { ...(props.headers ?? {}) };
    let body: string | undefined;
    if (props.method === 'POST' && props.body !== undefined) {
      body = JSON.stringify(props.body);
      if (headers['Content-Type'] === undefined) {
        headers['Content-Type'] = 'application/json';
      }
    }

    try {
      const response = await provider.fetchOnce({
        url: props.endpoint,
        method: props.method,
        headers,
        body,
        signal: abort.signal,
      });

      if (state.disposed || abort.signal.aborted) return;

      // Parse per `parseMode`.
      let parsed: unknown;
      try {
        if (props.parseMode === 'json') {
          parsed = response.bodyText.length === 0 ? null : JSON.parse(response.bodyText);
        } else {
          parsed = response.bodyText;
        }
      } catch (parseErr) {
        const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
        if (!state.disposed) {
          dispatchError({ kind: 'parse-error', message });
        }
        ctx.emitTelemetry('live-data-clip.fetch.error', {
          family,
          requestId,
          errorKind: 'parse',
        });
        return;
      }

      // Commit + dispatch.
      state.latestData = parsed;
      state.latestStatus = response.status;
      const finishedAt = nowMs();
      const durationMs = Math.max(0, finishedAt - startedAt);

      dispatchData({
        kind: 'resolved',
        status: response.status,
        data: parsed,
        durationMs,
      });

      ctx.emitTelemetry('live-data-clip.fetch.resolved', {
        family,
        requestId,
        status: response.status,
        durationMs,
        // Privacy posture (D-T391-8 + AC #18): integer length only.
        bodyByteLength: response.bodyText.length,
        parseMode: props.parseMode,
      });
    } catch (err) {
      // Suppress events / extra telemetry on dispose-driven aborts.
      const aborted = abort.signal.aborted;
      const errorKind = aborted ? 'aborted' : 'network';
      const message = err instanceof Error ? err.message : String(err);

      if (!state.disposed && !aborted) {
        dispatchError({ kind: 'fetch-error', message });
      } else if (!state.disposed && aborted) {
        dispatchError({ kind: 'aborted', message });
      }

      ctx.emitTelemetry('live-data-clip.fetch.error', {
        family,
        requestId,
        errorKind,
      });
    } finally {
      // Clear the per-fetch controller if it's still ours (a dispose
      // mid-flight may have replaced or cleared it already).
      if (state.activeAbort === abort) {
        state.activeAbort = undefined;
      }
    }
  };

  const refresh = async (): Promise<void> => {
    if (state.disposed) return;
    if (props.refreshTrigger === 'mount-only') {
      throw new RefreshTriggerError();
    }
    // Abort any currently in-flight fetch before starting a new one.
    if (state.activeAbort !== undefined) {
      try {
        state.activeAbort.abort();
      } catch {
        /* defensive */
      }
      state.activeAbort = undefined;
    }
    await runFetch();
  };

  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    // 1. Abort any in-flight call (D-T391-7 + AC #16).
    if (state.activeAbort !== undefined) {
      try {
        state.activeAbort.abort();
      } catch {
        /* defensive */
      }
      state.activeAbort = undefined;
    }
    // 2. Drop resolved data reference.
    state.latestData = undefined;
    state.latestStatus = undefined;
    // 3. Unsubscribe all handlers.
    state.dataHandlers.clear();
    state.errorHandlers.clear();
    // 4. Unmount the React root.
    state.reactRoot.unmount();
    // 5. Final telemetry.
    ctx.emitTelemetry('live-data-clip.dispose', { family });
  };

  // Wire signal.abort → dispose at the factory layer (the harness wraps
  // again, but a factory-level wire keeps the contract honest for direct-
  // factory consumers).
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

  // 5. Kick off the mount-time fetch unconditionally on the next
  //    microtask — the mount-time fetch always runs; `refreshTrigger`
  //    only controls whether subsequent `refresh()` calls are permitted.
  //    Deferring with `queueMicrotask` gives the caller a chance to
  //    subscribe `onData` / `onError` after the factory's await
  //    resolves but before the fetch settles, so the very first
  //    resolution is observable by handlers attached at the mount site.
  queueMicrotask(() => {
    if (state.disposed) return;
    void runFetch();
  });

  // Build the public handle.
  const handle: LiveDataClipMountHandle = {
    updateProps: () => {
      // live-data props are mount-time configuration; runtime updates
      // are out-of-scope for T-391. No-op.
    },
    dispose,
    refresh,
    getData: () => state.latestData,
    getStatus: () => state.latestStatus,
    onData: (handler: DataHandler) => {
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
 * Minimal React tree for the live-data clip's visual surface. Per
 * CLAUDE.md §10, no English UI strings ship in the package — host apps
 * style and label via the data attributes the surface exposes.
 *
 * The component is intentionally stateless: data state lives on the
 * `LiveDataClipMountHandle`, not in the visual tree. Hosts that want a
 * data-streaming attribute mirror subscribe to `onData` and update
 * their own DOM. Chart rendering is gated on T-406's landing — a
 * follow-up task replaces this stub with chart-aware rendering.
 */
function LiveDataClipMount(): ReturnType<typeof createElement> {
  return createElement(
    'div',
    { 'data-stageflip-live-data-clip': 'true' },
    createElement('output', { 'data-role': 'live-data' }),
  );
}

/**
 * The default factory instance — no options. Production mounts MUST
 * pass a `provider` via `LiveDataClipFactoryBuilder.build({...})`; the
 * no-options export exists so the registry has a concrete factory to
 * register at side-effect import time. Mounting the no-options factory
 * will fail with `mount.failure` reason `'fetcher-unavailable'`, which
 * is the correct behaviour for an under-configured deployment.
 */
export const liveDataClipFactory: ClipFactory = LiveDataClipFactoryBuilder.build();
