// packages/renderer-cdp/src/puppeteer-session.ts
// Concrete CdpSession backed by puppeteer-core. Launches a headless
// browser, hosts an HTML page that exposes `window.__sf.setFrame(n)`,
// and captures frames via either Chrome's deterministic
// `HeadlessExperimental.beginFrame` (when the runtime supports it) or
// the classic `Page.captureScreenshot` path otherwise.
//
// BeginFrame integration (T-100b): the vendored engine's
// `screenshotService.ts` is the reference implementation for the
// BeginFrame protocol. We reimplement the narrow subset we need here
// (rather than importing the vendored module) so that the test-fake
// seam (PuppetPage / PuppetCdpClient) stays clean: fakes don't have to
// satisfy puppeteer-core's full Page type. The BeginFrame flag set is
// surfaced on `createPuppeteerBrowserFactory` for consumers that
// launch chrome-headless-shell themselves.
//
// Determinism note: BeginFrame crashes on macOS / Windows — the
// hyperframes engine gates it on `process.platform === 'linux'` +
// chrome-headless-shell. We mirror that gate. On a non-Linux host, or
// when the runtime probe fails (recent chrome-headless-shell builds
// dropped the beginFrame method while keeping HeadlessExperimental
// available), we fall through to screenshot capture. Screenshot
// capture is non-deterministic across runs; BeginFrame is what the
// parity harness ultimately wants.

import type { RIRDocument } from '@stageflip/rir';

import type { CdpSession, CompositionConfig, SessionHandle } from './adapter';
import type { DispatchPlan } from './dispatch';

/** Narrow slice of puppeteer-core's CDPSession we actually use. */
export interface PuppetCdpClient {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  detach(): Promise<void>;
}

/** Narrow slice of puppeteer-core's Browser we actually use. */
export interface PuppetBrowser {
  newPage(): Promise<PuppetPage>;
  close(): Promise<void>;
}

/** Narrow slice of puppeteer-core's Page we actually use. */
export interface PuppetPage {
  setViewport(opts: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  }): Promise<void>;
  setContent(
    html: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' },
  ): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  evaluate<T, A extends unknown[]>(fn: (...args: A) => T, ...args: A): Promise<T>;
  screenshot(opts?: { type?: 'png' | 'jpeg' }): Promise<Uint8Array>;
  close(): Promise<void>;
  /**
   * Optional: concrete puppeteer-core pages always expose this. The
   * interface allows omission so cheap test fakes that only cover the
   * screenshot path don't have to synthesise a CDP client.
   */
  createCDPSession?(): Promise<PuppetCdpClient>;
}

/** Factory returning a ready-to-use browser. Tests inject fakes. */
export type BrowserFactory = () => Promise<PuppetBrowser>;

/**
 * HTML renderer for a composition. Pure string-in-string-out.
 *
 * `document` is the full `RIRDocument` — host implementations that
 * need the element tree (text, shape, clip positions, timing) read
 * this. Host implementations that only need viewport + fps + duration
 * can read `config` alone. The plan gates which clip kinds can be
 * rendered; elements whose kind is in `plan.unresolved` should NOT
 * reach a host builder because the adapter refuses at mount time.
 */
export type HostHtmlBuilder = (ctx: {
  readonly plan: DispatchPlan;
  readonly config: CompositionConfig;
  readonly document: RIRDocument;
}) => string;

/**
 * Capture protocol selection.
 *
 *   - `'beginframe'` — force `HeadlessExperimental.beginFrame`. Fails
 *     at mount time if the page has no `createCDPSession` or the
 *     runtime probe doesn't succeed.
 *   - `'screenshot'` — always use `page.screenshot()`. Matches the
 *     pre-T-100b behaviour.
 *   - `'auto'` (default) — BeginFrame on Linux when the probe
 *     succeeds; screenshot otherwise.
 */
export type CaptureMode = 'auto' | 'beginframe' | 'screenshot';

