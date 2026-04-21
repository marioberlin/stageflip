// packages/renderer-cdp/src/puppeteer-session.test.ts
// Unit tests for PuppeteerCdpSession with a fake browser seam. No real
// puppeteer launches; the full end-to-end path is exercised by the
// reference-render.test.ts guarded suite when Chrome is available.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RIRDocument } from '@stageflip/rir';

import type { CompositionConfig } from './adapter';
import type { DispatchPlan } from './dispatch';
import {
  BEGIN_FRAME_LAUNCH_ARGS,
  type HostHtmlBuilder,
  type PuppetBrowser,
  type PuppetCdpClient,
  type PuppetPage,
  PuppeteerCdpSession,
  canvasPlaceholderHostHtml,
  createPuppeteerBrowserFactory,
  createRuntimeBundleHostHtml,
  probeBeginFrameSupport,
  richPlaceholderHostHtml,
} from './puppeteer-session';

// Stub puppeteer-core at module level so createPuppeteerBrowserFactory's
// lazy `import('puppeteer-core')` resolves to a captureable launch spy
// without pulling in the real Chrome binding. No other test in this
// file imports puppeteer-core directly.
const launchSpy = vi.fn(async () => ({ close: async () => undefined }));
vi.mock('puppeteer-core', () => ({
  default: { launch: launchSpy },
}));

// --- fakes ------------------------------------------------------------------

interface PageCall {
  readonly op: string;
  readonly value?: unknown;
}

interface CdpCall {
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

class FakeCdpClient implements PuppetCdpClient {
  public readonly calls: CdpCall[] = [];
  public detached = false;
  /**
   * Handlers keyed by CDP method. Defaults cover the probe path; tests
   * override per-method to simulate success, empty-damage, or failure.
   */
  public readonly handlers = new Map<string, (params?: Record<string, unknown>) => unknown>([
    ['HeadlessExperimental.enable', () => ({})],
    [
      'HeadlessExperimental.beginFrame',
      () => ({ screenshotData: Buffer.from('png-bytes').toString('base64'), hasDamage: true }),
    ],
  ]);

  async send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    this.calls.push({ method, ...(params !== undefined ? { params } : {}) });
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`FakeCdpClient: unexpected CDP method ${method}`);
    }
    const out = handler(params);
    if (out instanceof Error) throw out;
    return out as T;
  }

  async detach(): Promise<void> {
    this.detached = true;
  }
}

class FakePage implements PuppetPage {
  public readonly calls: PageCall[] = [];
  public ready = false;
  public screenshotPayload = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
  public lastCdp: FakeCdpClient | null = null;
  /**
   * Assigned via constructor when CDP support is desired — otherwise
   * undefined so `typeof page.createCDPSession === 'function'` returns
   * false (matches the production gate in resolveCaptureMode).
   */
  public createCDPSession?: () => Promise<PuppetCdpClient>;

  constructor(opts?: { cdpFactory?: () => FakeCdpClient }) {
    const factory = opts?.cdpFactory;
    if (factory) {
      this.createCDPSession = () => {
        const client = factory();
        this.lastCdp = client;
        this.calls.push({ op: 'createCDPSession' });
        return Promise.resolve(client);
      };
    }
  }

  async setViewport(opts: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  }): Promise<void> {
    this.calls.push({ op: 'setViewport', value: opts });
  }

  async setContent(html: string): Promise<void> {
    this.calls.push({ op: 'setContent', value: html });
    // Canvas placeholder sets __sf.ready = true inline — reflect that.
    if (html.includes('window.__sf')) this.ready = true;
  }

  async evaluate<T>(fn: string | ((...a: unknown[]) => T), ...args: unknown[]): Promise<T> {
    if (typeof fn === 'string') {
      this.calls.push({ op: 'evaluate-string', value: fn });
      // Readiness probe: return whatever we've been told to.
      return this.ready as unknown as T;
    }
    this.calls.push({ op: 'evaluate-fn', value: args });
    return undefined as unknown as T;
  }

  async screenshot(opts?: { type?: 'png' | 'jpeg' }): Promise<Uint8Array> {
    this.calls.push({ op: 'screenshot', value: opts });
    return this.screenshotPayload;
  }

  async close(): Promise<void> {
    this.calls.push({ op: 'close' });
  }
}

