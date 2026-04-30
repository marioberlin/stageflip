// packages/runtimes/interactive/src/clips/web-embed/factory.ts
// `webEmbedClipFactory` — produces the `ClipFactory` for `family:
// 'web-embed'` (T-393 D-T393-1, D-T393-4). Standalone interactive-tier
// clip — no §3 runtime to wrap, no `frameSource` dependency
// (D-T393-6), no convergence test, NO provider seam (D-T393-5: the
// browser's `<iframe>` element IS the runtime).
//
// CRITICAL — D-T393-7: `dispose()` MUST tear down in this order:
//   1. Remove the window message listener.
//   2. Set `iframe.src = 'about:blank'` BEFORE detaching (halts the
//      embedded page's scripts / network / timers in browsers like
//      Firefox; detach alone is insufficient).
//   3. Detach the iframe from the DOM.
//   4. Clear subscriber set.
//   5. Idempotent.
//
// CRITICAL — D-T393-8 + AC #17: telemetry NEVER carries postMessage
// payload bodies. Only integer attributes (`byteLength`,
// `targetOrigin`, `origin`) plus typed enums.
//
// HARD-RULE COMPLIANCE — AC #25: this file contains no direct
// `fetch(`, `XMLHttpRequest`, or `sendBeacon` reference. The iframe's
// network is the browser's; the clip code never reaches for the
// global.
//
// Browser-safe: DOM only. No Node imports. No React (the iframe is
// the surface; no React tree needed).

import { type WebEmbedClipProps, webEmbedClipPropsSchema } from '@stageflip/schema';

import type { ClipFactory, MountContext } from '../../contract.js';
import type {
  WebEmbedClipMountHandle,
  WebEmbedMessageDropReason,
  WebEmbedMessageHandler,
  WebEmbedMountFailureReason,
} from './types.js';

/**
 * Caller-injected hooks. Currently empty — the factory has no
 * configuration surface beyond the clip's `liveMount.props`. Reserved
 * for future tenant-policy or CSP-hook injection.
 */
export interface WebEmbedClipFactoryOptions {
  /**
   * Optional override for `window` — primarily a test seam so a
   * happy-dom / jsdom test can pass a different global. Defaults to
   * `globalThis.window`.
   */
  windowRef?: Window;
}

interface WebEmbedMountState {
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  allowedOrigins: ReadonlySet<string>;
  windowRef: Window;
  messageHandlers: Set<WebEmbedMessageHandler>;
  windowListener: (event: MessageEvent) => void;
  disposed: boolean;
}

/**
 * Convenience namespace for the factory builder. Mirrors
 * `LiveDataClipFactoryBuilder` (T-391) for consistency across γ-live
 * factories.
 */
export const WebEmbedClipFactoryBuilder = {
  build(options: WebEmbedClipFactoryOptions = {}): ClipFactory {
    return (ctx: MountContext) => mountWebEmbedClip(ctx, options);
  },
};