export interface PuppeteerCdpSessionOptions {
  readonly browserFactory: BrowserFactory;
  /** Custom host HTML. Defaults to a canvas-based placeholder. */
  readonly hostHtmlBuilder?: HostHtmlBuilder;
  /**
   * Milliseconds to wait for `window.__sf.ready === true` after setContent.
   * Default 5000.
   */
  readonly readyTimeoutMs?: number;
  /** Capture mode. Default `'auto'`. See {@link CaptureMode}. */
  readonly captureMode?: CaptureMode;
  /**
   * Override the platform probe for `'auto'` resolution. Defaults to
   * `process.platform`. Tests inject `'linux'` to exercise the
   * BeginFrame branch without running on Linux.
   */
  readonly platform?: NodeJS.Platform;
}

interface PuppetHandle {
  readonly _handle: symbol;
  readonly page: PuppetPage;
  readonly browser: PuppetBrowser;
  readonly captureMode: 'beginframe' | 'screenshot';
  readonly cdp: PuppetCdpClient | null;
  readonly beginFrameIntervalMs: number;
  /**
   * Absolute virtual clock position for the next BeginFrame call.
   * Advanced by `seek(frame)`; used by `capture(handle)`. Ignored on
   * the screenshot path.
   */
  beginFrameTimeTicks: number;
}

/**
 * Placeholder host HTML: a single canvas filled with a deterministic
 * colour derived from `frame`. Enough to exercise the full pipeline
 * (launch → mount → seek → capture → encode) without any DOM element
 * rendering. Ignores the RIR document. Used pre-T-100c and still the
 * default for callers that only care about pipeline smoke.
 */