class FakeBrowser implements PuppetBrowser {
  public readonly pages: FakePage[] = [];
  public closed = false;
  /**
   * When set, every new page gets CDP wiring via this factory.
   * Defaults to screenshot-only pages.
   */
  public cdpFactory: (() => FakeCdpClient) | undefined;

  async newPage(): Promise<PuppetPage> {
    const opts = this.cdpFactory ? { cdpFactory: this.cdpFactory } : undefined;
    const page = new FakePage(opts);
    this.pages.push(page);
    return page;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function mkPlan(): DispatchPlan {
  return { resolved: [], unresolved: [] };
}

function mkConfig(overrides: Partial<CompositionConfig> = {}): CompositionConfig {
  return { width: 320, height: 240, fps: 30, durationFrames: 30, ...overrides };
}

function mkDoc(overrides: Partial<RIRDocument> = {}): RIRDocument {
  return {
    id: 'test-doc',
    width: 320,
    height: 240,
    frameRate: 30,
    durationFrames: 30,
    mode: 'slide',
    elements: [],
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'test',
    },
    ...overrides,
  };
}

// --- tests ------------------------------------------------------------------

describe('PuppeteerCdpSession', () => {
  it('constructor rejects a non-function browserFactory', () => {
    expect(
      // @ts-expect-error — intentional
      () => new PuppeteerCdpSession({ browserFactory: null }),
    ).toThrow(/browserFactory/);
  });

  it('mount → seek → capture → close drives the page in the right order', async () => {
    const browser = new FakeBrowser();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
    });

    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    await session.seek(handle, 5);
    const buf = await session.capture(handle);
    await session.close(handle);

    const page = browser.pages[0];
    if (page === undefined) throw new Error('expected one page');
    const ops = page.calls.map((c) => c.op);
    // Order: setViewport, setContent, ready-probe evaluate(s), seek
    // evaluate, screenshot, close.
    expect(ops[0]).toBe('setViewport');
    expect(ops[1]).toBe('setContent');
    expect(ops).toContain('evaluate-fn'); // the seek
    expect(ops).toContain('screenshot');
    expect(ops[ops.length - 1]).toBe('close');
    expect(buf).toBeInstanceOf(Uint8Array);
    // First 4 bytes are PNG magic per the fake.
    expect(Array.from(buf.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('passes composition config to setViewport', async () => {
    const browser = new FakeBrowser();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
    });
    await session.mount(
      mkPlan(),
      mkConfig({ width: 1280, height: 720 }),
      mkDoc({ width: 1280, height: 720 }),
    );
    const vp = browser.pages[0]?.calls.find((c) => c.op === 'setViewport');
    expect(vp?.value).toMatchObject({ width: 1280, height: 720 });
  });

  it('reuses one browser across multiple sequential mounts', async () => {
    let spawnCount = 0;
    const session = new PuppeteerCdpSession({
      browserFactory: async () => {
        spawnCount++;
        return new FakeBrowser();
      },
    });

    await session.mount(mkPlan(), mkConfig(), mkDoc());
    await session.mount(mkPlan(), mkConfig(), mkDoc());

    expect(spawnCount).toBe(1);
  });

  it('reuses one browser across concurrent mounts (no race)', async () => {
    // Reviewer-flagged race: two concurrent mount() calls both entering
    // ensureBrowser before either finished launching. The fix caches
    // the in-flight Promise instead of the resolved Browser.
    let spawnCount = 0;
    const session = new PuppeteerCdpSession({
      browserFactory: async () => {
        spawnCount++;
        // Simulate any async delay in the factory.
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new FakeBrowser();
      },
    });

    await Promise.all([
      session.mount(mkPlan(), mkConfig(), mkDoc()),
      session.mount(mkPlan(), mkConfig(), mkDoc()),
      session.mount(mkPlan(), mkConfig(), mkDoc()),
    ]);

    expect(spawnCount).toBe(1);
  });

  it('clears the cached browser promise when the factory rejects', async () => {
    let attempts = 0;
    const session = new PuppeteerCdpSession({
      browserFactory: async () => {
        attempts++;
        if (attempts === 1) throw new Error('transient launch failure');
        return new FakeBrowser();
      },
    });
    await expect(session.mount(mkPlan(), mkConfig(), mkDoc())).rejects.toThrow(/transient/);
    // A second mount should retry the factory rather than returning
    // the failed promise forever.
    await expect(session.mount(mkPlan(), mkConfig(), mkDoc())).resolves.toBeDefined();
    expect(attempts).toBe(2);
  });

  it('closeSession closes the underlying browser exactly once', async () => {
    const browser = new FakeBrowser();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
    });
    await session.mount(mkPlan(), mkConfig(), mkDoc());
    await session.closeSession();
    expect(browser.closed).toBe(true);

    // Second call is a no-op.
    await session.closeSession();
    expect(browser.closed).toBe(true);
  });

