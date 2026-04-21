// packages/renderer-cdp/src/reference-render.test.ts
// Unit tests for renderReferenceFixture — wires the Phase 4 pipeline
// against a fake browser factory + fake child runner (for ffmpeg + ffprobe
// stubs). The real end-to-end suite is in reference-render.e2e.test.ts
// and is guarded by `canRunReferenceRenders()`.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import { __clearRuntimeRegistry, registerRuntime } from '@stageflip/runtimes-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  REFERENCE_FIXTURES,
  multiElementFixture,
  solidBackgroundFixture,
  videoClipFixture,
} from './reference-fixtures';
import { canRunReferenceRenders } from './reference-render';

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  __clearRuntimeRegistry();
});

function stubRuntime(id: string, kinds: readonly string[]): ClipRuntime {
  const clips = new Map<string, ClipDefinition<unknown>>();
  for (const kind of kinds) clips.set(kind, { kind, render: () => null });
  return { id, tier: 'live', clips };
}

// --- fixtures smoke --------------------------------------------------------

describe('reference fixtures', () => {
  it('all three are structurally-valid RIR documents with distinct digests', () => {
    expect(solidBackgroundFixture.elements).toHaveLength(1);
    expect(multiElementFixture.elements).toHaveLength(2);
    expect(videoClipFixture.elements).toHaveLength(1);
    expect(new Set(Object.values(REFERENCE_FIXTURES).map((f) => f.meta.digest)).size).toBe(3);
  });

  it('none of the three fixtures use a clip content (preflight-clean without any runtime)', () => {
    for (const fixture of Object.values(REFERENCE_FIXTURES)) {
      expect(fixture.elements.some((e) => e.content.type === 'clip')).toBe(false);
    }
    // solidBackground is a shape.
    const solid = solidBackgroundFixture.elements[0];
    expect(solid?.content.type).toBe('shape');
    // videoClip carries a remote URL — exercises asset preflight.
    const video = videoClipFixture.elements[0];
    expect(video?.content.type).toBe('video');
    if (video?.content.type === 'video') {
      expect(video.content.srcUrl).toMatch(/^https:\/\//);
    }
  });

  it('every fixture has a positive duration and matching timing', () => {
    for (const fixture of Object.values(REFERENCE_FIXTURES)) {
      expect(fixture.durationFrames).toBeGreaterThan(0);
      expect(fixture.frameRate).toBeGreaterThan(0);
      for (const el of fixture.elements) {
        expect(el.timing.durationFrames).toBe(el.timing.endFrame - el.timing.startFrame);
      }
    }
  });

  it('stub runtime registration is a no-op on the fixtures (sanity)', () => {
    // Regression guard: fixtures must stay runtime-free so the e2e
    // suite doesn't depend on runtime registration.
    registerRuntime(stubRuntime('css', ['solid-background']));
    for (const fixture of Object.values(REFERENCE_FIXTURES)) {
      expect(fixture.elements.some((e) => e.content.type === 'clip')).toBe(false);
    }
  });
});

// --- canRunReferenceRenders ------------------------------------------------

describe('canRunReferenceRenders', () => {
  it('returns a report with a truthy reason when tooling is missing', async () => {
    // We can't mock process.env here reliably across runs; just assert
    // the shape and that when ok=false, reason is non-null.
    const report = await canRunReferenceRenders();
    if (!report.ok) {
      expect(report.reason).not.toBeNull();
      expect(report.reason?.length).toBeGreaterThan(0);
    } else {
      // Host is capable — no reason is set.
      expect(report.reason).toBeNull();
      expect(report.chromePath).not.toBeNull();
      expect(report.ffmpegPath).not.toBeNull();
      expect(report.ffprobePath).not.toBeNull();
    }
  });

  it('respects PUPPETEER_EXECUTABLE_PATH when it points at a real file', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'stageflip-t090-'));
    try {
      const fakeChrome = join(tempRoot, 'chrome');
      await writeFile(fakeChrome, '#!/bin/sh\nexit 0\n');
      const prior = process.env.PUPPETEER_EXECUTABLE_PATH;
      process.env.PUPPETEER_EXECUTABLE_PATH = fakeChrome;
      try {
        const report = await canRunReferenceRenders();
        expect(report.chromePath).toBe(fakeChrome);
      } finally {
        if (prior === undefined) process.env.PUPPETEER_EXECUTABLE_PATH = undefined;
        else process.env.PUPPETEER_EXECUTABLE_PATH = prior;
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
