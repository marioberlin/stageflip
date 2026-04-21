// packages/renderer-cdp/src/puppeteer-session.test.ts
// Unit tests for PuppeteerCdpSession with a fake browser seam. No real
// puppeteer launches; the full end-to-end path is exercised by the
// reference-render.test.ts guarded suite when Chrome is available.

import { describe, expect, it } from 'vitest';

import type { CompositionConfig } from './adapter';
import type { DispatchPlan } from './dispatch';
import {
  type PuppetBrowser,
  type PuppetPage,
  PuppeteerCdpSession,
  canvasPlaceholderHostHtml,
} from './puppeteer-session';

// --- fakes ------------------------------------------------------------------

interface PageCall {
  readonly op: string;
  readonly value?: unknown;
}

class FakePage implements PuppetPage {
  public readonly calls: PageCall[] = [];
  public ready = false;
  public screenshotPayload = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic

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

  async newPage(): Promise<PuppetPage> {
    const page = new FakePage();
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

    const handle = await session.mount(mkPlan(), mkConfig());
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
    await session.mount(mkPlan(), mkConfig({ width: 1280, height: 720 }));
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

    await session.mount(mkPlan(), mkConfig());
    await session.mount(mkPlan(), mkConfig());

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
      session.mount(mkPlan(), mkConfig()),
      session.mount(mkPlan(), mkConfig()),
      session.mount(mkPlan(), mkConfig()),
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
    await expect(session.mount(mkPlan(), mkConfig())).rejects.toThrow(/transient/);
    // A second mount should retry the factory rather than returning
    // the failed promise forever.
    await expect(session.mount(mkPlan(), mkConfig())).resolves.toBeDefined();
    expect(attempts).toBe(2);
  });

  it('closeSession closes the underlying browser exactly once', async () => {
    const browser = new FakeBrowser();
    const session = new PuppeteerCdpSession({
      browserFactory: async () => browser,
    });
    await session.mount(mkPlan(), mkConfig());
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
    const handle = await session.mount(mkPlan(), mkConfig());
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
    await expect(session.mount(mkPlan(), mkConfig())).rejects.toThrow(
      /did not set window\.__sf\.ready/,
    );
  });
});

describe('canvasPlaceholderHostHtml', () => {
  it('embeds width/height/fps/durationFrames and the window.__sf API', () => {
    const html = canvasPlaceholderHostHtml({
      plan: mkPlan(),
      config: { width: 640, height: 480, fps: 24, durationFrames: 48 },
    });
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain('FPS = 24');
    expect(html).toContain('DUR = 48');
    expect(html).toContain('window.__sf');
    expect(html).toContain('ready: true');
  });
});