  it('close(handle) closes the page but leaves the browser open', async () => {
    const browser = new FakeBrowser();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    await session.close(handle);
    expect(browser.closed).toBe(false);
    const closeCalls = browser.pages[0]?.calls.filter((c) => c.op === 'close') ?? [];
    expect(closeCalls).toHaveLength(1);
  });

  it('throws a clear error when a foreign handle is passed', async () => {
    const session = new PuppeteerCdpSession({ browserFactory: async () => new FakeBrowser() });
    await expect(session.seek({ _handle: Symbol('bogus') }, 0)).rejects.toThrow(
      /not issued by this session/,
    );
  });

  it('times out when the host page never signals ready', async () => {
    class NeverReadyPage extends FakePage {
      override async setContent(): Promise<void> {
        this.calls.push({ op: 'setContent' });
        // Intentionally do not flip `ready`.
      }
    }
    class NeverReadyBrowser extends FakeBrowser {
      override async newPage(): Promise<PuppetPage> {
        const p = new NeverReadyPage();
        this.pages.push(p);
        return p;
      }
    }

    const session = new PuppeteerCdpSession({
      browserFactory: async () => new NeverReadyBrowser(),
      readyTimeoutMs: 50,
    });
    await expect(session.mount(mkPlan(), mkConfig(), mkDoc())).rejects.toThrow(
      /did not set window\.__sf\.ready/,
    );
  });
});