export const canvasPlaceholderHostHtml: HostHtmlBuilder = ({ config }) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>stageflip-cdp</title>
<style>html,body{margin:0;padding:0;background:#000;}canvas{display:block;}</style>
</head><body>
<canvas id="c" width="${config.width}" height="${config.height}"></canvas>
<script>
(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = ${config.width}, H = ${config.height};
  const FPS = ${config.fps};
  const DUR = ${config.durationFrames};
  function draw(frame) {
    const t = frame / Math.max(DUR - 1, 1); // 0..1
    const hue = Math.floor(t * 360);
    ctx.fillStyle = 'hsl(' + hue + ',80%,50%)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = '32px monospace';
    ctx.fillText('frame ' + frame + '/' + DUR + ' @' + FPS + 'fps', 24, 48);
  }
  draw(0);
  window.__sf = {
    setFrame(n) { draw(n | 0); },
    ready: true,
  };
})();
</script></body></html>`;

/**
 * Rich placeholder host (T-100c): renders non-clip RIR elements (text,
 * shape, video, image) as inline DOM nodes with frame-reactive
 * visibility and absolute positioning. No React, no bundled runtimes,
 * no clip rendering — clip elements render as labelled placeholder
 * boxes so parity fixtures over clip kinds are deliberately NOT
 * deterministic here.
 *
 * When to use this host:
 *   - You want captures that reflect the actual RIR element tree
 *     (positions, text content, shape fills) rather than the canvas
 *     gradient from `canvasPlaceholderHostHtml`.
 *   - Your fixtures don't depend on any `clip` element — use T-100d's
 *     runtime-bundle host once it lands.
 *
 * Rendering model:
 *   - The composition is a single fixed-size div with `overflow:hidden`.
 *   - Each element is an absolutely-positioned child. z-index honours
 *     `element.zIndex`. `element.transform` drives size + position.
 *   - On `setFrame(n)`, the host walks the element list and toggles
 *     each element's `display` based on whether `n ∈ [startFrame,
 *     endFrame)` AND `element.visible !== false` (the latter is the
 *     permanent editorial hide; timing is the per-frame window).
 *     Animations are NOT applied — the element simply appears /
 *     disappears. Full animation resolution lands with T-100d.
 *
 * Determinism: safe under BeginFrame — the host page does zero
 * network, zero timers, and zero random numbers. Every frame's DOM
 * state is a pure function of `(document, frame)`.
 */
/**
 * The bootstrap logic that runs inside the rich-placeholder host page.
 * Exported so the unit tests can drive it directly against a real
 * `Document` (happy-dom) without having to execute the serialised JS.
 *
 * **Do not import this at runtime from production code** — the host
 * HTML is serialised by calling `.toString()` on this function, then
 * wrapped in an IIFE. The public contract is the string that
 * `richPlaceholderHostHtml` returns, not this reference.
 *
 * Declared as a standalone `function` (not an arrow) so
 * `richPlaceholderControllerScript.toString()` emits `function
 * richPlaceholderControllerScript(doc, root)` which we can IIFE via
 * `(<fn>)(doc, root)`.
 */
export function richPlaceholderControllerScript(
  doc: RIRDocument,
  root: HTMLElement,
): { setFrame: (n: number) => void } {
  interface NodeEntry {
    node: HTMLElement;
    timing: { startFrame: number; endFrame: number };
    editorialVisible: boolean;
  }
  const nodes: NodeEntry[] = [];
  for (const el of doc.elements) {
    const node = root.ownerDocument.createElement('div');
    node.className = '__sf_el';
    const t = el.transform;
    node.style.left = `${t.x}px`;
    node.style.top = `${t.y}px`;
    node.style.width = `${t.width}px`;
    node.style.height = `${t.height}px`;
    node.style.opacity = String(t.opacity);
    node.style.zIndex = String(el.zIndex);
    if (t.rotation) node.style.transform = `rotate(${t.rotation}deg)`;
    if (el.type === 'shape' && el.content.type === 'shape') {
      if (el.content.fill) node.style.background = el.content.fill;
      if (el.content.shape === 'ellipse') node.style.borderRadius = '50%';
    } else if (el.type === 'text' && el.content.type === 'text') {
      // Individual properties avoid the CSS `font` shorthand's quoting
      // rules — multi-word and stacked font-family values stay safe.
      node.style.fontFamily = el.content.fontFamily;
      node.style.fontSize = `${el.content.fontSize}px`;
      node.style.fontWeight = String(el.content.fontWeight);
      node.style.color = el.content.color;
      node.style.textAlign = el.content.align;
      node.style.lineHeight = String(el.content.lineHeight);
      node.textContent = el.content.text;
    } else if (el.type === 'video' || el.type === 'image') {
      node.className += ' __sf_clip_placeholder';
      node.textContent = `${el.type.toUpperCase()} ${el.id}`;
    } else {
      // clip, unknown content — labelled placeholder.
      node.className += ' __sf_clip_placeholder';
      node.textContent = `CLIP ${el.id}`;
    }
    root.appendChild(node);
    // `visible: false` is a permanent editorial hide (RIR semantic),
    // distinct from timing-window visibility. Track it alongside the
    // timing so `setFrame` honours both.
    nodes.push({
      node,
      timing: { startFrame: el.timing.startFrame, endFrame: el.timing.endFrame },
      editorialVisible: el.visible !== false,
    });
  }
  function setFrame(n: number): void {
    for (const entry of nodes) {
      const inWindow = n >= entry.timing.startFrame && n < entry.timing.endFrame;
      const visible = entry.editorialVisible && inWindow;
      entry.node.style.display = visible ? '' : 'none';
    }
  }
  setFrame(0);
  return { setFrame };
}

/**
 * Build a host HTML string that inlines a compiled Vite IIFE bundle
 * (from `@stageflip/cdp-host-bundle`) + the RIR document as a JSON
 * blob. The bundle's browser entry reads the document, registers the
 * available live runtimes, and mounts a React composition into
 * `#__sf_root`. Exposes `window.__sf.setFrame(n)` + `window.__sf.ready`.
 *
 * T-100d ships the bundle with the CSS runtime only; clip kinds from
 * other runtimes render as labelled placeholder boxes until T-100e
 * extends the bundle.
 *
 * @param bundleSource The compiled IIFE string. Get via
 *   `loadBundleSource()` from `@stageflip/cdp-host-bundle`.
 */