async function mountWebEmbedClip(
  ctx: MountContext,
  options: WebEmbedClipFactoryOptions,
): Promise<WebEmbedClipMountHandle> {
  const family = ctx.clip.family;

  // 1. Parse + narrow `liveMount.props`.
  const propsResult = webEmbedClipPropsSchema.safeParse(ctx.clip.liveMount.props);
  if (!propsResult.success) {
    ctx.emitTelemetry('web-embed-clip.mount.failure', {
      family,
      reason: 'invalid-props' satisfies WebEmbedMountFailureReason,
      issues: propsResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    throw new Error(
      `webEmbedClipFactory: liveMount.props failed webEmbedClipPropsSchema — ${propsResult.error.message}`,
    );
  }
  const props: WebEmbedClipProps = propsResult.data;

  // 2. Resolve target origin from the URL once. `new URL(...)` is
  //    spec-defined and synchronous — no I/O.
  const targetOrigin = new URL(props.url).origin;

  // 3. Telemetry — mount.start. Per D-T393-8 the configuration strings
  //    ARE included; they are configuration, not user content. The
  //    `hasAllowedOrigins` boolean lets observability distinguish
  //    "wide-open" from "filtered" without leaking the allowlist.
  ctx.emitTelemetry('web-embed-clip.mount.start', {
    family,
    url: props.url,
    sandbox: props.sandbox.join(' '),
    hasAllowedOrigins: props.allowedOrigins !== undefined,
  });

  // 4. Build the iframe. Width/height fall back to the clip's
  //    transform per D-T393-4 / AC #10.
  const windowRef: Window = options.windowRef ?? (globalThis as { window: Window }).window;
  const ownerDoc = ctx.root.ownerDocument ?? windowRef.document;
  const iframe = ownerDoc.createElement('iframe');
  iframe.setAttribute('src', props.url);
  iframe.setAttribute('sandbox', props.sandbox.join(' '));
  const widthValue = props.width ?? ctx.clip.transform.width;
  const heightValue = props.height ?? ctx.clip.transform.height;
  iframe.setAttribute('width', String(widthValue));
  iframe.setAttribute('height', String(heightValue));
  iframe.setAttribute('data-stageflip-web-embed-clip', 'true');
  ctx.root.appendChild(iframe);

  // 5. State.
  const allowedOrigins = new Set(props.allowedOrigins ?? []);
  const handlers = new Set<WebEmbedMessageHandler>();

  const dispatchDropped = (origin: string, reason: WebEmbedMessageDropReason): void => {
    ctx.emitTelemetry('web-embed-clip.message.dropped', {
      family,
      origin,
      reason,
    });
  };

  // 6. Window message listener with origin + source filtering.
  //    AC #13 + AC #14: BOTH event.source === iframe.contentWindow AND
  //    event.origin ∈ allowedOrigins required. Mismatch reasons are
  //    distinguishable in telemetry (security observability).
  const onWindowMessage = (event: MessageEvent): void => {
    if (state.disposed) {
      dispatchDropped(event.origin ?? '', 'post-dispose');
      return;
    }
    // Source check first — a rogue page sending postMessage from a
    // nested iframe with a forged origin would otherwise pass the
    // origin filter.
    if (event.source !== iframe.contentWindow) {
      dispatchDropped(event.origin ?? '', 'source-mismatch');
      return;
    }
    if (!allowedOrigins.has(event.origin)) {
      dispatchDropped(event.origin ?? '', 'origin-not-allowed');
      return;
    }
    // Compute byteLength for telemetry — defensively because
    // event.data may be a Blob / ArrayBuffer / circular object that
    // JSON.stringify rejects (D-T393-8 escalation trigger).
    const byteLength = safeByteLength(event.data);
    ctx.emitTelemetry('web-embed-clip.message.received', {
      family,
      origin: event.origin,
      byteLength,
    });
    for (const handler of handlers) {
      try {
        handler({ origin: event.origin, data: event.data });
      } catch {
        /* swallow — one handler's throw must not break siblings */
      }
    }
  };
  windowRef.addEventListener('message', onWindowMessage);

  const state: WebEmbedMountState = {
    iframe,
    targetOrigin,
    allowedOrigins,
    windowRef,
    messageHandlers: handlers,
    windowListener: onWindowMessage,
    disposed: false,
  };

  // Telemetry — mount.success.
  ctx.emitTelemetry('web-embed-clip.mount.success', { family });

  // ----- handle methods -----

  const reload = (): void => {
    if (state.disposed) return;
    // Re-assign src to the configured URL. (Browsers treat self-
    // assignment as a navigation reload; we always assign the
    // configured URL to make stale iframe.src mutations recoverable.)
    state.iframe.setAttribute('src', props.url);
    ctx.emitTelemetry('web-embed-clip.reload', { family });
  };

  const postMessage = (message: unknown): void => {
    const cw = state.iframe.contentWindow;
    if (state.disposed || cw === null) {
      ctx.emitTelemetry('web-embed-clip.message.dropped', {
        family,
        origin: state.targetOrigin,
        reason: state.disposed ? 'post-dispose' : 'pre-mount',
      });
      return;
    }
    const byteLength = safeByteLength(message);
    cw.postMessage(message, state.targetOrigin);
    ctx.emitTelemetry('web-embed-clip.message.outbound', {
      family,
      targetOrigin: state.targetOrigin,
      byteLength,
    });
  };

  const onMessage = (handler: WebEmbedMessageHandler): (() => void) => {
    state.messageHandlers.add(handler);
    return () => {
      state.messageHandlers.delete(handler);
    };
  };

  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    // 1. Remove window listener (D-T393-7 step 1).
    state.windowRef.removeEventListener('message', state.windowListener);
    // 2. iframe.src = 'about:blank' BEFORE detach (D-T393-7 step 2;
    //    halts embedded page scripts / timers in browsers that don't
    //    do this on detach alone).
    state.iframe.setAttribute('src', 'about:blank');
    // 3. Detach iframe from DOM (D-T393-7 step 3).
    if (state.iframe.parentNode !== null) {
      state.iframe.parentNode.removeChild(state.iframe);
    }
    // 4. Clear subscriber set (D-T393-7 step 4).
    state.messageHandlers.clear();
    // 5. Final telemetry.
    ctx.emitTelemetry('web-embed-clip.dispose', { family });
  };

  // Wire signal.abort → dispose at the factory layer (the harness
  // wraps again, but a factory-level wire keeps the contract honest
  // for direct-factory consumers).
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

  // 7. Build the public handle.
  const handle: WebEmbedClipMountHandle = {
    updateProps: () => {
      // web-embed props are mount-time configuration; runtime updates
      // are out-of-scope for T-393. No-op.
    },
    dispose,
    reload,
    postMessage,
    onMessage,
  };

  return handle;
}

/**
 * Defensive byteLength calc. `JSON.stringify(value)` throws for
 * circular structures and returns `undefined` for `Function` / etc.;
 * either case yields `0` so the telemetry handler never crashes
 * (D-T393-8 escalation trigger F-6).
 */
function safeByteLength(value: unknown): number {
  try {
    const s = JSON.stringify(value);
    return typeof s === 'string' ? s.length : 0;
  } catch {
    return 0;
  }
}

/**
 * The default factory instance — no options. Production hosts can
 * pass a `windowRef` via `WebEmbedClipFactoryBuilder.build({...})` for
 * test seams; the no-options export exists so the registry has a
 * concrete factory to register at side-effect import time.
 */
export const webEmbedClipFactory: ClipFactory = WebEmbedClipFactoryBuilder.build();