describe('PuppeteerCdpSession — BeginFrame mode', () => {
  it('auto mode falls back to screenshot on non-linux hosts', async () => {
    const browser = new FakeBrowser();
    browser.cdpFactory = () => new FakeCdpClient();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'darwin',
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    await session.capture(handle);
    // No CDP session created because auto skipped the probe.
    expect(browser.pages[0]?.lastCdp).toBeNull();
    expect(browser.pages[0]?.calls.some((c) => c.op === 'screenshot')).toBe(true);
  });

  it('auto mode selects BeginFrame on linux when the probe succeeds', async () => {
    const browser = new FakeBrowser();
    browser.cdpFactory = () => new FakeCdpClient();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'linux',
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    const buf = await session.capture(handle);
    const page = browser.pages[0];
    if (!page) throw new Error('expected page');
    expect(page.lastCdp?.calls.some((c) => c.method === 'HeadlessExperimental.beginFrame')).toBe(
      true,
    );
    // BeginFrame path returns the decoded screenshotData, not the
    // page.screenshot payload — screenshot should never be called.
    expect(page.calls.some((c) => c.op === 'screenshot')).toBe(false);
    // Sanity: the fake encodes 'png-bytes' as the screenshot; decoding
    // gives the raw ascii of that string.
    expect(Buffer.from(buf).toString('utf8')).toBe('png-bytes');
  });

  it('auto mode falls back to screenshot when the beginFrame probe fails', async () => {
    // Simulate a chrome-headless-shell that answers enable but rejects
    // beginFrame (the case the vendored engine comment calls out).
    const browser = new FakeBrowser();
    browser.cdpFactory = () => {
      const c = new FakeCdpClient();
      c.handlers.set('HeadlessExperimental.beginFrame', () => {
        throw new Error("'HeadlessExperimental.beginFrame' wasn't found");
      });
      return c;
    };
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'linux',
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    await session.capture(handle);
    // CDP session was created (probe attempted) and then detached
    // after the failed probe; captures took the screenshot path.
    expect(browser.pages[0]?.lastCdp?.detached).toBe(true);
    expect(browser.pages[0]?.calls.some((c) => c.op === 'screenshot')).toBe(true);
  });

  it('captureMode="beginframe" throws when the page has no createCDPSession', async () => {
    const browser = new FakeBrowser(); // no cdpFactory on the browser
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      captureMode: 'beginframe',
      platform: 'linux',
    });
    await expect(session.mount(mkPlan(), mkConfig(), mkDoc())).rejects.toThrow(/createCDPSession/);
  });

  it('captureMode="beginframe" throws when the probe fails', async () => {
    const browser = new FakeBrowser();
    browser.cdpFactory = () => {
      const c = new FakeCdpClient();
      c.handlers.set('HeadlessExperimental.beginFrame', () => {
        throw new Error('probe rejected');
      });
      return c;
    };
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      captureMode: 'beginframe',
      platform: 'linux',
    });
    await expect(session.mount(mkPlan(), mkConfig(), mkDoc())).rejects.toThrow(
      /beginFrame is unavailable/,
    );
    // The probe-failing CDP client should still have been detached to
    // avoid leaking the session.
    expect(browser.pages[0]?.lastCdp?.detached).toBe(true);
  });

  it('seek advances the BeginFrame clock proportional to the frame number', async () => {
    const browser = new FakeBrowser();
    browser.cdpFactory = () => new FakeCdpClient();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'linux',
    });
    const handle = await session.mount(mkPlan(), mkConfig({ fps: 30 }), mkDoc({ frameRate: 30 }));

    await session.seek(handle, 0);
    await session.capture(handle);
    await session.seek(handle, 10);
    await session.capture(handle);

    const cdp = browser.pages[0]?.lastCdp;
    if (!cdp) throw new Error('expected cdp client');
    const beginFrames = cdp.calls.filter((c) => c.method === 'HeadlessExperimental.beginFrame');
    // First call is the probe (ticks=0), second is frame 0 capture,
    // third is frame 10 capture.
    expect(beginFrames.length).toBeGreaterThanOrEqual(3);
    const interval = 1000 / 30;
    // Frame 10 capture → ticks = 10 * interval.
    const frame10 = beginFrames[beginFrames.length - 1];
    expect(frame10?.params?.frameTimeTicks).toBeCloseTo(10 * interval, 6);
    expect(frame10?.params?.interval).toBeCloseTo(interval, 6);
  });

  it('forces a secondary beginFrame when the first returns no screenshotData', async () => {
    let call = 0;
    const browser = new FakeBrowser();
    browser.cdpFactory = () => {
      const c = new FakeCdpClient();
      c.handlers.set('HeadlessExperimental.beginFrame', (params) => {
        call++;
        // First call (the probe) answers normally.
        if (call === 1) return { screenshotData: Buffer.from('probe').toString('base64') };
        // Second (real capture): no damage, no data.
        if (call === 2) return { screenshotData: undefined, hasDamage: false };
        // Third (forced retry with slight tick advance): return data.
        return {
          screenshotData: Buffer.from('forced').toString('base64'),
          // Note: caller sent ticks + 0.001 — we don't verify exact
          // match here, just that the retry fired.
          _receivedTicks: params?.frameTimeTicks,
        };
      });
      return c;
    };
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'linux',
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    const buf = await session.capture(handle);
    expect(Buffer.from(buf).toString('utf8')).toBe('forced');
  });

  it('throws when both the primary and forced beginFrame return no data', async () => {
    const browser = new FakeBrowser();
    browser.cdpFactory = () => {
      const c = new FakeCdpClient();
      let seen = 0;
      c.handlers.set('HeadlessExperimental.beginFrame', () => {
        seen++;
        // Let the probe succeed (call 1). Everything after returns empty.
        if (seen === 1) return { screenshotData: Buffer.from('probe').toString('base64') };
        return { screenshotData: undefined };
      });
      return c;
    };
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'linux',
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    await expect(session.capture(handle)).rejects.toThrow(/BeginFrame produced no screenshot data/);
  });

  it('close(handle) detaches the CDP session BEFORE closing the page', async () => {
    // Shared log records the order of detach vs. page.close so a
    // regression that swaps the two awaits inside session.close() is
    // caught. Both the fake CDP client and the fake page push into
    // this array when their respective terminators fire.
    const orderLog: string[] = [];
    const browser = new FakeBrowser();
    browser.cdpFactory = () => {
      const c = new FakeCdpClient();
      const originalDetach = c.detach.bind(c);
      c.detach = async () => {
        orderLog.push('cdp.detach');
        await originalDetach();
      };
      return c;
    };
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      platform: 'linux',
    });
    const handle = await session.mount(mkPlan(), mkConfig(), mkDoc());
    const page = browser.pages[0];
    if (!page) throw new Error('expected page');
    // Monkey-patch page.close to log.
    const originalPageClose = page.close.bind(page);
    page.close = async () => {
      orderLog.push('page.close');
      await originalPageClose();
    };
    await session.close(handle);
    expect(orderLog).toEqual(['cdp.detach', 'page.close']);
  });
});

