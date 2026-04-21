// packages/renderer-cdp/src/puppeteer-session.ts
// Concrete CdpSession backed by puppeteer-core. Launches a headless
// browser, hosts an HTML page that exposes `window.__sf.setFrame(n)`,
// and captures frames via `page.screenshot({ type: 'png' })`.
//
// Scope note: this is the first concrete CdpSession in Phase 4. The
// T-080 vendored engine's BeginFrame-based capture remains unused for
// now; screenshot-based capture is good enough for T-090's
// "valid MP4 from a fixture document" exit criterion. Byte-exact
// parity under BeginFrame is T-100 territory.
//
// Host HTML is pluggable: callers pass a `HostHtmlBuilder` that
// receives the dispatch plan + composition config and returns an HTML
// string. The page must set `window.__sf.ready = true` once it is
// prepared to accept seeks, and define `window.__sf.setFrame(n)` that
// settles synchronously (or via await). T-090 ships a minimal canvas-
// based placeholder builder; real React + runtime mounting lands
// alongside the T-100 parity harness when the bundler is available.

import type { CdpSession, CompositionConfig, SessionHandle } from './adapter';
import type { DispatchPlan } from './dispatch';

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
}

/** Factory returning a ready-to-use browser. Tests inject fakes. */
export type BrowserFactory = () => Promise<PuppetBrowser>;

/** HTML renderer for a composition. Pure string-in-string-out. */
export type HostHtmlBuilder = (ctx: {
  readonly plan: DispatchPlan;
  readonly config: CompositionConfig;
}) => string;

export interface PuppeteerCdpSessionOptions {
  readonly browserFactory: BrowserFactory;
  /** Custom host HTML. Defaults to a canvas-based placeholder. */
  readonly hostHtmlBuilder?: HostHtmlBuilder;
  /**
   * Milliseconds to wait for `window.__sf.ready === true` after setContent.
   * Default 5000.
   */
  readonly readyTimeoutMs?: number;
}

interface PuppetHandle {
  readonly _handle: symbol;
  readonly page: PuppetPage;
  readonly ownsBrowser: boolean;
  readonly browser: PuppetBrowser;
}

/**
 * Placeholder host HTML: a single canvas filled with a deterministic
 * colour derived from `frame`. Enough to exercise the full pipeline
 * (launch → mount → seek → capture → encode) without a React bundler.
 * Real runtime mounting ships later.
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
 * Concrete CdpSession using puppeteer-core. One session = one browser
 * instance; `mount` opens a page, `close` closes it. The browser itself
 * is created lazily at first mount and reused across subsequent mounts
 * until `closeSession()` is called.
 */
export class PuppeteerCdpSession implements CdpSession {
  private readonly browserFactory: BrowserFactory;
  private readonly hostHtmlBuilder: HostHtmlBuilder;
  private readonly readyTimeoutMs: number;
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
  }

  async mount(plan: DispatchPlan, config: CompositionConfig): Promise<SessionHandle> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: config.width, height: config.height });
    const html = this.hostHtmlBuilder({ plan, config });
    await page.setContent(html, { waitUntil: 'load' });
    await this.waitForReady(page);
    const handle: PuppetHandle = {
      _handle: Symbol('puppeteer-cdp-session'),
      page,
      ownsBrowser: false,
      browser,
    };
    this.handlesByPage.set(page, handle);
    return handle;
  }

  async seek(handle: SessionHandle, frame: number): Promise<void> {
    const { page } = this.extract(handle);
    await page.evaluate((f: number) => {
      const sf = (globalThis as unknown as { __sf?: { setFrame?: (n: number) => void } }).__sf;
      sf?.setFrame?.(f);
    }, frame);
  }

  async capture(handle: SessionHandle): Promise<Uint8Array> {
    const { page } = this.extract(handle);
    const buf = await page.screenshot({ type: 'png' });
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBufferLike);
  }

  async close(handle: SessionHandle): Promise<void> {
    const { page } = this.extract(handle);
    await page.close();
    this.handlesByPage.delete(page);
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
 * Production browser factory: lazy-loads puppeteer-core and launches a
 * headless browser. Call sites in tests replace this with a fake.
 */
export function createPuppeteerBrowserFactory(opts: {
  readonly executablePath?: string;
  readonly args?: readonly string[];
  readonly headless?: boolean;
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
    const launchOpts: {
      executablePath?: string;
      args?: readonly string[];
      headless: boolean | 'shell';
    } = { headless: opts.headless ?? true };
    if (opts.executablePath !== undefined) launchOpts.executablePath = opts.executablePath;
    if (opts.args !== undefined) launchOpts.args = opts.args;
    return puppeteer.default.launch(launchOpts);
  };
}