export function createRuntimeBundleHostHtml(bundleSource: string): HostHtmlBuilder {
  return ({ config, document }) => {
    // Same JSON injection defence as richPlaceholderHostHtml.
    const serialised = JSON.stringify(document)
      .replace(/<\/script/gi, '<\\/script')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>stageflip-cdp</title>
<style>
  html,body{margin:0;padding:0;background:#000;}
  #__sf_root{position:relative;overflow:hidden;width:${config.width}px;height:${config.height}px;background:#fff;}
  .__sf_placeholder{background:repeating-linear-gradient(45deg,#eee,#eee 8px,#ddd 8px,#ddd 16px);border:1px dashed #999;display:flex;align-items:center;justify-content:center;color:#555;font:12px monospace;}
</style>
</head><body>
<div id="__sf_root"></div>
<script id="__sf_doc" type="application/json">${serialised}</script>
<script>${bundleSource}</script>
</body></html>`;
  };
}

export const richPlaceholderHostHtml: HostHtmlBuilder = ({ config, document }) => {
  // HTML's <script> content model terminates at the first `</script`
  // sequence (any case, any attribute suffix). JSON.stringify happily
  // emits text elements containing that substring, which would close
  // the data-script tag prematurely. `\/` is a valid JSON escape for
  // `/` and neutralises the HTML end-tag match without changing the
  // decoded JSON. The `U+2028` / `U+2029` escapes are belt-and-braces
  // for historical JavaScript-in-HTML quirks.
  const serialised = JSON.stringify(document)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>stageflip-cdp</title>
<style>
  html,body{margin:0;padding:0;background:#000;}
  #__sf_root{position:relative;overflow:hidden;background:#fff;}
  .__sf_el{position:absolute;box-sizing:border-box;}
  .__sf_clip_placeholder{background:repeating-linear-gradient(45deg,#eee,#eee 8px,#ddd 8px,#ddd 16px);border:1px dashed #999;display:flex;align-items:center;justify-content:center;color:#555;font:12px monospace;}
</style>
</head><body>
<div id="__sf_root" style="width:${config.width}px;height:${config.height}px;"></div>
<script id="__sf_doc" type="application/json">${serialised}</script>
<script>
(function () {
  var controller = (${richPlaceholderControllerScript.toString()})(
    JSON.parse(document.getElementById('__sf_doc').textContent),
    document.getElementById('__sf_root')
  );
  window.__sf = { setFrame: controller.setFrame, ready: true };
})();
</script></body></html>`;
};

/**
 * Chrome flags required when the compositor is driven by
 * `HeadlessExperimental.beginFrame`. Leaving any of these unset under
 * BeginFrame mode either produces blank frames or wedges the probe.
 * Cross-referenced with the vendored engine's `browserManager.ts`.
 *
 * These flags also must NOT be supplied under screenshot mode —
 * `--enable-begin-frame-control` in particular puts Chrome in a
 * waiting state the screenshot path never satisfies.
 */
export const BEGIN_FRAME_LAUNCH_ARGS: readonly string[] = Object.freeze([
  '--deterministic-mode',
  '--enable-begin-frame-control',
  '--disable-new-content-rendering-timeout',
  '--run-all-compositor-stages-before-draw',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--disable-image-animation-resync',
  '--enable-surface-synchronization',
]);

/**
 * Probe whether the live browser actually honours
 * `HeadlessExperimental.beginFrame`. Recent chrome-headless-shell
 * builds expose the domain enable call but silently drop the
 * beginFrame method itself; without this probe the very first capture
 * crashes with `'HeadlessExperimental.beginFrame' wasn't found`.
 *
 * Returns `true` on success, `false` on any failure (missing method,
 * protocol error, timeout). Caller decides the fallback strategy.
 */
export async function probeBeginFrameSupport(
  cdp: PuppetCdpClient,
  opts?: { readonly timeoutMs?: number },
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 2000;
  try {
    await cdp.send('HeadlessExperimental.enable');
    const begin = cdp.send('HeadlessExperimental.beginFrame', {
      frameTimeTicks: 0,
      interval: 33,
      noDisplayUpdates: true,
    });
    // Attach a no-op catch BEFORE the race so that if the timeout
    // wins, `begin`'s eventual rejection (which may arrive after the
    // caller has detached the CDP client) doesn't surface as an
    // unhandled rejection.
    begin.catch(() => undefined);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('probeBeginFrameSupport: timeout')), timeoutMs),
    );
    await Promise.race([begin, timeout]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Concrete CdpSession using puppeteer-core. One session = one browser
 * instance; `mount` opens a page, `close` closes it. The browser itself
 * is created lazily at first mount and reused across subsequent mounts
 * until `closeSession()` is called.
 */
export class PuppeteerCdpSession implements CdpSession {
  private readonly browserFactory: BrowserFactory;
  private readonly hostHtmlBuilder: HostHtmlBuilder;
  private readonly readyTimeoutMs: number;
  private readonly captureModeRequest: CaptureMode;
  private readonly platform: NodeJS.Platform;
  /**
   * Cached in-flight browser promise. Caching the promise (not the
   * resolved value) is what makes `ensureBrowser` safe under concurrent
   * `mount()` calls — two callers in the same microtask tick both share
   * the same promise and both receive the same browser instance.
   */
  private browserPromise: Promise<PuppetBrowser> | null = null;
  private readonly handlesByPage = new WeakMap<PuppetPage, PuppetHandle>();

  constructor(opts: PuppeteerCdpSessionOptions) {
    if (typeof opts?.browserFactory !== 'function') {
      throw new Error('PuppeteerCdpSession: browserFactory must be a function');
    }
    this.browserFactory = opts.browserFactory;
    this.hostHtmlBuilder = opts.hostHtmlBuilder ?? canvasPlaceholderHostHtml;
    this.readyTimeoutMs = opts.readyTimeoutMs ?? 5000;
    this.captureModeRequest = opts.captureMode ?? 'auto';
    this.platform = opts.platform ?? process.platform;
  }

  async mount(
    plan: DispatchPlan,
    config: CompositionConfig,
    document: RIRDocument,
  ): Promise<SessionHandle> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: config.width, height: config.height });
    const html = this.hostHtmlBuilder({ plan, config, document });
    await page.setContent(html, { waitUntil: 'load' });
    await this.waitForReady(page);

    const { captureMode, cdp } = await this.resolveCaptureMode(page);
    const intervalMs = config.fps > 0 ? 1000 / config.fps : 0;

    const handle: PuppetHandle = {
      _handle: Symbol('puppeteer-cdp-session'),
      page,
      browser,
      captureMode,
      cdp,
      beginFrameIntervalMs: intervalMs,
      beginFrameTimeTicks: 0,
    };
    this.handlesByPage.set(page, handle);
    return handle;
  }

  async seek(handle: SessionHandle, frame: number): Promise<void> {
    const h = this.extract(handle);
    await h.page.evaluate((f: number) => {
      const sf = (globalThis as unknown as { __sf?: { setFrame?: (n: number) => void } }).__sf;
      sf?.setFrame?.(f);
    }, frame);
    // BeginFrame captures consume the accumulated virtual clock — pin
    // ticks to the absolute position for the requested frame so
    // non-monotonic seeks (e.g. scrubbing preview) still render
    // correctly. Screenshot mode ignores this value.
    h.beginFrameTimeTicks = frame * h.beginFrameIntervalMs;
  }

  async capture(handle: SessionHandle): Promise<Uint8Array> {
    const h = this.extract(handle);
    if (h.captureMode === 'beginframe') {
      return this.captureViaBeginFrame(h);
    }
    const buf = await h.page.screenshot({ type: 'png' });
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBufferLike);
  }

  async close(handle: SessionHandle): Promise<void> {
    const h = this.extract(handle);
    if (h.cdp) {
      // Detach the CDP client before closing the page so the browser
      // doesn't keep a dead session reference. Swallow errors —
      // detach can race with page teardown.
      await h.cdp.detach().catch(() => undefined);
    }
    await h.page.close();
    this.handlesByPage.delete(h.page);
  }

  /**
   * Close the underlying browser. Callers MUST invoke this exactly once
   * per session lifetime — e.g. in a `finally` alongside final
   * `close(handle)` calls — or the browser process leaks. Idempotent:
   * subsequent calls are no-ops.
   */
  async closeSession(): Promise<void> {
    const pending = this.browserPromise;
    if (pending === null) return;
    this.browserPromise = null;
    // Await the factory resolving (if still in flight) so we don't leak
    // a browser that was mid-launch when close was requested.
    try {
      const browser = await pending;
      await browser.close();
    } catch {
      // Factory failed; nothing to close.
    }
  }

  private async captureViaBeginFrame(h: PuppetHandle): Promise<Uint8Array> {
    if (!h.cdp) {
      throw new Error('PuppeteerCdpSession: beginframe mode requires a CDP client');
    }
    const result = await h.cdp.send<{ screenshotData?: string; hasDamage?: boolean }>(
      'HeadlessExperimental.beginFrame',
      {
        frameTimeTicks: h.beginFrameTimeTicks,
        interval: h.beginFrameIntervalMs,
        screenshot: { format: 'png', optimizeForSpeed: true },
      },
    );
    if (!result?.screenshotData) {
      // Intentional divergence from the vendored engine: upstream
      // `screenshotService.ts:98–113` keeps a per-page `lastFrameCache`
      // and returns the previous captured buffer when `hasDamage`
      // comes back false. We skip the cache and always re-send with a
      // 0.001-tick nudge. Rationale: parity harness captures
      // intentionally-varied frames (goldens at t=0 / mid / end) where
      // cache hits are rare, and the cache-free path is much easier
      // to reason about under non-sequential seeks. If a future
      // sequential-render consumer hits this hot (many static
      // frames), add a `lastFrameBuffer` to `PuppetHandle` and
      // short-circuit here. The 0.001-ms nudge permanently advances
      // virtual time by a sub-millisecond amount, but the next
      // `seek(frame)` pins ticks absolutely, so there's no drift.
      const forced = await h.cdp.send<{ screenshotData?: string }>(
        'HeadlessExperimental.beginFrame',
        {
          frameTimeTicks: h.beginFrameTimeTicks + 0.001,
          interval: h.beginFrameIntervalMs,
          screenshot: { format: 'png', optimizeForSpeed: true },
        },
      );
      if (!forced?.screenshotData) {
        throw new Error('PuppeteerCdpSession: BeginFrame produced no screenshot data');
      }
      return base64ToBytes(forced.screenshotData);
    }
    return base64ToBytes(result.screenshotData);
  }

  private async resolveCaptureMode(
    page: PuppetPage,
  ): Promise<{ captureMode: 'beginframe' | 'screenshot'; cdp: PuppetCdpClient | null }> {
    const request = this.captureModeRequest;
    if (request === 'screenshot') {
      return { captureMode: 'screenshot', cdp: null };
    }
    if (request === 'beginframe') {
      if (typeof page.createCDPSession !== 'function') {
        throw new Error(
          'PuppeteerCdpSession: captureMode="beginframe" requires a page that exposes createCDPSession()',
        );
      }
      const cdp = await page.createCDPSession();
      const ok = await probeBeginFrameSupport(cdp);
      if (!ok) {
        await cdp.detach().catch(() => undefined);
        throw new Error(
          'PuppeteerCdpSession: captureMode="beginframe" requested but HeadlessExperimental.beginFrame is unavailable',
        );
      }
      return { captureMode: 'beginframe', cdp };
    }
    // 'auto': BeginFrame is gated on Linux + a live createCDPSession +
    // a successful probe. Any failure falls through to screenshot.
    if (this.platform !== 'linux' || typeof page.createCDPSession !== 'function') {
      return { captureMode: 'screenshot', cdp: null };
    }
    const cdp = await page.createCDPSession();
    const ok = await probeBeginFrameSupport(cdp);
    if (!ok) {
      await cdp.detach().catch(() => undefined);
      return { captureMode: 'screenshot', cdp: null };
    }
    return { captureMode: 'beginframe', cdp };
  }

  private ensureBrowser(): Promise<PuppetBrowser> {
    if (this.browserPromise === null) {
      const launching = this.browserFactory();
      this.browserPromise = launching;
      // If the factory rejects, clear the cache so a subsequent mount
      // can retry. Without this, one transient launch failure would
      // permanently wedge the session.
      launching.catch(() => {
        if (this.browserPromise === launching) this.browserPromise = null;
      });
    }
    return this.browserPromise;
  }

  private extract(handle: SessionHandle): PuppetHandle {
    const h = handle as PuppetHandle;
    if (!h || !('page' in h)) {
      throw new Error('PuppeteerCdpSession: handle was not issued by this session');
    }
    return h;
  }

  private async waitForReady(page: PuppetPage): Promise<void> {
    const deadline = Date.now() + this.readyTimeoutMs;
    while (Date.now() < deadline) {
      const ready = await page.evaluate<boolean>(
        'Boolean((globalThis).__sf && (globalThis).__sf.ready)',
      );
      if (ready) return;
      await sleep(25);
    }
    throw new Error(
      `PuppeteerCdpSession: host did not set window.__sf.ready within ${this.readyTimeoutMs}ms`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decode a base64 string into a fresh `Uint8Array`. Handled via
 * Node's `Buffer` API for correctness + speed; parity harness already
 * pulls in node-only deps so the abstraction break is moot.
 */
function base64ToBytes(data: string): Uint8Array {
  const buf = Buffer.from(data, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Production browser factory: lazy-loads puppeteer-core and launches a
 * headless browser. Call sites in tests replace this with a fake.
 *
 * BeginFrame launch-arg logic (matches the vendored engine's
 * `buildChromeArgs` heuristic):
 *
 *   - `captureMode: 'beginframe'` — always append
 *     {@link BEGIN_FRAME_LAUNCH_ARGS}. Caller asked explicitly;
 *     appending the flags on a non-Linux Chrome that doesn't support
 *     the BeginFrame API will either crash at launch or wedge the
 *     compositor, and that's the caller's problem.
 *   - `captureMode: 'auto'` (default) — append
 *     {@link BEGIN_FRAME_LAUNCH_ARGS} only when running on Linux.
 *     Without this, auto-mode sessions on Linux probe an un-enabled
 *     compositor, the probe returns `false`, and they fall back to
 *     screenshot — defeating the point of auto. On macOS / Windows,
 *     `--enable-begin-frame-control` would wedge the compositor so
 *     the flags are deliberately NOT added; the session falls back
 *     to screenshot via the platform gate in `resolveCaptureMode`.
 *   - `captureMode: 'screenshot'` — never append. Compositor stays in
 *     its default mode.
 *
 * The `platform` option overrides `process.platform` so tests can
 * exercise the Linux branch without running on Linux.
 */
export function createPuppeteerBrowserFactory(opts: {
  readonly executablePath?: string;
  readonly args?: readonly string[];
  readonly headless?: boolean;
  readonly captureMode?: CaptureMode;
  readonly platform?: NodeJS.Platform;
}): BrowserFactory {
  return async () => {
    const puppeteer = (await import('puppeteer-core')) as unknown as {
      default: {
        launch(options: {
          executablePath?: string;
          args?: readonly string[];
          headless?: boolean | 'shell';
        }): Promise<PuppetBrowser>;
      };
    };
    const platform = opts.platform ?? process.platform;
    const captureMode = opts.captureMode ?? 'auto';
    const needsBeginFrameArgs =
      captureMode === 'beginframe' || (captureMode === 'auto' && platform === 'linux');
    const effectiveArgs = needsBeginFrameArgs
      ? [...(opts.args ?? []), ...BEGIN_FRAME_LAUNCH_ARGS]
      : (opts.args ?? undefined);
    const launchOpts: {
      executablePath?: string;
      args?: readonly string[];
      headless: boolean | 'shell';
    } = { headless: opts.headless ?? true };
    if (opts.executablePath !== undefined) launchOpts.executablePath = opts.executablePath;
    if (effectiveArgs !== undefined) launchOpts.args = effectiveArgs;
    return puppeteer.default.launch(launchOpts);
  };
}