describe('probeBeginFrameSupport', () => {
  it('returns true when enable + beginFrame both resolve', async () => {
    const cdp = new FakeCdpClient();
    expect(await probeBeginFrameSupport(cdp)).toBe(true);
  });

  it('returns false when beginFrame throws', async () => {
    const cdp = new FakeCdpClient();
    cdp.handlers.set('HeadlessExperimental.beginFrame', () => {
      throw new Error('method not found');
    });
    expect(await probeBeginFrameSupport(cdp)).toBe(false);
  });

  it('returns false when enable throws', async () => {
    const cdp = new FakeCdpClient();
    cdp.handlers.set('HeadlessExperimental.enable', () => {
      throw new Error('not supported');
    });
    expect(await probeBeginFrameSupport(cdp)).toBe(false);
  });

  it('returns false when beginFrame exceeds the timeout', async () => {
    const cdp = new FakeCdpClient();
    cdp.handlers.set(
      'HeadlessExperimental.beginFrame',
      () => new Promise(() => undefined), // never resolves
    );
    expect(await probeBeginFrameSupport(cdp, { timeoutMs: 25 })).toBe(false);
  });
});

describe('BEGIN_FRAME_LAUNCH_ARGS', () => {
  it('exposes the flags that are known to be BeginFrame-only', () => {
    expect(BEGIN_FRAME_LAUNCH_ARGS).toContain('--deterministic-mode');
    expect(BEGIN_FRAME_LAUNCH_ARGS).toContain('--enable-begin-frame-control');
  });

  it('is frozen — callers cannot mutate the canonical list', () => {
    expect(Object.isFrozen(BEGIN_FRAME_LAUNCH_ARGS)).toBe(true);
  });
});

describe('createPuppeteerBrowserFactory', () => {
  beforeEach(() => {
    launchSpy.mockClear();
  });

  /** Pull the `args` array off the most recent launch call. */
  function lastLaunchArgs(): readonly string[] {
    const call = launchSpy.mock.calls[0];
    if (!call) throw new Error('expected one puppeteer launch call');
    const opts = call[0] as { args?: readonly string[] };
    return opts?.args ?? [];
  }

  it('appends BEGIN_FRAME_LAUNCH_ARGS under captureMode="beginframe" regardless of platform', async () => {
    const factory = createPuppeteerBrowserFactory({
      captureMode: 'beginframe',
      platform: 'darwin',
    });
    await factory();
    expect(lastLaunchArgs()).toContain('--enable-begin-frame-control');
    expect(lastLaunchArgs()).toContain('--deterministic-mode');
  });

  it('appends BEGIN_FRAME_LAUNCH_ARGS under captureMode="auto" + platform="linux"', async () => {
    const factory = createPuppeteerBrowserFactory({ captureMode: 'auto', platform: 'linux' });
    await factory();
    expect(lastLaunchArgs()).toContain('--enable-begin-frame-control');
  });

  it('omits BEGIN_FRAME_LAUNCH_ARGS under captureMode="auto" + platform="darwin"', async () => {
    const factory = createPuppeteerBrowserFactory({ captureMode: 'auto', platform: 'darwin' });
    await factory();
    expect(lastLaunchArgs()).not.toContain('--enable-begin-frame-control');
    expect(lastLaunchArgs()).not.toContain('--deterministic-mode');
  });

  it('omits BEGIN_FRAME_LAUNCH_ARGS under captureMode="screenshot" regardless of platform', async () => {
    const factory = createPuppeteerBrowserFactory({ captureMode: 'screenshot', platform: 'linux' });
    await factory();
    expect(lastLaunchArgs()).not.toContain('--enable-begin-frame-control');
  });

  it('defaults to captureMode="auto" when the option is omitted', async () => {
    // With platform left at process.platform and mode default, the only
    // thing we can assert universally is that calling the factory
    // doesn't throw and launches puppeteer-core exactly once.
    const factory = createPuppeteerBrowserFactory({ platform: 'darwin' });
    await factory();
    expect(launchSpy).toHaveBeenCalledTimes(1);
    expect(lastLaunchArgs()).not.toContain('--enable-begin-frame-control');
  });

  it('preserves caller-supplied args and appends BeginFrame flags after them', async () => {
    const factory = createPuppeteerBrowserFactory({
      captureMode: 'beginframe',
      platform: 'linux',
      args: ['--window-size=800,600'],
    });
    await factory();
    const args = lastLaunchArgs();
    expect(args[0]).toBe('--window-size=800,600');
    expect(args).toContain('--enable-begin-frame-control');
  });
});

describe('PuppeteerCdpSession — document threading (T-100c)', () => {
  it('passes the RIRDocument to the host HTML builder at mount time', async () => {
    let received: Parameters<HostHtmlBuilder>[0] | null = null;
    const customBuilder: HostHtmlBuilder = (ctx) => {
      received = ctx;
      return '<!DOCTYPE html><html><body><script>window.__sf={setFrame(){},ready:true};</script></body></html>';
    };
    const browser = new FakeBrowser();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
      hostHtmlBuilder: customBuilder,
    });
    const doc = mkDoc({ id: 'doc-under-test', width: 1024, height: 768 });
    await session.mount(mkPlan(), mkConfig({ width: 1024, height: 768 }), doc);
    expect(received).not.toBeNull();
    expect(received?.document.id).toBe('doc-under-test');
    expect(received?.document.width).toBe(1024);
    expect(received?.config.width).toBe(1024);
  });
});

describe('richPlaceholderHostHtml', () => {
  const sampleDoc: RIRDocument = {
    id: 'rich-doc',
    width: 320,
    height: 240,
    frameRate: 30,
    durationFrames: 30,
    mode: 'slide',
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'test',
    },
    elements: [
      {
        id: 'bg',
        type: 'shape',
        transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
        timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: { type: 'shape', shape: 'rect', fill: '#123456' },
      },
      {
        id: 'title',
        type: 'text',
        transform: { x: 24, y: 24, width: 272, height: 40, rotation: 0, opacity: 1 },
        timing: { startFrame: 5, endFrame: 20, durationFrames: 15 },
        zIndex: 10,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: {
          type: 'text',
          text: 'Hello </script> world', // injection probe
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: 600,
          color: '#ffffff',
          align: 'left',
          lineHeight: 1.2,
        },
      },
    ],
  };

  it('embeds composition dimensions and the document JSON', () => {
    const html = richPlaceholderHostHtml({
      plan: { resolved: [], unresolved: [] },
      config: { width: 320, height: 240, fps: 30, durationFrames: 30 },
      document: sampleDoc,
    });
    expect(html).toContain('width:320px');
    expect(html).toContain('height:240px');
    expect(html).toContain('"id":"rich-doc"');
    expect(html).toContain('"id":"bg"');
    expect(html).toContain('"id":"title"');
  });

  it('escapes `</script` so injected text cannot break out of the data-script tag', () => {
    const html = richPlaceholderHostHtml({
      plan: { resolved: [], unresolved: [] },
      config: { width: 320, height: 240, fps: 30, durationFrames: 30 },
      document: sampleDoc,
    });
    // The document embeds `Hello </script> world` in a text element; the
    // serialiser must rewrite `</script` to `<\/script` so the HTML parser
    // doesn't terminate __sf_doc prematurely.
    const scriptTagCount = (html.match(/<script\b/gi) ?? []).length;
    const scriptEndCount = (html.match(/<\/script>/gi) ?? []).length;
    // Exactly two <script> tags: the data tag + the bootstrap tag.
    expect(scriptTagCount).toBe(2);
    expect(scriptEndCount).toBe(2);
  });

  it('sets window.__sf.setFrame and window.__sf.ready on boot', () => {
    const html = richPlaceholderHostHtml({
      plan: { resolved: [], unresolved: [] },
      config: { width: 320, height: 240, fps: 30, durationFrames: 30 },
      document: sampleDoc,
    });
    expect(html).toContain('window.__sf');
    expect(html).toContain('ready: true');
    expect(html).toContain('setFrame: controller.setFrame');
  });

  it('escapes U+2028 and U+2029 line separators', () => {
    const docWithLineSep: RIRDocument = {
      ...sampleDoc,
      elements: [
        {
          ...(sampleDoc.elements[0] as (typeof sampleDoc.elements)[number]),
          id: 'bg2',
        },
        {
          id: 'text-weird',
          type: 'text',
          transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
          timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
          zIndex: 1,
          visible: true,
          locked: false,
          stacking: 'auto',
          animations: [],
          content: {
            type: 'text',
            text: 'line\u2028separator\u2029',
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 400,
            color: '#000000',
            align: 'left',
            lineHeight: 1.2,
          },
        },
      ],
    };
    const html = richPlaceholderHostHtml({
      plan: { resolved: [], unresolved: [] },
      config: { width: 320, height: 240, fps: 30, durationFrames: 30 },
      document: docWithLineSep,
    });
    // Raw U+2028 / U+2029 must NOT appear in the HTML; they should be
    // replaced with \u2028 / \u2029 escape sequences.
    expect(html.includes('\u2028')).toBe(false);
    expect(html.includes('\u2029')).toBe(false);
    expect(html).toContain('\\u2028');
    expect(html).toContain('\\u2029');
  });
});

describe('createRuntimeBundleHostHtml', () => {
  const fakeBundle = "console.log('stageflip-bundle');";
  const sampleDoc: RIRDocument = mkDoc({
    width: 320,
    height: 240,
    elements: [
      {
        id: 'bg',
        type: 'shape',
        transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
        timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: { type: 'shape', shape: 'rect', fill: '#336699' },
      },
    ],
  });

  it('inlines the bundle source inside a <script> tag', () => {
    const builder = createRuntimeBundleHostHtml(fakeBundle);
    const html = builder({ plan: mkPlan(), config: mkConfig(), document: sampleDoc });
    expect(html).toContain(fakeBundle);
    expect(html).toContain('<script>');
  });

  it('embeds the RIR document as application/json under id="__sf_doc"', () => {
    const builder = createRuntimeBundleHostHtml(fakeBundle);
    const html = builder({ plan: mkPlan(), config: mkConfig(), document: sampleDoc });
    expect(html).toContain('id="__sf_doc"');
    expect(html).toContain('type="application/json"');
    expect(html).toContain('"id":"bg"');
  });

  it('emits the #__sf_root mount point with composition dimensions', () => {
    const builder = createRuntimeBundleHostHtml(fakeBundle);
    const html = builder({
      plan: mkPlan(),
      config: mkConfig({ width: 1280, height: 720 }),
      document: sampleDoc,
    });
    expect(html).toContain('id="__sf_root"');
    expect(html).toContain('width:1280px');
    expect(html).toContain('height:720px');
  });

  it('escapes `</script` in the embedded document JSON', () => {
    // Same injection defence as richPlaceholderHostHtml. Text element
    // content containing `</script>` must not terminate the JSON tag.
    const docWithInjection = mkDoc({
      elements: [
        {
          id: 'evil',
          type: 'text',
          transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
          timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
          zIndex: 0,
          visible: true,
          locked: false,
          stacking: 'auto',
          animations: [],
          content: {
            type: 'text',
            text: 'Hello </script> world',
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: 400,
            color: '#fff',
            align: 'left',
            lineHeight: 1,
          },
        },
      ],
    });
    const builder = createRuntimeBundleHostHtml(fakeBundle);
    const html = builder({ plan: mkPlan(), config: mkConfig(), document: docWithInjection });
    // Exactly two <script> tags: the __sf_doc data tag + the bundle
    // script. If the escape failed there would be more.
    expect((html.match(/<script\b/gi) ?? []).length).toBe(2);
    expect((html.match(/<\/script>/gi) ?? []).length).toBe(2);
  });

  it('escapes U+2028 and U+2029 line separators', () => {
    const docWithLineSep = mkDoc({
      elements: [
        {
          id: 't',
          type: 'text',
          transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
          timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
          zIndex: 0,
          visible: true,
          locked: false,
          stacking: 'auto',
          animations: [],
          content: {
            type: 'text',
            text: 'line\u2028sep\u2029',
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: 400,
            color: '#fff',
            align: 'left',
            lineHeight: 1,
          },
        },
      ],
    });
    const builder = createRuntimeBundleHostHtml(fakeBundle);
    const html = builder({ plan: mkPlan(), config: mkConfig(), document: docWithLineSep });
    expect(html.includes('\u2028')).toBe(false);
    expect(html.includes('\u2029')).toBe(false);
    expect(html).toContain('\\u2028');
    expect(html).toContain('\\u2029');
  });
});

describe('canvasPlaceholderHostHtml', () => {
  it('embeds width/height/fps/durationFrames and the window.__sf API', () => {
    const html = canvasPlaceholderHostHtml({
      plan: mkPlan(),
      config: { width: 640, height: 480, fps: 24, durationFrames: 48 },
      document: mkDoc({ width: 640, height: 480, frameRate: 24, durationFrames: 48 }),
    });
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain('FPS = 24');
    expect(html).toContain('DUR = 48');
    expect(html).toContain('window.__sf');
    expect(html).toContain('ready: true');
  });
});
